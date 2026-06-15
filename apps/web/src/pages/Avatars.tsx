import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { UserCircle, Upload, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function Avatars() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState('');

  const { data: avatars, isLoading } = useQuery({
    queryKey: ['avatars'],
    queryFn: () => api.avatars.list(),
  });

  const createMutation = useMutation({
    mutationFn: ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append('photo', file);
      return api.avatars.create(formData, { name: name || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      setShowUpload(false);
      setName('');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.avatars.setDefault(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
  });

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) createMutation.mutate({ file: files[0] });
    },
    [createMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">아바타</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Upload className="h-4 w-4" />
          아바타 추가
        </button>
      </div>

      {showUpload && (
        <div className="rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold">새 아바타 만들기</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="아바타 이름 (선택)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm">인물 사진을 업로드하세요</p>
            <p className="text-xs text-muted-foreground mt-1">얼굴이 잘 보이는 정면 사진 권장</p>
          </div>
          {createMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground">AI 아바타 생성 중...</p>
          )}
        </div>
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
            <div key={avatar.id} className="group relative rounded-xl border border-border overflow-hidden">
              <div className="aspect-[3/4] bg-muted">
                {avatar.avatarBaseUrl ? (
                  <img src={avatar.avatarBaseUrl} alt={avatar.name ?? '아바타'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <UserCircle className="h-16 w-16 text-muted-foreground opacity-30" />
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between">
                <p className="text-xs font-medium truncate">{avatar.name ?? '아바타'}</p>
                <button
                  onClick={() => setDefaultMutation.mutate(avatar.id)}
                  title="기본 아바타로 설정"
                  className={cn('h-5 w-5', avatar.isDefault ? 'text-yellow-500' : 'text-muted-foreground')}
                >
                  <Star className="h-4 w-4" fill={avatar.isDefault ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <UserCircle className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
          <p className="text-muted-foreground">아직 아바타가 없습니다.</p>
          <p className="text-sm text-muted-foreground mt-1">인물 사진을 업로드해서 나만의 아바타를 만들어보세요!</p>
        </div>
      )}
    </div>
  );
}
