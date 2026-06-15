import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function Register() {
  const { register, isRegistering, registerError } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register(form);
  };

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">OOTD</h1>
          <p className="mt-2 text-sm text-muted-foreground">무료로 시작하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {registerError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              회원가입 중 오류가 발생했습니다.
            </div>
          )}
          {[
            { field: 'name' as const, label: '이름', type: 'text', placeholder: '홍길동' },
            { field: 'email' as const, label: '이메일', type: 'email', placeholder: 'hello@example.com' },
            { field: 'password' as const, label: '비밀번호', type: 'password', placeholder: '8자 이상 입력' },
          ].map(({ field, label, type, placeholder }) => (
            <div key={field} className="space-y-1">
              <label className="text-sm font-medium">{label}</label>
              <input
                type={type}
                required
                value={form[field]}
                onChange={update(field)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={placeholder}
                minLength={field === 'password' ? 8 : undefined}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={isRegistering}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isRegistering ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link to="/auth/login" className="font-medium text-foreground underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
