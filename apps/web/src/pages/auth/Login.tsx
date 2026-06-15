import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function Login() {
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">OOTD</h1>
          <p className="mt-2 text-sm text-muted-foreground">나만의 AI 코디 플래너</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              이메일 또는 비밀번호가 올바르지 않습니다.
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="hello@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isLoggingIn ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link to="/auth/register" className="font-medium text-foreground underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
