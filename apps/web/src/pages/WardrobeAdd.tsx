import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, Link as LinkIcon, X } from 'lucide-react';
import { useWardrobe } from '@/hooks/useWardrobe';
import { cn } from '@/lib/utils';

type Tab = 'upload' | 'url';

export function WardrobeAdd() {
  const navigate = useNavigate();
  const { upload, importUrl, isUploading } = useWardrobe();
  const [tab, setTab] = useState<Tab>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    await upload({ file: selectedFile });
    navigate('/wardrobe');
  };

  const handleImportUrl = async () => {
    if (!urlInput.trim()) return;
    await importUrl({ url: urlInput.trim() });
    navigate('/wardrobe');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">아이템 추가</h1>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([['upload', '이미지 업로드'], ['url', 'URL로 가져오기']] as [Tab, string][]).map(
          ([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {tab === 'upload' ? (
        <div className="space-y-4">
          {preview ? (
            <div className="relative">
              <img src={preview} alt="미리보기" className="w-full rounded-xl object-contain max-h-80 border border-border" />
              <button
                onClick={() => { setPreview(null); setSelectedFile(null); }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">이미지를 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WEBP · 최대 20MB</p>
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isUploading ? 'AI 분석 중...' : '업로드 및 분석'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">이미지 URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleImportUrl}
            disabled={!urlInput.trim() || isUploading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isUploading ? 'AI 분석 중...' : '가져오기 및 분석'}
          </button>
        </div>
      )}
    </div>
  );
}
