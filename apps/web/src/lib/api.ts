import { OotdApiClient } from '@ootd/api-client';

export const api = new OotdApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
);
