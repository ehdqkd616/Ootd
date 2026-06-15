import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { api } from '@/lib/api';

export function OutfitFitting() {
  const { id } = useParams<{ id: string }>();

  const { data: outfit, refetch } = useQuery({
    queryKey: ['outfit', id],
    queryFn: () => api.outfits.get(id!),
    enabled: !!id,
  });

  const { data: images } = useQuery({
    queryKey: ['outfit-images', id],
    queryFn: () => api.outfits.getImages(id!),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.outfits.generateImage(id!, ['front', 'side', 'back']),
    onSuccess: () => {
      // Poll or subscribe via WebSocket for completion
      const poll = setInterval(async () => {
        await refetch();
        if (images && images.length > 0) clearInterval(poll);
      }, 3000);
      setTimeout(() => clearInterval(poll), 60_000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{outfit?.name ?? '코디 상세'}</h1>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {generateMutation.isPending ? 'AI 생성 중...' : 'AI 이미지 생성'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outfit items */}
        <div className="space-y-3">
          <h2 className="font-semibold">포함된 아이템</h2>
          <div className="grid grid-cols-4 gap-2">
            {outfit?.outfitItems?.map((oi) => (
              <div key={oi.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                {oi.clothingItem && (
                  <img
                    src={oi.clothingItem.thumbnailUrl ?? oi.clothingItem.originalImageUrl}
                    alt={oi.clothingItem.name ?? ''}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Generated images */}
        <div className="space-y-3">
          <h2 className="font-semibold">AI 생성 이미지</h2>
          {images && images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="aspect-[2/3] rounded-lg overflow-hidden border border-border">
                  <img src={img.imageUrl} alt={img.pose ?? 'pose'} className="h-full w-full object-cover" />
                  {img.pose && (
                    <p className="text-xs text-center text-muted-foreground py-1">
                      {img.pose === 'front' ? '정면' : img.pose === 'side' ? '측면' : '후면'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border text-muted-foreground">
              <Wand2 className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">AI 이미지 생성 버튼을 눌러보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
