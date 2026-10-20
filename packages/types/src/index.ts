// ===== User =====
export interface User {
  id: string;
  loginId: string;
  email: string | null;
  name: string | null;
  signupNote: string | null;
  profileImageUrl: string | null;
  isVerified: boolean;
  provider: 'email' | 'google' | 'kakao' | 'apple';
  isApproved: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Auth =====
export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface RegisterRequest {
  loginId: string;
  password: string;
  name: string;
  signupNote?: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

// 가입만 되고 토큰은 발급되지 않는다 — 관리자 승인 후 로그인
export interface RegisterResponse {
  user: User;
  pendingApproval: true;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
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
// 포즈 템플릿 id 또는 'custom'(사용자가 직접 적은 포즈). 템플릿이 늘어날 수 있어 문자열로 둔다.
export type Pose = string;

export const CUSTOM_POSE_ID = 'custom';
export const MAX_POSES_PER_REQUEST = 4;
export const MAX_CUSTOM_POSE_LENGTH = 300;

export interface PoseTemplate {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

// 착장 샷 포즈 템플릿 — 실제 이미지 모델용 영어 프롬프트는 outfit 서비스가 id로 들고 있다
export const POSE_TEMPLATES: PoseTemplate[] = [
  { id: 'front', label: '정면', description: '카메라를 보고 자연스럽게 선 기본 포즈', emoji: '🧍' },
  { id: 'three_quarter', label: '3/4 각도', description: '몸을 살짝 틀어 실루엣이 잘 보이는 각도', emoji: '↗️' },
  { id: 'side', label: '측면', description: '옆모습으로 핏과 기장 확인', emoji: '➡️' },
  { id: 'back', label: '뒷모습', description: '뒤태와 등 디테일 확인', emoji: '🔙' },
  { id: 'over_shoulder', label: '뒤돌아보기', description: '뒤돌아 어깨 너머로 카메라를 보는 포즈', emoji: '👀' },
  { id: 'walking', label: '걷기', description: '한 발 내딛으며 걷는 스트리트 스냅', emoji: '🚶' },
  { id: 'hands_in_pockets', label: '주머니에 손', description: '양손을 주머니에 넣은 캐주얼 포즈', emoji: '🫳' },
  { id: 'hand_on_hip', label: '한 손 허리', description: '한 손을 허리에 올린 화보 포즈', emoji: '💁' },
  { id: 'arms_crossed', label: '팔짱', description: '팔짱을 끼고 선 자신감 있는 포즈', emoji: '🙅' },
  { id: 'leaning_wall', label: '벽에 기대기', description: '벽에 어깨를 기댄 여유로운 포즈', emoji: '🧱' },
  { id: 'sitting', label: '앉은 포즈', description: '의자에 앉아 다리를 꼰 포즈', emoji: '🪑' },
  { id: 'crouching', label: '쪼그려 앉기', description: '스트리트 화보 느낌의 쪼그려 앉은 포즈', emoji: '🧎' },
];

export function getPoseLabel(pose: string | null | undefined): string {
  if (!pose) return '착장';
  if (pose === CUSTOM_POSE_ID) return '직접 입력';
  return POSE_TEMPLATES.find((t) => t.id === pose)?.label ?? pose;
}

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
  // 브라우저 위치 — 없으면 서버가 서울 날씨를 쓴다
  latitude?: number;
  longitude?: number;
}

export interface WeatherInfo {
  locationLabel: string;
  description: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  precipitationProbability: number;
  humidity: number;
  windSpeed: number;
}

export interface RecommendationResponse {
  recommendation: OutfitRecommendation;
  suggestedItems: ClothingItem[][];
  explanation: string;
  weather: WeatherInfo | null;
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
