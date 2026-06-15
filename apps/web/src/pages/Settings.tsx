import { useAppStore } from '@/stores/app.store';
import { useAuth } from '@/hooks/useAuth';

export function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useAppStore();

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="font-semibold border-b border-border pb-2">프로필</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
            {user?.name?.[0] ?? user?.email?.[0] ?? 'U'}
          </div>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="font-semibold border-b border-border pb-2">화면</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">테마</p>
            <p className="text-xs text-muted-foreground">화면 밝기 설정</p>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="system">시스템 설정</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </div>
      </section>

      {/* Language */}
      <section className="space-y-4">
        <h2 className="font-semibold border-b border-border pb-2">언어</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">언어 선택</p>
          <select className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm">
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="font-semibold border-b border-destructive/30 pb-2 text-destructive">위험 구역</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">계정 삭제</p>
            <p className="text-xs text-muted-foreground">모든 데이터가 영구적으로 삭제됩니다.</p>
          </div>
          <button className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors">
            계정 삭제
          </button>
        </div>
      </section>
    </div>
  );
}
