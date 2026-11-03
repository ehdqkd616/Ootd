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
  { id: 'stairs_sitting', label: '계단에 걸터앉기', description: '계단이나 턱에 편하게 걸터앉은 포즈', emoji: '🪜' },
  { id: 'coffee', label: '커피 들고', description: '테이크아웃 커피를 들고 여유롭게 선 포즈', emoji: '☕' },
  { id: 'phone_walk', label: '휴대폰 보며 걷기', description: '휴대폰을 보며 걷는 일상 스냅', emoji: '📱' },
  { id: 'looking_away', label: '먼 곳 보기', description: '카메라 대신 먼 곳을 바라보는 화보 컷', emoji: '🌅' },
  { id: 'adjusting', label: '옷매무새 정리', description: '소매나 깃을 매만지는 자연스러운 순간', emoji: '🤏' },
  { id: 'laughing', label: '웃는 캔디드', description: '웃음이 터진 순간을 잡은 캔디드 컷', emoji: '😄' },
];

// 착장 샷 배경 — 한 번 생성할 때 배경 하나를 고르고 포즈 여러 개에 같이 적용한다
export const CUSTOM_BACKGROUND_ID = 'custom';
export const DEFAULT_BACKGROUND_ID = 'studio';
export const MAX_CUSTOM_BACKGROUND_LENGTH = 300;

export interface BackgroundTemplate {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  { id: 'studio', label: '스튜디오', description: '밝은 회색 무지 배경, 옷이 가장 잘 보여요', emoji: '⬜' },
  { id: 'warm_studio', label: '웜톤 스튜디오', description: '베이지 배경지와 창가 자연광', emoji: '🟫' },
  { id: 'city_street', label: '도심 거리', description: '빌딩과 횡단보도가 있는 도시 거리', emoji: '🏙️' },
  { id: 'alley', label: '골목길', description: '낮은 주택과 담장이 있는 감성 골목', emoji: '🏘️' },
  { id: 'cafe', label: '카페', description: '따뜻한 조명의 우드톤 카페', emoji: '☕' },
  { id: 'park', label: '공원 산책로', description: '나무 그늘이 진 공원 길', emoji: '🌳' },
  { id: 'riverside', label: '한강', description: '강변 산책로와 다리가 보이는 풍경', emoji: '🌉' },
  { id: 'beach', label: '바닷가', description: '모래사장과 수평선', emoji: '🏖️' },
  { id: 'gallery', label: '갤러리', description: '흰 벽과 작품이 걸린 미술관', emoji: '🖼️' },
  { id: 'subway', label: '지하철역', description: '타일 벽과 승강장 조명', emoji: '🚇' },
  { id: 'rooftop_sunset', label: '옥상 노을', description: '노을 지는 도시 옥상', emoji: '🌇' },
  { id: 'bookstore', label: '서점', description: '책장이 가득한 아늑한 서점', emoji: '📚' },
  { id: 'autumn_leaves', label: '단풍길', description: '낙엽이 깔린 가을 가로수길', emoji: '🍂' },
  { id: 'snowy_street', label: '눈 오는 거리', description: '눈이 소복이 쌓인 겨울 거리', emoji: '❄️' },
];

export function getBackgroundLabel(background: string | null | undefined): string | null {
  if (!background) return null;
  if (background === CUSTOM_BACKGROUND_ID) return '직접 입력';
  return BACKGROUND_TEMPLATES.find((t) => t.id === background)?.label ?? background;
}

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
  suggestedItemIds: string[];
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
