import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, AlertCircle, Trash2, X, ZoomIn, Check, PenLine } from 'lucide-react';
import { api } from '@/lib/api';
import {
  POSE_TEMPLATES,
  CUSTOM_POSE_ID,
  MAX_POSES_PER_REQUEST,
  MAX_CUSTOM_POSE_LENGTH,
  getPoseLabel,
} from '@ootd/types';
import type { GeneratedImage } from '@ootd/api-client';

const CUSTOM_POSE_EXAMPLES = [
  '카페 창가 의자에 앉아 커피잔을 들고 창밖을 보는 포즈',
  '한 손으로 머리를 쓸어넘기며 웃는 포즈',
  '계단에 걸터앉아 무릎에 팔을 올린 포즈',
  '횡단보도를 건너며 카메라를 돌아보는 스트리트 스냅',
];

function imageCaption(image: GeneratedImage) {
  const custom = image.generationParams?.customPose;
  return image.pose === CUSTOM_POSE_ID && typeof custom === 'string' ? custom : getPoseLabel(image.pose);
}

function ImageLightbox({ image, onClose }: { image: GeneratedImage; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={onClose}>
      <button
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-h-[92vh] max-w-[92vw] space-y-2" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.imageUrl}
          alt="착용 이미지"
          className="max-h-[84vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
        />
        <p className="text-center text-sm text-white/80">{imageCaption(image)}</p>
      </div>
    </div>
  );
}

export function OutfitFitting() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPoses, setSelectedPoses] = useState<string[]>(['front']);
  const [customPose, setCustomPose] = useState('');
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

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

  const trimmedCustomPose = customPose.trim();
  const requestCount = selectedPoses.length + (trimmedCustomPose ? 1 : 0);

  const generateMutation = useMutation({
    mutationFn: () => api.outfits.generateImage(id!, selectedPoses, trimmedCustomPose || undefined),
    onSuccess: async () => {
      // 새로 만든 이미지가 메인에 보이도록 선택을 비운다 (비어 있으면 최신 이미지를 보여준다)
      setActiveImageId(null);
      await refetchImages();
    },
  });

  const deleteOneMutation = useMutation({
    mutationFn: (imageId: string) => api.outfits.deleteImage(id!, imageId),
    onSuccess: () => {
      setActiveImageId(null);
      return queryClient.invalidateQueries({ queryKey: ['outfit-images', id] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.outfits.deleteAllImages(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfit-images', id] }),
  });

  const errorMsg = generateMutation.error
    ? (generateMutation.error as { response?: { data?: { message?: string } } })
        .response?.data?.message ?? '이미지 생성 중 오류가 발생했습니다.'
    : null;

  // 최신 이미지가 앞에 오도록
  const gallery = [...(images ?? [])].reverse();
  const activeImage = gallery.find((img) => img.id === activeImageId) ?? gallery[0];

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  const togglePose = (poseId: string) => {
    setSelectedPoses((prev) => {
      if (prev.includes(poseId)) return prev.filter((p) => p !== poseId);
      const limit = MAX_POSES_PER_REQUEST - (trimmedCustomPose ? 1 : 0);
      return prev.length >= limit ? prev : [...prev, poseId];
    });
  };

  const canGenerate = requestCount > 0 && requestCount <= MAX_POSES_PER_REQUEST && !generateMutation.isPending;

  return (
    <>
      {lightboxOpen && activeImage && (
        <ImageLightbox image={activeImage} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{outfit?.name ?? '코디 상세'}</h1>
        </div>

        {/* 포즈 선택 */}
        <section className="space-y-4 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">포즈 고르기</h2>
            <p className="text-xs text-muted-foreground">
              템플릿과 직접 입력을 합쳐 한 번에 최대 {MAX_POSES_PER_REQUEST}장까지 만들 수 있어요
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {POSE_TEMPLATES.map((t) => {
              const selected = selectedPoses.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => togglePose(t.id)}
                  disabled={generateMutation.isPending}
                  aria-pressed={selected}
                  className={`relative flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                    selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60'
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5" aria-hidden>{t.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-muted-foreground line-clamp-2">{t.description}</span>
                  </span>
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label htmlFor="custom-pose" className="flex items-center gap-1.5 text-sm font-medium">
              <PenLine className="h-4 w-4" />
              원하는 포즈 직접 적기 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </label>
            <textarea
              id="custom-pose"
              value={customPose}
              onChange={(e) => setCustomPose(e.target.value.slice(0, MAX_CUSTOM_POSE_LENGTH))}
              disabled={generateMutation.isPending}
              rows={2}
              placeholder="예) 벤치에 앉아 한쪽 다리를 올리고 휴대폰을 보는 포즈"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {CUSTOM_POSE_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setCustomPose(ex)}
                  disabled={generateMutation.isPending}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {customPose.length}/{MAX_CUSTOM_POSE_LENGTH}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              자세·표정·카메라 각도·배경을 적어주세요. 옷은 코디에 담긴 옷 그대로 입혀요.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {requestCount > MAX_POSES_PER_REQUEST && (
              <span className="text-xs text-destructive">
                최대 {MAX_POSES_PER_REQUEST}장까지 가능해요. 템플릿 선택을 줄여주세요.
              </span>
            )}
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {generateMutation.isPending
                ? 'AI 생성 중...'
                : requestCount > 0
                  ? `AI 이미지 ${requestCount}장 생성`
                  : '포즈를 골라주세요'}
            </button>
          </div>
        </section>

        {generateMutation.isPending && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            아바타 사진과 옷 사진으로 착장 샷을 만드는 중입니다. 포즈 한 장에 1분 정도 걸려요
            {requestCount > 1 ? ` (총 ${requestCount}장)` : ''}...
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
              <h2 className="font-semibold">
                AI 착용 이미지{gallery.length > 0 && ` (${gallery.length})`}
              </h2>
              {activeImage && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { if (confirm('이 이미지를 삭제할까요?')) deleteOneMutation.mutate(activeImage.id); }}
                    disabled={deleteOneMutation.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                  {gallery.length > 1 && (
                    <button
                      onClick={() => { if (confirm('생성된 이미지를 모두 삭제할까요?')) deleteAllMutation.mutate(); }}
                      disabled={deleteAllMutation.isPending}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              )}
            </div>

            {activeImage ? (
              <>
                <div
                  className="group relative rounded-2xl overflow-hidden border border-border cursor-zoom-in bg-muted"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={activeImage.imageUrl}
                    alt="착용 이미지"
                    className="w-full object-cover max-h-[70vh]"
                    style={{ objectPosition: 'top' }}
                  />
                  <div className="absolute left-3 bottom-3 max-w-[80%] truncate rounded-full bg-background/80 backdrop-blur-sm px-3 py-1 text-xs font-medium">
                    {imageCaption(activeImage)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                    <div className="rounded-full bg-background/80 backdrop-blur-sm p-3">
                      <ZoomIn className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setActiveImageId(img.id)}
                        title={imageCaption(img)}
                        className={`shrink-0 w-20 space-y-1 text-left ${img.id === activeImage.id ? '' : 'opacity-70 hover:opacity-100'}`}
                      >
                        <div
                          className={`aspect-[3/4] rounded-lg overflow-hidden border-2 bg-muted ${
                            img.id === activeImage.id ? 'border-primary' : 'border-transparent'
                          }`}
                        >
                          <img src={img.imageUrl} alt={imageCaption(img)} className="h-full w-full object-cover object-top" />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{imageCaption(img)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 rounded-2xl border-2 border-dashed border-border text-muted-foreground">
                <Wand2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">아직 생성된 이미지가 없습니다</p>
                <p className="text-xs mt-1 opacity-70">위에서 포즈를 고르고 AI 이미지를 생성하세요</p>
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
