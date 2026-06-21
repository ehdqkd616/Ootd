import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shirt, X, Check, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Outfit } from '@ootd/types';

// ─── 수정 모달 ────────────────────────────────────────────────────────────────
function EditModal({ outfit, onClose, onSave, onDelete }: {
  outfit: Outfit;
  onClose: () => void;
  onSave: (name: string, description: string, tags: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(outfit.name ?? '');
  const [description, setDescription] = useState(outfit.description ?? '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>((outfit.tags as string[]) ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSave = async () => {
    setSaving(true);
    await onSave(name, description, tags);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`"${outfit.name ?? '이 코디'}"를 삭제할까요?`)) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  };

  const thumb = (outfit.generatedImages as { imageUrl: string }[] | undefined)?.[0]?.imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">코디 수정</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 썸네일 */}
          {thumb && (
            <div className="w-24 h-32 rounded-xl overflow-hidden border border-border mx-auto">
              <img src={thumb} alt={outfit.name ?? '코디'} className="w-full h-full object-cover" />
            </div>
          )}

          {/* 이름 */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">코디 이름</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="코디 이름을 입력하세요"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* 설명 */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">메모 (선택)</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 코디에 대한 메모를 남겨보세요"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* 태그 */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">태그</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                  {t}
                  <button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="태그 입력 후 Enter"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={addTag} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
                <Tag className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 아이템 목록 (읽기 전용) */}
          {(outfit.outfitItems as { id: string; clothingItem: { name: string | null; category: string | null } }[] | undefined)?.length ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">구성 아이템 ({outfit.outfitItems?.length}개)</p>
              <div className="space-y-1">
                {(outfit.outfitItems as { id: string; clothingItem: { name: string | null; category: string | null } }[]).map((oi) => (
                  <div key={oi.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5">
                    <Shirt className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{oi.clothingItem.name ?? '아이템'}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{oi.clothingItem.category ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? '삭제 중...' : '삭제'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 코디 카드 ─────────────────────────────────────────────────────────────────
function OutfitCard({ outfit, onEdit }: { outfit: Outfit; onEdit: () => void }) {
  const navigate = useNavigate();
  const thumb = (outfit.generatedImages as { imageUrl: string }[] | undefined)?.[0]?.imageUrl;
  const tags = (outfit.tags as string[]) ?? [];

  return (
    <div className="group relative rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
      {/* 이미지 영역 - 클릭하면 피팅 페이지 */}
      <div
        className="aspect-[3/4] bg-muted cursor-pointer"
        onClick={() => navigate(`/outfits/${outfit.id}/fitting`)}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={outfit.name ?? '코디'}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center flex-col gap-2">
            <Shirt className="h-10 w-10 text-muted-foreground opacity-30" />
            <span className="text-xs text-muted-foreground">이미지 없음</span>
          </div>
        )}

        {/* 호버 시 편집/삭제 버튼 */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded-full bg-background/85 backdrop-blur-sm p-1.5 hover:bg-background shadow-sm"
            title="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="p-2.5">
        <p className="font-medium text-sm truncate">{outfit.name ?? '이름 없는 코디'}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground">아이템 {outfit.outfitItems?.length ?? 0}개</p>
          {tags.length > 0 && (
            <div className="flex gap-1">
              {tags.slice(0, 2).map((t) => (
                <span key={t} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px]">{t}</span>
              ))}
              {tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export function Outfits() {
  const queryClient = useQueryClient();
  const [editOutfit, setEditOutfit] = useState<Outfit | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api.outfits.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, description, tags }: { id: string; name: string; description: string; tags: string[] }) =>
      api.outfits.update(id, { name, description, tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.outfits.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['recent-outfits'] });
    },
  });

  const outfits = data?.data ?? [];

  return (
    <>
      {editOutfit && (
        <EditModal
          outfit={editOutfit}
          onClose={() => setEditOutfit(null)}
          onSave={async (name, description, tags) => {
            await updateMutation.mutateAsync({ id: editOutfit.id, name, description, tags });
          }}
          onDelete={async () => { await deleteMutation.mutateAsync(editOutfit.id); }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            코디 <span className="text-muted-foreground text-lg font-normal">({outfits.length})</span>
          </h1>
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
        ) : outfits.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                onEdit={() => setEditOutfit(outfit)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Shirt className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">저장된 코디가 없습니다.</p>
            <Link
              to="/outfits/new"
              className={cn(
                'mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
              )}
            >
              첫 코디 만들기
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
