import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Archive, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useWardrobe } from '@/hooks/useWardrobe';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';
import type { Category, ClothingItem } from '@ootd/types';

const CATEGORIES: { value: Category | 'all'; label: string; emoji: string }[] = [
  { value: 'all',       label: '전체',    emoji: '👗' },
  { value: 'top',       label: '상의',    emoji: '👕' },
  { value: 'bottom',    label: '하의',    emoji: '👖' },
  { value: 'outer',     label: '아우터',  emoji: '🧥' },
  { value: 'shoes',     label: '신발',    emoji: '👟' },
  { value: 'accessory', label: '액세서리', emoji: '👜' },
  { value: 'etc',       label: '기타',    emoji: '🏷️' },
];

const CATEGORY_MAP: Record<string, { label: string; emoji: string }> = Object.fromEntries(
  CATEGORIES.filter((c) => c.value !== 'all').map((c) => [c.value, { label: c.label, emoji: c.emoji }]),
);

const SEASON_OPTIONS = ['봄', '여름', '가을', '겨울'];
const COLOR_PRESETS = ['검정', '흰색', '회색', '네이비', '베이지', '브라운', '빨강', '파랑', '초록', '노랑', '분홍', '보라'];

// ─── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({
  item,
  onClose,
  onSave,
  onDelete,
  onArchive,
}: {
  item: ClothingItem;
  onClose: () => void;
  onSave: (data: Partial<ClothingItem>) => Promise<void>;
  onDelete: () => Promise<void>;
  onArchive: () => void;
}) {
  const [name, setName] = useState(item.name ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [colorTags, setColorTags] = useState<string[]>(item.colorTags ?? []);
  const [seasonTags, setSeasonTags] = useState<string[]>(item.seasonTags ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [colorInput, setColorInput] = useState('');

  const toggleTag = <T extends string>(list: T[], val: T, set: (v: T[]) => void) => {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const addColor = (color: string) => {
    const v = color.trim();
    if (v && !colorTags.includes(v)) setColorTags([...colorTags, v]);
    setColorInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name: name || undefined, category: (category || undefined) as Category | undefined, brand: brand || undefined, colorTags, seasonTags: seasonTags as ClothingItem['seasonTags'] });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`"${item.name ?? '이 아이템'}"을(를) 삭제할까요?`)) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">아이템 수정</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-4 p-5">
          {/* Image */}
          <img
            src={item.thumbnailUrl ?? item.originalImageUrl}
            alt={item.name ?? ''}
            className="h-28 w-28 shrink-0 rounded-xl object-cover border border-border"
          />

          {/* Fields */}
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <label className="text-xs font-medium text-muted-foreground">이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 검정 슬랙스"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">선택 안함</option>
                {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">브랜드</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="예: 유니클로"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="px-5 pb-3 space-y-3">
          {/* Color tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">색상</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleTag(colorTags, c, setColorTags)}
                  className={cn('rounded-full px-2.5 py-0.5 text-xs transition-colors', colorTags.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              <input
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addColor(colorInput)}
                placeholder="직접 입력 후 Enter"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={() => addColor(colorInput)} className="rounded-lg bg-secondary px-2 py-1 text-xs hover:bg-accent">추가</button>
            </div>
            {colorTags.filter((c) => !COLOR_PRESETS.includes(c)).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {colorTags.filter((c) => !COLOR_PRESETS.includes(c)).map((c) => (
                  <span key={c} className="flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {c}<button onClick={() => setColorTags(colorTags.filter((x) => x !== c))}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Season tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">시즌</label>
            <div className="mt-1 flex gap-1.5">
              {SEASON_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleTag(seasonTags, s, setSeasonTags)}
                  className={cn('rounded-full px-2.5 py-0.5 text-xs transition-colors', seasonTags.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
          <button
            onClick={() => { onArchive(); onClose(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            <Archive className="h-3.5 w-3.5" />
            보관
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────
function ItemCard({ item, onClick }: { item: ClothingItem; onClick: () => void }) {
  return (
    <div
      className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <div className="aspect-square bg-muted">
        <img
          src={item.thumbnailUrl ?? item.processedImageUrl ?? item.originalImageUrl}
          alt={item.name ?? '의류'}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-2">
        <p className="text-xs font-medium truncate">{item.name ?? '이름 없음'}</p>
        <p className="text-xs text-muted-foreground">{item.colorTags?.join(', ') || (CATEGORY_MAP[item.category ?? '']?.label ?? '-')}</p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rounded-full bg-background/80 backdrop-blur-sm p-1">
          <Pencil className="h-3 w-3 text-foreground" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export function Wardrobe() {
  const { items, total, isLoading, deleteItemAsync, archiveItem, updateItem } = useWardrobe();
  const { wardrobeFilters, setWardrobeFilters } = useAppStore();
  const [editItem, setEditItem] = useState<ClothingItem | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeCategory = wardrobeFilters.category;

  // 폴더(카테고리) 그룹핑 — "전체" 탭일 때만
  const grouped = (() => {
    if (activeCategory) return null;
    const map: Record<string, ClothingItem[]> = {};
    for (const item of items) {
      const key = item.category ?? 'etc';
      (map[key] ??= []).push(item);
    }
    return CATEGORIES.filter((c) => c.value !== 'all' && map[c.value as string]?.length)
      .map((c) => ({ ...c, items: map[c.value as string] ?? [] }));
  })();

  return (
    <>
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (data) => { await updateItem({ id: editItem.id, data }); }}
          onDelete={async () => { await deleteItemAsync(editItem.id); }}
          onArchive={() => archiveItem(editItem.id)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            내 옷장 <span className="text-muted-foreground text-lg font-normal">({total})</span>
          </h1>
          <Link
            to="/wardrobe/add"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            아이템 추가
          </Link>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="아이템 검색..."
              value={wardrobeFilters.search ?? ''}
              onChange={(e) => setWardrobeFilters({ search: e.target.value, page: 1 })}
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(({ value, label, emoji }) => (
              <button
                key={value}
                onClick={() => setWardrobeFilters({ category: value === 'all' ? undefined : value as Category, page: 1 })}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  (value === 'all' && !activeCategory) || value === activeCategory
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent',
                )}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground">아이템이 없습니다.</p>
            <Link to="/wardrobe/add" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              첫 아이템 추가하기
            </Link>
          </div>
        ) : grouped ? (
          // 폴더(카테고리) 그룹 뷰
          <div className="space-y-4">
            {grouped.map(({ value, label, emoji, items: catItems }) => {
              const isCollapsed = collapsed[value as string];
              return (
                <div key={value} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setCollapsed((p) => ({ ...p, [value as string]: !p[value as string] }))}
                    className="flex w-full items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="font-medium text-sm">{label}</span>
                    <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{catItems.length}</span>
                    <span className="ml-auto text-muted-foreground">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-3">
                      {catItems.map((item) => (
                        <ItemCard key={item.id} item={item} onClick={() => setEditItem(item)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // 단일 카테고리 그리드 뷰
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onClick={() => setEditItem(item)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
