import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/lib/api';

export function Register() {
  const { register, isRegistering, isRegistered, registerError } = useAuth();
  const [form, setForm] = useState({ name: '', loginId: '', password: '', passwordConfirm: '' });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLocalError(null);
    register({ name: form.name, loginId: form.loginId, password: form.password });
  };

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (isRegistered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-3xl font-bold">OOTD</h1>
          <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-6">
            <p className="font-medium">가입 신청이 완료됐어요</p>
            <p className="text-sm text-muted-foreground">관리자 승인 후 로그인하실 수 있어요.</p>
          </div>
          <Link
            to="/auth/login"
            className="inline-block w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
  }

  const error = localError ?? (registerError ? errorMessage(registerError, '회원가입 중 오류가 발생했습니다.') : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">OOTD</h1>
          <p className="mt-2 text-sm text-muted-foreground">가입 후 관리자 승인을 받으면 이용할 수 있어요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
          {[
            { field: 'name' as const, label: '이름', type: 'text', placeholder: '홍길동', autoComplete: 'name' },
            {
              field: 'loginId' as const,
              label: '아이디',
              type: 'text',
              placeholder: '영문 소문자로 시작, 4~20자 영문·숫자',
              autoComplete: 'username',
              pattern: '[a-z][a-z0-9]{3,19}',
            },
            { field: 'password' as const, label: '비밀번호', type: 'password', placeholder: '8자 이상 입력', autoComplete: 'new-password', minLength: 8 },
            { field: 'passwordConfirm' as const, label: '비밀번호 확인', type: 'password', placeholder: '한 번 더 입력', autoComplete: 'new-password', minLength: 8 },
          ].map(({ field, label, type, placeholder, autoComplete, pattern, minLength }) => (
            <div key={field} className="space-y-1">
              <label className="text-sm font-medium">{label}</label>
              <input
                type={type}
                required
                value={form[field]}
                onChange={update(field)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={placeholder}
                autoComplete={autoComplete}
                autoCapitalize="none"
                pattern={pattern}
                title={pattern ? placeholder : undefined}
                minLength={minLength}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={isRegistering}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isRegistering ? '가입 중...' : '가입 신청'}
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
