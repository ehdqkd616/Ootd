import { Bell, Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/stores/app.store';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useAppStore();

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <div />
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="테마 전환"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={user.name ?? '프로필'}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {user?.name?.[0] ?? user?.email?.[0] ?? 'U'}
            </div>
          )}
          <button
            onClick={() => logout()}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
