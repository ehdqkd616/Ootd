import { Link } from 'react-router-dom';
import { Plus, Search, Archive } from 'lucide-react';
import { useWardrobe } from '@/hooks/useWardrobe';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';
import type { Category } from '@ootd/types';

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'top', label: '상의' },
  { value: 'bottom', label: '하의' },
  { value: 'outer', label: '아우터' },
  { value: 'shoes', label: '신발' },
  { value: 'accessory', label: '액세서리' },
  { value: 'etc', label: '기타' },
];

export function Wardrobe() {
  const { items, total, isLoading } = useWardrobe();
  const { wardrobeFilters, setWardrobeFilters } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 옷장 <span className="text-muted-foreground text-lg font-normal">({total})</span></h1>
        <Link
          to="/wardrobe/add"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          아이템 추가
        </Link>
      </div>

      {/* Search & Filters */}
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
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                setWardrobeFilters({ category: value === 'all' ? undefined : value, page: 1 })
              }
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                (value === 'all' && !wardrobeFilters.category) ||
                  value === wardrobeFilters.category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group relative rounded-xl border border-border overflow-hidden">
              <div className="aspect-square">
                <img
                  src={item.thumbnailUrl ?? item.processedImageUrl ?? item.originalImageUrl}
                  alt={item.name ?? '의류'}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">{item.name ?? '이름 없음'}</p>
                <p className="text-xs text-muted-foreground">{item.category ?? '-'}</p>
              </div>
              <button
                className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm"
                title="보관함으로 이동"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">아이템이 없습니다.</p>
          <Link
            to="/wardrobe/add"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            첫 아이템 추가하기
          </Link>
        </div>
      )}
    </div>
  );
}
