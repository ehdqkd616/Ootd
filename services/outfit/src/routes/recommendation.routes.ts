import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@ootd/db';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { getCurrentWeather, weatherToPrompt, type WeatherInfo } from '../services/weather.service';

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

// 추천 결과를 정해진 형식으로 받기 위한 도구 — 답변 본문의 숫자를 긁어 옷을 고르면
// AI가 쓴 번호 목록("1. 상의는...")까지 옷 번호로 오인해서 엉뚱한 옷이 뜬다.
const RECOMMEND_TOOL: Anthropic.Tool = {
  name: 'recommend_outfit',
  description: '옷장 목록에서 고른 코디와 그 설명을 반환한다.',
  input_schema: {
    type: 'object',
    properties: {
      item_numbers: {
        type: 'array',
        items: { type: 'integer' },
        description: '추천 코디에 쓰는 옷장 목록 번호 (목록에 있는 번호만). 옷장이 비었거나 맞는 옷이 없으면 빈 배열',
      },
      explanation: {
        type: 'string',
        description: '사용자에게 보여줄 추천 설명 (한국어). 고른 옷은 번호가 아니라 이름으로 언급. 화면에 그대로 표시되므로 마크다운 기호(**, # 등) 없이 일반 텍스트로, 문단은 줄바꿈으로 구분',
      },
    },
    required: ['item_numbers', 'explanation'],
  },
};

recommendationRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { prompt, useWeather, latitude, longitude } = req.body as {
    prompt?: string;
    useWeather?: boolean;
    latitude?: number;
    longitude?: number;
  };
  if (!prompt?.trim()) return res.status(400).json({ message: '어떤 상황인지 입력해 주세요.' });

  try {
    // 사용자 옷장 아이템 조회
    const wardrobeItems = await prisma.clothingItem.findMany({
      where: { userId: req.userId!, isArchived: false },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });

    let weather: WeatherInfo | null = null;
    if (useWeather) {
      try {
        weather = await getCurrentWeather(latitude, longitude);
      } catch (err) {
        // 날씨 조회가 실패해도 추천은 계속한다
        console.error('Weather fetch error:', err instanceof Error ? err.message : err);
      }
    }

    const itemList = wardrobeItems.length > 0
      ? wardrobeItems
          .map((item, i) =>
            `${i + 1}. ${item.name ?? '이름없음'} (카테고리: ${item.category ?? '미분류'}${item.brand ? `, 브랜드: ${item.brand}` : ''}${item.colorTags?.length ? `, 색상: ${item.colorTags.join('/')}` : ''}${item.seasonTags?.length ? `, 계절: ${item.seasonTags.join('/')}` : ''})`
          )
          .join('\n')
      : '등록된 옷이 없습니다.';

    const systemPrompt = `당신은 패션 스타일리스트입니다. 사용자의 옷장 목록을 보고 상황에 맞는 코디를 추천해주세요.
설명은 반드시 한국어로, 친근하고 구체적으로 써주세요.
옷장에 있는 옷으로 코디를 구성하고, 부족한 아이템이 있으면 설명에서 함께 제안해주세요.
옷장이 비어 있으면 추천할 수 없다고 하지 말고, 상황에 맞는 코디를 일반 아이템(색상·소재·핏 포함)으로 바로 추천한 뒤
마지막에 "옷장에 옷을 등록하면 내 옷으로 코디를 짜드려요" 정도의 안내를 한 문장만 덧붙여주세요.
날씨 정보가 주어지면 기온·강수에 맞는 두께와 아이템(겉옷, 우산 등)을 반영해주세요.
결과는 recommend_outfit 도구로 반환하세요.`;

    const weatherLine = useWeather
      ? `\n\n[날씨]\n${weather ? weatherToPrompt(weather) : '날씨 정보를 가져오지 못했습니다. 계절에 맞게 추천해주세요.'}`
      : '';
    const userMessage = `[내 옷장 목록]\n${itemList}\n\n[상황/요청]\n${prompt.trim()}${weatherLine}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: 'tool', name: RECOMMEND_TOOL.name },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const input = (toolUse?.input ?? {}) as { item_numbers?: unknown; explanation?: unknown };
    const explanation = typeof input.explanation === 'string' ? input.explanation : '';
    if (!explanation) throw new Error(`추천 응답 형식 오류 (stop_reason: ${message.stop_reason})`);

    const numbers = Array.isArray(input.item_numbers) ? input.item_numbers : [];
    const suggestedItems = [...new Set(numbers)]
      .filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= wardrobeItems.length)
      .map((n) => wardrobeItems[n - 1]);

    const rec = await prisma.outfitRecommendation.create({
      data: {
        userId: req.userId!,
        promptText: prompt.trim(),
        weatherData: weather ? (weather as unknown as object) : undefined,
        recommendedOutfitIds: [],
        aiExplanation: explanation,
      },
    });

    res.status(201).json({ recommendation: rec, suggestedItems: [suggestedItems], explanation, weather });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Recommendation create error: Anthropic API 키가 유효하지 않습니다.');
      return res.status(503).json({ message: 'AI API 키가 유효하지 않아 추천할 수 없습니다. 관리자에게 문의해 주세요.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ message: '요청이 많아 잠시 후 다시 시도해 주세요.' });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Recommendation create error:', msg);
    res.status(500).json({ message: '추천 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
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
