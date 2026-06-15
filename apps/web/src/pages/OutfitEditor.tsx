import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWardrobe } from '@/hooks/useWardrobe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ClothingItem } from '@ootd/types';

export function OutfitEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items } = useWardrobe();
  const [selected, setSelected] = useState<ClothingItem[]>([]);
  const [name, setName] = useState('');

  const saveMutation = useMutation({
    mutationFn: () =>
      api.outfits.create({
        name: name || undefined,
        items: selected.map((item, i) => ({
          clothingItemId: item.id,
          layerOrder: i,
        })),
      }),
    onSuccess: (outfit) => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      navigate(`/outfits/${outfit.id}/fitting`);
    },
  });

  const toggle = (item: ClothingItem) => {
    setSelected((prev) =>
      prev.find((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item],
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">새 코디 만들기</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item selection */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold">옷장에서 선택</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => {
              const isSelected = !!selected.find((i) => i.id === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                    isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                  )}
                >
                  <img
                    src={item.thumbnailUrl ?? item.originalImageUrl}
                    alt={item.name ?? ''}
                    className="h-full w-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {selected.findIndex((i) => i.id === item.id) + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary panel */}
        <div className="space-y-4">
          <h2 className="font-semibold">선택한 아이템 ({selected.length})</h2>
          <div className="flex flex-wrap gap-2 min-h-24">
            {selected.map((item) => (
              <div key={item.id} className="h-16 w-16 rounded-lg overflow-hidden border border-border">
                <img src={item.thumbnailUrl ?? item.originalImageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">코디 이름 (선택)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 캐주얼 데이트룩"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={selected.length === 0 || saveMutation.isPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveMutation.isPending ? '저장 중...' : '코디 저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
