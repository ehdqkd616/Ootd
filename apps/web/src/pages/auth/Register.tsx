import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function Register() {
  const { register, isRegistering, registerError } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== confirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLocalError(null);
    register({ ...form, username: form.username.trim() });
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
          {(localError || registerError) && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {localError ?? '회원가입 중 오류가 발생했습니다. 이미 사용 중인 아이디인지 확인해 주세요.'}
            </div>
          )}
          {[
            { field: 'name' as const, label: '이름', type: 'text', placeholder: '홍길동' },
            { field: 'username' as const, label: '아이디', type: 'text', placeholder: '영문·숫자·_·- 3~32자' },
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
                pattern={field === 'username' ? '[A-Za-z0-9_\\-]{3,32}' : undefined}
                title={field === 'username' ? '영문, 숫자, _, - 조합 3~32자' : undefined}
                autoCapitalize={field === 'username' ? 'none' : undefined}
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-sm font-medium">비밀번호 확인</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="비밀번호 재입력"
            />
          </div>
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
