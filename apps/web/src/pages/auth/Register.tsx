import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/lib/api';

export function Register() {
  const { register, isRegistering, isRegistered, registerError } = useAuth();
  const [form, setForm] = useState({ name: '', loginId: '', password: '', passwordConfirm: '', signupNote: '' });
  const [agree, setAgree] = useState({ terms: false, privacy: false });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!agree.terms || !agree.privacy) {
      setLocalError('이용약관과 개인정보 처리방침에 동의해 주세요.');
      return;
    }
    setLocalError(null);
    register({
      name: form.name,
      loginId: form.loginId,
      password: form.password,
      signupNote: form.signupNote.trim() || undefined,
      agreeTerms: true,
      agreePrivacy: true,
    });
  };

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
              placeholder: '영문·숫자·_·- 3~32자',
              autoComplete: 'username',
              pattern: '[A-Za-z0-9_\-]{3,32}',
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
          <div className="space-y-1">
            <label className="text-sm font-medium">
              가입 메모 <span className="font-normal text-muted-foreground">(선택) — 사용 목적 등을 남기면 승인이 빨라요</span>
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={form.signupNote}
              onChange={update('signupNote')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <details className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">이용약관 · 개인정보 처리방침 보기</summary>
            <p className="mt-2">
              <b>이용약관</b> — 승인된 회원에게 옷장 관리·코디 추천·가상 피팅 기능을 제공합니다. 권리가 없는 사진을 올리거나 불법적인
              목적으로 사용할 수 없고, 남용 시 이용이 정지될 수 있습니다.
            </p>
            <p className="mt-2">
              <b>개인정보 처리방침</b> — 수집 항목: 아이디, 이름, 가입 메모, 접속 기록, 올린 옷·아바타 사진. 이용 목적: 회원 관리와
              서비스 제공. 탈퇴를 원하면 관리자에게 요청하세요.
            </p>
          </details>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />
            이용약관에 동의합니다 (필수)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
            개인정보 수집·이용에 동의합니다 (필수)
          </label>
          <button
            type="submit"
            disabled={isRegistering || !agree.terms || !agree.privacy}
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
