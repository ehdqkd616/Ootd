import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, AlertCircle, Trash2, X, ZoomIn } from 'lucide-react';
import { api } from '@/lib/api';
import type { GeneratedImage } from '@ootd/api-client';

function ImageLightbox({ image, onClose }: { image: GeneratedImage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={onClose}>
      <button
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-h-[92vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.imageUrl}
          alt="착용 이미지"
          className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

export function OutfitFitting() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: outfit } = useQuery({
    queryKey: ['outfit', id],
    queryFn: () => api.outfits.get(id!),
    enabled: !!id,
  });

  const { data: images, refetch: refetchImages } = useQuery({
    queryKey: ['outfit-images', id],
    queryFn: () => api.outfits.getImages(id!),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.outfits.generateImage(id!, ['front']),
    onSuccess: async () => { await refetchImages(); },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.outfits.deleteAllImages(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfit-images', id] }),
  });

  const errorMsg = generateMutation.error
    ? (generateMutation.error as { response?: { data?: { message?: string } } })
        .response?.data?.message ?? '이미지 생성 중 오류가 발생했습니다.'
    : null;

  // 가장 최신 정면 이미지
  const frontImage = [...(images ?? [])].reverse().find((img) => img.pose === 'front')
    ?? images?.[images.length - 1];

  return (
    <>
      {lightboxOpen && frontImage && (
        <ImageLightbox image={frontImage} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="space-y-6">
        {/* 헤더 */}
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

        {generateMutation.isPending && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            아바타에 옷을 입히는 중입니다. 약 1~2분 소요됩니다...
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* 생성 이미지 (메인) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">AI 착용 이미지</h2>
              {frontImage && (
                <button
                  onClick={() => { if (confirm('생성된 이미지를 삭제할까요?')) deleteAllMutation.mutate(); }}
                  disabled={deleteAllMutation.isPending}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              )}
            </div>

            {frontImage ? (
              <div
                className="group relative rounded-2xl overflow-hidden border border-border cursor-zoom-in bg-muted"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={frontImage.imageUrl}
                  alt="착용 이미지"
                  className="w-full object-cover max-h-[70vh]"
                  style={{ objectPosition: 'top' }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                  <div className="rounded-full bg-background/80 backdrop-blur-sm p-3">
                    <ZoomIn className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 rounded-2xl border-2 border-dashed border-border text-muted-foreground">
                <Wand2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">아직 생성된 이미지가 없습니다</p>
                <p className="text-xs mt-1 opacity-70">위 버튼을 눌러 AI 이미지를 생성하세요</p>
              </div>
            )}
          </div>

          {/* 사이드: 구성 아이템 */}
          <div className="space-y-3">
            <h2 className="font-semibold">구성 아이템 ({outfit?.outfitItems?.length ?? 0}개)</h2>
            <div className="grid grid-cols-2 gap-2">
              {outfit?.outfitItems?.map((oi) => (
                <div key={oi.id} className="space-y-1">
                  <div className="aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                    {oi.clothingItem && (
                      <img
                        src={oi.clothingItem.thumbnailUrl ?? oi.clothingItem.originalImageUrl ?? ''}
                        alt={oi.clothingItem.name ?? ''}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="text-xs text-center truncate text-muted-foreground">
                    {oi.clothingItem?.name ?? '아이템'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
