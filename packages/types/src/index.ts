// ===== User =====
export interface User {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  isVerified: boolean;
  provider: 'email' | 'google' | 'kakao' | 'apple';
  createdAt: string;
  updatedAt: string;
}

// ===== Auth =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface SocialLoginRequest {
  code: string;
  redirectUri: string;
}

// ===== Clothing Items =====
export type Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'accessory' | 'etc';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Style = 'casual' | 'formal' | 'sporty' | 'street' | 'vintage' | 'minimal';

export interface ClothingItem {
  id: string;
  userId: string;
  name: string | null;
  category: Category | null;
  subcategory: string | null;
  colorTags: string[];
  seasonTags: Season[];
  styleTags: Style[];
  brand: string | null;
  sourceUrl: string | null;
  originalImageUrl: string;
  processedImageUrl: string | null;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClothingItemRequest {
  name?: string;
  category?: Category;
  subcategory?: string;
  colorTags?: string[];
  seasonTags?: Season[];
  styleTags?: Style[];
  brand?: string;
}

export interface WardrobeFilter {
  category?: Category;
  search?: string;
  colorTags?: string[];
  seasonTags?: Season[];
  styleTags?: Style[];
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

// ===== Avatar =====
export interface Avatar {
  id: string;
  userId: string;
  name: string | null;
  sourceImageUrl: string;
  avatarBaseUrl: string | null;
  fullBodyUrl: string | null;
  upperBodyUrl: string | null;
  lowerBodyUrl: string | null;
  bodyParams: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAvatarRequest {
  name?: string;
  bodyParams?: Record<string, unknown>;
}

// ===== Outfit =====
export interface Outfit {
  id: string;
  userId: string;
  avatarId: string | null;
  name: string | null;
  description: string | null;
  tags: string[];
  isPublic: boolean;
  outfitItems?: OutfitItem[];
  generatedImages?: GeneratedImage[];
  createdAt: string;
  updatedAt: string;
}

export interface OutfitItem {
  id: string;
  outfitId: string;
  clothingItemId: string;
  layerOrder: number;
  positionData: Record<string, unknown> | null;
  clothingItem?: ClothingItem;
}

export interface CreateOutfitRequest {
  name?: string;
  description?: string;
  tags?: string[];
  avatarId?: string;
  isPublic?: boolean;
  items: Array<{
    clothingItemId: string;
    layerOrder: number;
    positionData?: Record<string, unknown>;
  }>;
}

// ===== Generated Images =====
export type Pose = 'front' | 'side' | 'back' | 'sitting';

export interface GeneratedImage {
  id: string;
  outfitId: string;
  avatarId: string;
  pose: Pose | null;
  imageUrl: string;
  generationParams: Record<string, unknown> | null;
  createdAt: string;
}

// ===== AI Job =====
export interface AIJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: GeneratedImage[];
  error?: string;
}

// ===== Recommendation =====
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  city: string;
  icon: string;
}

export interface OutfitRecommendation {
  id: string;
  userId: string;
  promptText: string | null;
  weatherData: WeatherData | null;
  recommendedOutfitIds: string[];
  aiExplanation: string | null;
  feedback: 'liked' | 'disliked' | 'neutral' | null;
  createdAt: string;
}

export interface RecommendationRequest {
  prompt: string;
  useWeather?: boolean;
  city?: string;
}

export interface RecommendationResponse {
  recommendation: OutfitRecommendation;
  suggestedItems: ClothingItem[][];
  explanation: string;
}

// ===== Common =====
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}

export interface SuccessResponse<T = void> {
  success: true;
  data: T;
}

// ===== WebSocket Events =====
export type WSEventType = 'job_progress' | 'job_complete' | 'job_failed';

export interface WSEvent {
  type: WSEventType;
  jobId: string;
  progress?: number;
  images?: GeneratedImage[];
  error?: string;
}
