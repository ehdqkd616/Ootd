import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/app.store';

export function Dashboard() {
  const { user } = useAppStore();

  const { data: wardrobe } = useQuery({
    queryKey: ['wardrobe', { limit: 4 }],
    queryFn: () => api.wardrobe.list({ limit: 4 }),
  });

  const { data: outfits } = useQuery({
    queryKey: ['outfits', { limit: 4 }],
    queryFn: () => api.outfits.list({ limit: 4 }),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', { limit: 3 }],
    queryFn: () => api.recommendations.list({ limit: 3 }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          안녕하세요, {user?.name ?? ''}님 👋
        </h1>
        <p className="text-muted-foreground mt-1">오늘도 멋진 하루 되세요!</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/wardrobe/add"
          className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-accent transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">옷 추가하기</p>
            <p className="text-xs text-muted-foreground">새 아이템을 옷장에 등록</p>
          </div>
        </Link>
        <Link
          to="/recommendations"
          className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-accent transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">코디 추천 받기</p>
            <p className="text-xs text-muted-foreground">AI가 오늘의 코디를 골라드려요</p>
          </div>
        </Link>
      </div>

      {/* Recent wardrobe */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">최근 추가한 옷</h2>
          <Link to="/wardrobe" className="text-sm text-muted-foreground hover:text-foreground">
            전체 보기
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {wardrobe?.data.length ? (
            wardrobe.data.map((item) => (
              <div key={item.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                <img
                  src={item.thumbnailUrl ?? item.originalImageUrl}
                  alt={item.name ?? '의류'}
                  className="h-full w-full object-cover"
                />
              </div>
            ))
          ) : (
            <p className="col-span-4 text-sm text-muted-foreground py-8 text-center">
              아직 등록된 옷이 없습니다.
            </p>
          )}
        </div>
      </section>

      {/* Recent recommendations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">최근 AI 추천</h2>
          <Link to="/recommendations" className="text-sm text-muted-foreground hover:text-foreground">
            전체 보기
          </Link>
        </div>
        <div className="space-y-3">
          {recommendations?.data.length ? (
            recommendations.data.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium truncate">{rec.promptText}</p>
                {rec.aiExplanation && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {rec.aiExplanation}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              아직 추천 이력이 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
