import { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { UserCircle, Upload, Star, Pencil, Trash2, X, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Avatar } from '@ootd/types';

// ─── 신체 정보 타입 ───────────────────────────────────────────────────────────
interface BodyParams {
  gender?: string;
  height?: number;
  weight?: number;
  bodyType?: string;
  skinTone?: string;
}

const GENDER_OPTIONS = [
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
  { value: 'nonbinary', label: '논바이너리' },
];
const BODY_TYPE_OPTIONS = [
  { value: 'slim', label: '슬림' },
  { value: 'standard', label: '표준' },
  { value: 'plus', label: '플러스' },
];
const SKIN_TONE_OPTIONS = [
  { value: 'light', label: '밝음' },
  { value: 'medium', label: '보통' },
  { value: 'dark', label: '어두움' },
];

// ─── 공통: 라디오 칩 그룹 ──────────────────────────────────────────────────
function ChipGroup({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? '' : o.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === o.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 신체 정보 폼 ─────────────────────────────────────────────────────────────
function BodyParamsForm({ value, onChange }: { value: BodyParams; onChange: (v: BodyParams) => void }) {
  const set = (key: keyof BodyParams, val: unknown) => onChange({ ...value, [key]: val || undefined });

  return (
    <div className="space-y-4">
      <ChipGroup label="성별" options={GENDER_OPTIONS} value={value.gender ?? ''} onChange={(v) => set('gender', v)} />
      <ChipGroup label="체형" options={BODY_TYPE_OPTIONS} value={value.bodyType ?? ''} onChange={(v) => set('bodyType', v)} />
      <ChipGroup label="피부톤" options={SKIN_TONE_OPTIONS} value={value.skinTone ?? ''} onChange={(v) => set('skinTone', v)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">키 (cm)</p>
          <input
            type="number"
            min={100} max={250}
            value={value.height ?? ''}
            onChange={(e) => set('height', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="예: 165"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">몸무게 (kg)</p>
          <input
            type="number"
            min={30} max={300}
            value={value.weight ?? ''}
            onChange={(e) => set('weight', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="예: 55"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 업로드 패널 ──────────────────────────────────────────────────────────────
function UploadPanel({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (file: File, name: string, bodyParams: BodyParams) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [bodyParams, setBodyParams] = useState<BodyParams>({});
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!file) return;
    setSaving(true);
    await onCreate(file, name, bodyParams);
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">새 아바타 추가</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>

      {/* 사진 업로드 */}
      {preview ? (
        <div className="relative w-40 mx-auto">
          <img src={preview} alt="미리보기" className="w-full aspect-[3/4] object-cover rounded-xl border border-border" />
          <button
            onClick={() => { setPreview(null); setFile(null); }}
            className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">인물 사진 업로드</p>
          <p className="text-xs text-muted-foreground mt-1">얼굴이 잘 보이는 정면 전신 사진 권장</p>
        </div>
      )}

      {/* 이름 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">아바타 이름</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 내 아바타, 여름 룩"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* 신체 정보 */}
      <BodyParamsForm value={bodyParams} onChange={setBodyParams} />

      <button
        onClick={handleSubmit}
        disabled={!file || saving}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? '저장 중...' : '아바타 만들기'}
      </button>
    </div>
  );
}

// ─── 사진 유형 업로드 슬롯 ───────────────────────────────────────────────────
type PhotoType = 'fullBody' | 'upperBody' | 'lowerBody';

const PHOTO_SLOTS: { type: PhotoType; label: string; desc: string; field: keyof Avatar }[] = [
  { type: 'fullBody',   label: '전신',   desc: '머리부터 발끝', field: 'fullBodyUrl'  },
  { type: 'upperBody',  label: '상반신', desc: '허리 위',       field: 'upperBodyUrl' },
  { type: 'lowerBody',  label: '하반신', desc: '허리 아래',     field: 'lowerBodyUrl' },
];

function PhotoSlot({
  label, desc, currentUrl, onUpload, uploading,
}: {
  label: string; desc: string;
  currentUrl: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative w-full aspect-[3/4] rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
            <Upload className="h-5 w-5 opacity-40" />
            <span className="text-[10px]">{uploading ? '업로드 중...' : '사진 추가'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">
            업로드 중...
          </div>
        )}
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── 수정 모달 ────────────────────────────────────────────────────────────────
function EditModal({ avatar, onClose, onSave, onDelete, onSetDefault, onUploadPhoto }: {
  avatar: Avatar;
  onClose: () => void;
  onSave: (name: string, bodyParams: BodyParams) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetDefault: () => void;
  onUploadPhoto: (type: PhotoType, file: File) => Promise<void>;
}) {
  const bp = (avatar.bodyParams ?? {}) as BodyParams;
  const [name, setName] = useState(avatar.name ?? '');
  const [bodyParams, setBodyParams] = useState<BodyParams>({
    gender: bp.gender, height: bp.height, weight: bp.weight,
    bodyType: bp.bodyType, skinTone: bp.skinTone,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);
  const [localPhotos, setLocalPhotos] = useState<Partial<Record<PhotoType, string>>>({
    fullBody: avatar.fullBodyUrl ?? undefined,
    upperBody: avatar.upperBodyUrl ?? undefined,
    lowerBody: avatar.lowerBodyUrl ?? undefined,
  });

  const handlePhotoUpload = async (type: PhotoType, file: File) => {
    setUploadingType(type);
    try {
      await onUploadPhoto(type, file);
      const url = URL.createObjectURL(file);
      setLocalPhotos((prev) => ({ ...prev, [type]: url }));
    } finally {
      setUploadingType(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(name, bodyParams);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`"${avatar.name ?? '이 아바타'}"를 삭제할까요?`)) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  };

  const displayUrl = avatar.avatarBaseUrl ?? avatar.sourceImageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">아바타 수정</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* 사진 + 이름 */}
          <div className="flex gap-4">
            <div className="shrink-0 space-y-1">
              <img
                src={displayUrl ?? ''}
                alt={avatar.name ?? '아바타'}
                className="h-32 w-24 rounded-xl object-cover border border-border"
              />
              {avatar.avatarBaseUrl !== avatar.sourceImageUrl && (
                <p className="text-[10px] text-center text-primary">AI 전신</p>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">이름</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="아바타 이름"
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {!avatar.isDefault && (
                <button
                  onClick={() => { onSetDefault(); onClose(); }}
                  className="flex items-center gap-1.5 text-xs text-yellow-600 hover:text-yellow-500"
                >
                  <Star className="h-3.5 w-3.5" />
                  기본 아바타로 설정
                </button>
              )}
              {avatar.isDefault && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <Star className="h-3.5 w-3.5" fill="currentColor" /> 기본 아바타
                </span>
              )}
            </div>
          </div>

          {/* 신체 정보 */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium mb-3">신체 정보</p>
            <BodyParamsForm value={bodyParams} onChange={setBodyParams} />
          </div>

          {/* 사진 유형별 업로드 */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium mb-1">피팅용 사진</p>
            <p className="text-xs text-muted-foreground mb-3">
              카테고리별 사진을 올리면 더 정확한 가상 피팅 결과를 얻을 수 있어요.
              상의 피팅 → 상반신 사진, 하의 피팅 → 하반신 사진, 전체 코디 → 전신 사진이 사용됩니다.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {PHOTO_SLOTS.map((slot) => (
                <PhotoSlot
                  key={slot.type}
                  label={slot.label}
                  desc={slot.desc}
                  currentUrl={localPhotos[slot.type] ?? (avatar[slot.field] as string | null)}
                  onUpload={(file) => handlePhotoUpload(slot.type, file)}
                  uploading={uploadingType === slot.type}
                />
              ))}
            </div>
          </div>

          {/* 안내 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400">팁</p>
            <p className="text-xs text-amber-700 dark:text-amber-500">
              사진은 정면으로 서 있는 포즈가 가장 좋습니다. 배경이 단색일수록 합성 품질이 올라갑니다.
            </p>
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

// ─── 아바타 카드 ──────────────────────────────────────────────────────────────
function AvatarCard({ avatar, onEdit }: { avatar: Avatar; onEdit: () => void }) {
  const bp = (avatar.bodyParams ?? {}) as BodyParams;
  const bodyLabel = [
    bp.gender ? GENDER_OPTIONS.find((o) => o.value === bp.gender)?.label : null,
    bp.height ? `${bp.height}cm` : null,
    bp.weight ? `${bp.weight}kg` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onEdit}
    >
      <div className="aspect-[3/4] bg-muted">
        {avatar.avatarBaseUrl || avatar.sourceImageUrl ? (
          <img
            src={avatar.avatarBaseUrl ?? avatar.sourceImageUrl}
            alt={avatar.name ?? '아바타'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <UserCircle className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
        )}
      </div>

      {avatar.isDefault && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-medium text-yellow-900">
          <Star className="h-2.5 w-2.5" fill="currentColor" /> 기본
        </div>
      )}

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rounded-full bg-background/80 backdrop-blur-sm p-1.5">
          <Pencil className="h-3 w-3" />
        </div>
      </div>

      <div className="p-2.5">
        <p className="text-xs font-medium truncate">{avatar.name ?? '이름 없음'}</p>
        {bodyLabel && <p className="text-xs text-muted-foreground mt-0.5 truncate">{bodyLabel}</p>}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export function Avatars() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [editAvatar, setEditAvatar] = useState<Avatar | null>(null);

  const { data: avatars, isLoading } = useQuery({
    queryKey: ['avatars'],
    queryFn: () => api.avatars.list(),
  });

  const createMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string; bodyParams: BodyParams }) => {
      const formData = new FormData();
      formData.append('photo', file);
      return api.avatars.create(formData, { name: name || undefined });
    },
    onSuccess: (newAvatar, { bodyParams }) => {
      if (Object.keys(bodyParams).length > 0) {
        return api.avatars.update(newAvatar.id, { bodyParams: bodyParams as Record<string, unknown> })
          .then(() => queryClient.invalidateQueries({ queryKey: ['avatars'] }));
      }
      return queryClient.invalidateQueries({ queryKey: ['avatars'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, bodyParams }: { id: string; name: string; bodyParams: BodyParams }) =>
      api.avatars.update(id, { name, bodyParams: bodyParams as Record<string, unknown> }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.avatars.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.avatars.setDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ id, type, file }: { id: string; type: PhotoType; file: File }) =>
      api.avatars.uploadPhoto(id, type, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
  });

  return (
    <>
      {editAvatar && (
        <EditModal
          avatar={editAvatar}
          onClose={() => setEditAvatar(null)}
          onSave={async (name, bodyParams) => {
            await updateMutation.mutateAsync({ id: editAvatar.id, name, bodyParams });
          }}
          onDelete={async () => { await deleteMutation.mutateAsync(editAvatar.id); }}
          onSetDefault={() => setDefaultMutation.mutate(editAvatar.id)}
          onUploadPhoto={async (type, file) => {
            await uploadPhotoMutation.mutateAsync({ id: editAvatar.id, type, file });
          }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            아바타 <span className="text-muted-foreground text-lg font-normal">({avatars?.length ?? 0})</span>
          </h1>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            아바타 추가
          </button>
        </div>

        {showUpload && (
          <UploadPanel
            onClose={() => setShowUpload(false)}
            onCreate={async (file, name, bodyParams) => {
              await createMutation.mutateAsync({ file, name, bodyParams });
              setShowUpload(false);
            }}
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : avatars?.length ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {avatars.map((avatar) => (
              <AvatarCard key={avatar.id} avatar={avatar} onEdit={() => setEditAvatar(avatar)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <UserCircle className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">아직 아바타가 없습니다.</p>
            <p className="text-sm text-muted-foreground mt-1">인물 사진을 업로드해서 나만의 아바타를 만들어보세요!</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              첫 아바타 만들기
            </button>
          </div>
        )}
      </div>
    </>
  );
}
