import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';

export function Outfits() {
  const { data, isLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api.outfits.list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">코디</h1>
        <Link
          to="/outfits/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          새 코디
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : data?.data.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {data.data.map((outfit) => (
            <Link
              key={outfit.id}
              to={`/outfits/${outfit.id}/fitting`}
              className="group rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                {outfit.generatedImages?.[0] ? (
                  <img
                    src={outfit.generatedImages[0].imageUrl}
                    alt={outfit.name ?? '코디'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">이미지 없음</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">{outfit.name ?? '이름 없는 코디'}</p>
                <p className="text-xs text-muted-foreground">
                  아이템 {outfit.outfitItems?.length ?? 0}개
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">저장된 코디가 없습니다.</p>
          <Link
            to="/outfits/new"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            첫 코디 만들기
          </Link>
        </div>
      )}
    </div>
  );
}
