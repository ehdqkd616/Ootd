import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, CloudSun } from 'lucide-react';
import { api } from '@/lib/api';
import type { RecommendationResponse } from '@ootd/types';

export function Recommendations() {
  const [prompt, setPrompt] = useState('');
  const [useWeather, setUseWeather] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  const { data: history } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.recommendations.list({ limit: 20 }),
  });

  const recommendMutation = useMutation({
    mutationFn: () => api.recommendations.create({ prompt, useWeather }),
    onSuccess: (data) => {
      setResult(data);
      setPrompt('');
    },
  });

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

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <h2 className="font-semibold text-sm text-primary">AI 추천 결과</h2>
          <p className="text-sm leading-relaxed">{result.explanation}</p>
          {result.suggestedItems.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {result.suggestedItems.flat().slice(0, 4).map((item) => (
                <div key={item.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img
                    src={item.thumbnailUrl ?? item.originalImageUrl}
                    alt={item.name ?? ''}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history?.data && history.data.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">추천 이력</h2>
          <div className="space-y-2">
            {history.data.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">{rec.promptText}</p>
                {rec.aiExplanation && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.aiExplanation}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
