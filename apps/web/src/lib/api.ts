import { OotdApiClient } from '@ootd/api-client';
import { devLogger } from './dev-logger';

export const api = new OotdApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
);

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
