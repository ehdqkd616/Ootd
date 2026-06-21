import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@ootd/db';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

export const recommendationRouter = Router();
recommendationRouter.use(requireAuth);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

recommendationRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const [data, total] = await Promise.all([
      prisma.outfitRecommendation.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.outfitRecommendation.count({ where: { userId: req.userId! } }),
    ]);
    res.json({ data, total, page, limit, hasNext: page * limit < total });
  } catch (err) {
    console.error('Recommendation list error:', err);
    res.status(500).json({ message: '추천 목록 조회 실패' });
  }
});

recommendationRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, useWeather } = req.body as { prompt: string; useWeather?: boolean };

    // 사용자 옷장 아이템 조회
    const wardrobeItems = await prisma.clothingItem.findMany({
      where: { userId: req.userId!, isArchived: false },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });

    const itemList = wardrobeItems.length > 0
      ? wardrobeItems
          .map((item, i) =>
            `${i + 1}. ${item.name ?? '이름없음'} (카테고리: ${item.category ?? '미분류'}${item.brand ? `, 브랜드: ${item.brand}` : ''}${item.colorTags?.length ? `, 색상: ${item.colorTags.join('/')}` : ''})`
          )
          .join('\n')
      : '등록된 옷이 없습니다.';

    const systemPrompt = `당신은 패션 스타일리스트입니다. 사용자의 옷장 목록을 보고 상황에 맞는 코디를 추천해주세요.
응답은 반드시 한국어로, 친근하고 구체적으로 해주세요.
추천 시 옷장 목록에 있는 아이템 번호를 명시해주세요.`;

    const userMessage = `[내 옷장 목록]\n${itemList}\n\n[상황/요청]\n${prompt}${useWeather ? '\n(현재 날씨 정보 반영 요청)' : ''}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const explanation = message.content[0].type === 'text' ? message.content[0].text : '';

    // 추천된 아이템 번호 파싱 (1. 2. 3. 등 숫자 추출)
    const mentionedIndices = [...explanation.matchAll(/\b(\d+)\./g)]
      .map((m) => parseInt(m[1]) - 1)
      .filter((i) => i >= 0 && i < wardrobeItems.length);
    const uniqueIndices = [...new Set(mentionedIndices)];
    const suggestedItems = uniqueIndices.map((i) => wardrobeItems[i]).filter(Boolean);

    const rec = await prisma.outfitRecommendation.create({
      data: {
        userId: req.userId!,
        promptText: prompt,
        weatherData: useWeather ? ({} as object) : undefined,
        recommendedOutfitIds: [],
        aiExplanation: explanation,
      },
    });

    res.status(201).json({ recommendation: rec, suggestedItems: [suggestedItems], explanation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Recommendation create error:', msg);
    res.status(500).json({ message: '추천 생성 실패', detail: msg });
  }
});

recommendationRouter.post('/:id/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const rec = await prisma.outfitRecommendation.update({
      where: { id: req.params.id },
      data: { feedback: req.body.feedback },
    });
    res.json(rec);
  } catch {
    res.status(404).json({ message: '추천을 찾을 수 없습니다.' });
  }
});
