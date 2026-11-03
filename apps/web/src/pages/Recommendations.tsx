import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, CloudSun, Shirt } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { RecommendationResponse } from '@ootd/types';

// 브라우저 위치 (거부·미지원·5초 초과면 null → 서버가 서울 날씨 사용)
function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5_000, maximumAge: 30 * 60_000 },
    );
  });
}

export function Recommendations() {
  const [prompt, setPrompt] = useState('');
  const [useWeather, setUseWeather] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: history } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.recommendations.list({ limit: 20 }),
  });

  const recommendMutation = useMutation({
    mutationFn: async () => {
      const position = useWeather ? await getPosition() : null;
      return api.recommendations.create({ prompt, useWeather, ...position });
    },
    onSuccess: (data) => {
      setResult(data);
      setPrompt('');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  // 추천받은 옷들로 코디를 만들고(이미 있으면 그 코디) 착장 페이지로 이동
  const tryOnMutation = useMutation({
    mutationFn: (recommendationId: string) => api.recommendations.createOutfit(recommendationId),
    onSuccess: (outfit) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      navigate(`/outfits/${outfit.id}/fitting`);
    },
  });

  const tryOnButton = (recommendationId: string, size: 'sm' | 'md' = 'md') => {
    const busy = tryOnMutation.isPending && tryOnMutation.variables === recommendationId;
    return (
      <button
        type="button"
        onClick={() => tryOnMutation.mutate(recommendationId)}
        disabled={tryOnMutation.isPending}
        className={
          size === 'md'
            ? 'flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50'
            : 'flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50'
        }
      >
        <Shirt className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {busy ? '코디 만드는 중...' : '이 코디로 입어보기'}
      </button>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">AI 코디 추천</h1>

      {/* Input */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="오늘 어떤 상황인가요? (예: 중요한 미팅이 있어요, 비 오는 날 편하게 입고 싶어요)"
          rows={3}
          className="w-full resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useWeather}
              onChange={(e) => setUseWeather(e.target.checked)}
              className="rounded"
            />
            <CloudSun className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">현재 날씨 반영</span>
          </label>
          <button
            onClick={() => recommendMutation.mutate()}
            disabled={!prompt.trim() || recommendMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {recommendMutation.isPending ? '추천 중...' : '추천 받기'}
          </button>
        </div>
      </div>

      {recommendMutation.error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage(recommendMutation.error, '추천을 받지 못했습니다. 잠시 후 다시 시도해 주세요.')}
        </div>
      )}

      {tryOnMutation.error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage(tryOnMutation.error, '코디를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <h2 className="font-semibold text-sm text-primary">AI 추천 결과</h2>
          {result.weather && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CloudSun className="h-3.5 w-3.5" />
              {result.weather.locationLabel} · {result.weather.description} {result.weather.temperature}°C
              (최저 {result.weather.tempMin}° / 최고 {result.weather.tempMax}°) · 강수확률 {result.weather.precipitationProbability}%
            </p>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-line">{result.explanation}</p>
          {(result.suggestedItems?.length ?? 0) > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {(result.suggestedItems ?? []).flat().slice(0, 8).map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="aspect-square rounded-lg overflow-hidden border border-border">
                    <img
                      src={item.thumbnailUrl ?? item.originalImageUrl}
                      alt={item.name ?? ''}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {item.name && <p className="truncate text-xs text-muted-foreground">{item.name}</p>}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {(result.suggestedItems ?? []).flat().length > 0 ? (
              tryOnButton(result.recommendation.id)
            ) : (
              <p className="text-xs text-muted-foreground">옷장에 옷을 등록하면 추천받은 코디를 바로 입어볼 수 있어요.</p>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history?.data && history.data.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">추천 이력</h2>
          <div className="space-y-2">
            {history.data.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{rec.promptText}</p>
                  {rec.aiExplanation && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.aiExplanation}</p>
                  )}
                </div>
                {(rec.suggestedItemIds?.length ?? 0) > 0 && tryOnButton(rec.id, 'sm')}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
