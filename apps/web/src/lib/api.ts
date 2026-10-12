import { OotdApiClient } from '@ootd/api-client';
import { devLogger } from './dev-logger';
import { useAppStore } from '@/stores/app.store';

export const api = new OotdApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
);

// 세션이 끝나면 (승인 취소·계정 삭제 포함) 로그인 화면으로 — ProtectedRoute가 user를 보고 이동시킨다
api.onAuthExpired = () => useAppStore.getState().clearAuth();

/** 서버 에러 응답의 message를 꺼낸다 (없으면 fallback) */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: unknown } } }).response?.data;
    if (typeof data?.message === 'string') return data.message;
  }
  return fallback;
}

if (import.meta.env.DEV) {
  api.http.interceptors.response.use(
    (r) => r,
    (err: unknown) => {
      if (err && typeof err === 'object' && 'config' in err) {
        const e = err as { config?: { url?: string; method?: string }; response?: { status?: number; data?: unknown }; message?: string };
        const method = (e.config?.method ?? 'GET').toUpperCase();
        const url = e.config?.url ?? '';
        const status = e.response?.status;
        const msg = `${method} ${url} → ${status ?? e.message ?? 'ECONNREFUSED'}`;
        const detail = e.response?.data ? JSON.stringify(e.response.data, null, 2) : e.message;
        devLogger.push('error', msg, detail);
      }
      return Promise.reject(err);
    },
  );
}
