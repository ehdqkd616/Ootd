import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ClothingItem,
  CreateClothingItemRequest,
  WardrobeFilter,
  Avatar,
  CreateAvatarRequest,
  Outfit,
  CreateOutfitRequest,
  OutfitRecommendation,
  RecommendationRequest,
  RecommendationResponse,
  GeneratedImage,
  AIJob,
  PaginatedResponse,
} from '@ootd/types';

export class OotdApiClient {
  http: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.http = axios.create({ baseURL, withCredentials: true });

    this.http.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err.config as AxiosRequestConfig & { _retry?: boolean };
        if (err.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const { data } = await this.http.post<AuthResponse>('/auth/refresh');
            this.setAccessToken(data.accessToken);
            return this.http(original);
          } catch {
            this.clearAccessToken();
          }
        }
        return Promise.reject(err);
      },
    );
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  clearAccessToken() {
    this.accessToken = null;
  }

  // ===== Auth =====
  auth = {
    register: (body: RegisterRequest) =>
      this.http.post<AuthResponse>('/auth/register', body).then((r) => r.data),

    login: (body: LoginRequest) =>
      this.http.post<AuthResponse>('/auth/login', body).then((r) => r.data),

    logout: () => this.http.post('/auth/logout').then((r) => r.data),

    refresh: () =>
      this.http.post<AuthResponse>('/auth/refresh').then((r) => r.data),

    socialLogin: (provider: string, code: string, redirectUri: string) =>
      this.http
        .post<AuthResponse>(`/auth/social/${provider}`, { code, redirectUri })
        .then((r) => r.data),

    forgotPassword: (email: string) =>
      this.http.post('/auth/forgot-password', { email }).then((r) => r.data),

    resetPassword: (token: string, password: string) =>
      this.http.post('/auth/reset-password', { token, password }).then((r) => r.data),
  };

  // ===== Wardrobe =====
  wardrobe = {
    list: (filters?: WardrobeFilter) =>
      this.http
        .get<PaginatedResponse<ClothingItem>>('/wardrobe', { params: filters })
        .then((r) => r.data),

    get: (id: string) =>
      this.http.get<ClothingItem>(`/wardrobe/${id}`).then((r) => r.data),

    upload: (formData: FormData, meta?: CreateClothingItemRequest) =>
      this.http
        .post<ClothingItem>('/wardrobe', formData, { params: meta })
        .then((r) => r.data),

    importUrl: (sourceUrl: string, meta?: CreateClothingItemRequest) =>
      this.http
        .post<ClothingItem>('/wardrobe/import-url', { sourceUrl, ...meta })
        .then((r) => r.data),

    update: (id: string, body: Partial<CreateClothingItemRequest>) =>
      this.http.put<ClothingItem>(`/wardrobe/${id}`, body).then((r) => r.data),

    delete: (id: string) => this.http.delete(`/wardrobe/${id}`).then((r) => r.data),

    archive: (id: string) =>
      this.http.post(`/wardrobe/${id}/archive`).then((r) => r.data),
  };

  // ===== Avatars =====
  avatars = {
    list: () => this.http.get<Avatar[]>('/avatars').then((r) => r.data),

    get: (id: string) =>
      this.http.get<Avatar>(`/avatars/${id}`).then((r) => r.data),

    create: (formData: FormData, meta?: CreateAvatarRequest) =>
      this.http
        .post<Avatar>('/avatars', formData, { params: meta })
        .then((r) => r.data),

    update: (id: string, body: Partial<CreateAvatarRequest>) =>
      this.http.put<Avatar>(`/avatars/${id}`, body).then((r) => r.data),

    delete: (id: string) => this.http.delete(`/avatars/${id}`).then((r) => r.data),

    setDefault: (id: string) =>
      this.http.post(`/avatars/${id}/default`).then((r) => r.data),

    generateFullBody: (id: string) =>
      this.http.post<Avatar>(`/avatars/${id}/generate-fullbody`).then((r) => r.data),

    uploadPhoto: (id: string, photoType: 'fullBody' | 'upperBody' | 'lowerBody', file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('photoType', photoType);
      return this.http.post<Avatar>(`/avatars/${id}/photos`, formData).then((r) => r.data);
    },
  };

  // ===== Outfits =====
  outfits = {
    list: (params?: { page?: number; limit?: number; isPublic?: boolean }) =>
      this.http
        .get<PaginatedResponse<Outfit>>('/outfits', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.http.get<Outfit>(`/outfits/${id}`).then((r) => r.data),

    create: (body: CreateOutfitRequest) =>
      this.http.post<Outfit>('/outfits', body).then((r) => r.data),

    update: (id: string, body: Partial<CreateOutfitRequest>) =>
      this.http.put<Outfit>(`/outfits/${id}`, body).then((r) => r.data),

    delete: (id: string) => this.http.delete(`/outfits/${id}`).then((r) => r.data),

    generateImage: (id: string, poses?: string[]) =>
      this.http
        .post<AIJob>(`/outfits/${id}/generate`, { poses })
        .then((r) => r.data),

    getImages: (id: string) =>
      this.http.get<GeneratedImage[]>(`/outfits/${id}/images`).then((r) => r.data),

    deleteImage: (id: string, imageId: string) =>
      this.http.delete(`/outfits/${id}/images/${imageId}`).then((r) => r.data),

    deleteAllImages: (id: string) =>
      this.http.delete(`/outfits/${id}/images`).then((r) => r.data),

    getJob: (jobId: string) =>
      this.http.get<AIJob>(`/jobs/${jobId}`).then((r) => r.data),
  };

  // ===== Recommendations =====
  recommendations = {
    create: (body: RecommendationRequest) =>
      this.http
        .post<RecommendationResponse>('/recommendations', body)
        .then((r) => r.data),

    list: (params?: { page?: number; limit?: number }) =>
      this.http
        .get<PaginatedResponse<OutfitRecommendation>>('/recommendations', { params })
        .then((r) => r.data),

    feedback: (id: string, feedback: 'liked' | 'disliked' | 'neutral') =>
      this.http
        .post(`/recommendations/${id}/feedback`, { feedback })
        .then((r) => r.data),
  };
}

export * from '@ootd/types';
