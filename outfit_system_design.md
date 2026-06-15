# AI 기반 스마트 코디 플래너 — 시스템 설계서

**문서 버전:** 1.0  
**작성일:** 2026년 6월 15일  
**분류:** 내부 설계 문서

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 기능 요구사항](#2-핵심-기능-요구사항)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [기술 스택](#4-기술-스택)
5. [데이터베이스 설계](#5-데이터베이스-설계)
6. [API 설계](#6-api-설계)
7. [AI 파이프라인 설계](#7-ai-파이프라인-설계)
8. [보안 설계](#8-보안-설계)
9. [프론트엔드 설계](#9-프론트엔드-설계)
10. [인프라 및 배포 전략](#10-인프라-및-배포-전략)
11. [확장 계획 (모바일 앱)](#11-확장-계획-모바일-앱)
12. [개발 로드맵](#12-개발-로드맵)
13. [리스크 및 대응 방안](#13-리스크-및-대응-방안)

---

## 1. 프로젝트 개요

### 1.1 서비스 개요

**AI 기반 스마트 코디 플래너**는 사용자가 보유한 의류 아이템을 디지털화하고, AI 기술을 활용하여 개인 아바타에게 가상으로 착용해 볼 수 있는 패션 어시스턴트 서비스입니다. 단순한 의류 관리 앱을 넘어, AI가 사용자의 상황·기분·날씨에 맞는 코디를 추천하는 개인 맞춤형 스타일링 플랫폼을 지향합니다.

### 1.2 핵심 가치 제안

- **디지털 옷장 구축:** 실물 옷 또는 인터넷 이미지 링크로부터 개인 의류 아이템 라이브러리 생성
- **AI 가상 피팅:** 개인 아바타를 생성하여 다양한 코디 조합을 실제 착용 이미지로 시각화
- **스마트 코디 추천:** 텍스트 명령을 통해 상황·날씨·기분에 맞는 코디 자동 추천
- **코디 저장 및 관리:** 마음에 드는 코디 조합을 저장하고 재사용

### 1.3 목표 사용자

- 매일 옷 선택에 시간을 소비하는 직장인·학생
- 가진 옷을 다양하게 활용하고 싶은 패션 관심자
- 쇼핑 전 코디 시뮬레이션이 필요한 소비자

---

## 2. 핵심 기능 요구사항

### 2.1 기능 요구사항 (Functional Requirements)

#### F-01. 회원 인증 및 계정 관리
- 이메일/비밀번호 기반 회원가입 및 로그인
- 소셜 로그인 (Google, Kakao, Apple)
- JWT 기반 세션 관리 및 자동 갱신
- 비밀번호 재설정 (이메일 인증)
- 계정 삭제 및 데이터 완전 삭제 (개인정보보호법 준수)

#### F-02. 의류 아이템 등록 및 관리
- 사진 직접 업로드 (JPEG, PNG, WEBP, 최대 20MB)
- URL을 통한 이미지 가져오기 (크롤링)
- AI 자동 배경 제거 및 아이템 추출
- 카테고리 자동 분류 (상의, 하의, 아우터, 신발, 액세서리 등)
- 색상, 소재, 계절, 스타일 태그 자동 또는 수동 입력
- 아이템 편집, 삭제, 보관함 이동
- 아이템 검색 및 필터링

#### F-03. 아바타 생성
- 인물 사진 업로드를 통한 개인 아바타 생성
- AI 기반 체형 분석 및 아바타 모델링
- 다수의 아바타 프리셋 저장 (예: 봄/여름 체형, 겨울 레이어드 등)
- 아바타 수정 및 삭제

#### F-04. 가상 코디 시뮬레이션
- 선택한 의류 아이템을 아바타에 합성
- 다양한 포즈(정면, 측면, 후면 등) 이미지 자동 생성
- 코디 결과 이미지 저장 및 공유

#### F-05. 코디 조합 저장 및 관리
- 의류 아이템 조합을 "코디"로 저장
- 코디에 이름, 태그, 메모 추가
- 코디 컬렉션(폴더) 생성 및 관리
- 코디 공개/비공개 설정

#### F-06. AI 코디 추천
- 자연어 텍스트 입력 기반 추천 (예: "오늘 중요한 미팅이 있어", "비 오는 날 편하게 입을 옷")
- 날씨 API 연동을 통한 날씨 기반 추천
- 보유 아이템 내에서 최적 조합 추출
- 추천 이유 설명 제공
- 추천 결과 저장 또는 즉시 코디 생성

### 2.2 비기능 요구사항 (Non-Functional Requirements)

| 항목 | 요구사항 |
|------|----------|
| 성능 | API 응답 시간 < 500ms (AI 처리 제외), AI 이미지 생성 < 30초 |
| 가용성 | 서비스 가용성 99.5% 이상 |
| 확장성 | 동시 접속 사용자 10,000명 처리 가능한 수평 확장 구조 |
| 보안 | OWASP Top 10 대응, 개인 데이터 암호화 저장 |
| 접근성 | WCAG 2.1 AA 수준 준수 |
| 국제화 | 한국어/영어 다국어 지원 (초기) |

---

## 3. 시스템 아키텍처

### 3.1 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 레이어                        │
│  ┌──────────────────┐          ┌──────────────────────────┐  │
│  │   웹 앱 (React)  │          │  모바일 앱 (React Native) │  │
│  └────────┬─────────┘          └───────────┬──────────────┘  │
└───────────┼────────────────────────────────┼─────────────────┘
            │ HTTPS/REST & WebSocket         │
┌───────────▼────────────────────────────────▼─────────────────┐
│                       API Gateway / CDN                        │
│             (AWS CloudFront + API Gateway)                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      백엔드 서비스 레이어                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Auth       │ │  Wardrobe   │ │    AI Orchestration     │ │
│  │  Service    │ │  Service    │ │       Service           │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Avatar     │ │  Outfit     │ │   Recommendation        │ │
│  │  Service    │ │  Service    │ │       Service           │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                       데이터 레이어                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL  │  │    Redis     │  │    AWS S3        │   │
│  │  (주 DB)    │  │   (캐시)     │  │  (이미지 저장)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                       AI 서비스 레이어                          │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │  배경 제거 AI     │  │  가상 피팅 AI (이미지 생성 모델)  │  │
│  │  (Rembg / SAM)  │  │  (Stable Diffusion / FLUX)       │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │  LLM 추천 엔진   │  │  이미지 분류 AI (CLIP 등)        │  │
│  │  (Claude API)   │  │  (카테고리·색상·스타일 분석)      │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 마이크로서비스 구성

| 서비스 | 역할 | 기술 |
|--------|------|------|
| Auth Service | 인증·인가·세션 관리 | Node.js + Express |
| Wardrobe Service | 의류 아이템 CRUD | Node.js + Express |
| Avatar Service | 아바타 생성·관리 | Python + FastAPI |
| Outfit Service | 코디 저장·관리 | Node.js + Express |
| AI Orchestration Service | AI 파이프라인 조율 | Python + FastAPI |
| Recommendation Service | 코디 추천 로직 | Python + FastAPI |
| Notification Service | 이메일·푸시 알림 | Node.js |

---

## 4. 기술 스택

### 4.1 프론트엔드

| 항목 | 기술 선택 | 이유 |
|------|-----------|------|
| 프레임워크 | React 18 + TypeScript | 대규모 생태계, 강한 타입 안전성 |
| 상태 관리 | Zustand + React Query | 경량 전역 상태 + 서버 상태 관리 |
| 스타일링 | Tailwind CSS + shadcn/ui | 빠른 UI 개발, 일관성 |
| 빌드 도구 | Vite | 빠른 HMR, 최적화된 번들링 |
| 이미지 처리 | react-dropzone, browser-image-compression | 클라이언트 사이드 이미지 최적화 |
| 라우팅 | React Router v6 | 표준 SPA 라우팅 |
| 국제화 | react-i18next | 다국어 지원 |

### 4.2 백엔드

| 항목 | 기술 선택 | 이유 |
|------|-----------|------|
| 주 언어 | Node.js (TS) + Python | API 서버는 Node, AI 처리는 Python |
| API 프레임워크 | Express.js / FastAPI | 성숙도 높고 확장 용이 |
| ORM | Prisma (Node), SQLAlchemy (Python) | 타입 안전한 DB 쿼리 |
| 메시지 큐 | AWS SQS / BullMQ | 비동기 AI 작업 처리 |
| 인증 | JWT (Access + Refresh Token) | 무상태 인증, 토큰 갱신 전략 |

### 4.3 AI 및 ML

| 항목 | 기술 선택 | 이유 |
|------|-----------|------|
| 배경 제거 | Rembg (U2Net) / SAM2 | 오픈소스, 고품질 세그멘테이션 |
| 이미지 분류 | CLIP (OpenAI) | 의류 카테고리·스타일 분석 |
| 가상 피팅 | IDM-VTON / OOTDiffusion | 최신 가상 피팅 특화 모델 |
| 코디 추천 | Claude API (Anthropic) | 자연어 이해 및 추천 생성 |
| 아바타 생성 | IP-Adapter + ControlNet | 인물 특성 보존 이미지 생성 |

### 4.4 인프라 및 DevOps

| 항목 | 기술 선택 |
|------|-----------|
| 클라우드 | AWS (ECS, Lambda, S3, RDS, ElastiCache) |
| 컨테이너 | Docker + Docker Compose |
| 오케스트레이션 | AWS ECS Fargate (초기) → EKS (성장 후) |
| CI/CD | GitHub Actions |
| 모니터링 | AWS CloudWatch + Sentry + Datadog |
| CDN | AWS CloudFront |
| DNS / SSL | AWS Route53 + ACM |

---

## 5. 데이터베이스 설계

### 5.1 ERD 핵심 엔티티

#### Users (사용자)
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),          -- 소셜 로그인 시 NULL
  provider    VARCHAR(50) DEFAULT 'email',  -- email | google | kakao | apple
  provider_id VARCHAR(255),
  name        VARCHAR(100),
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ               -- Soft Delete
);
```

#### Clothing Items (의류 아이템)
```sql
CREATE TABLE clothing_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(200),
  category     VARCHAR(50),             -- top | bottom | outer | shoes | accessory | etc
  subcategory  VARCHAR(50),             -- t-shirt | pants | sneakers | ...
  color_tags   TEXT[],                  -- ['black', 'white']
  season_tags  TEXT[],                  -- ['spring', 'summer']
  style_tags   TEXT[],                  -- ['casual', 'formal']
  brand        VARCHAR(100),
  source_url   TEXT,                    -- 원본 이미지 URL (크롤링 시)
  original_image_url TEXT NOT NULL,     -- S3 원본 이미지
  processed_image_url TEXT,             -- 배경 제거 후 이미지 (S3)
  thumbnail_url TEXT,
  embedding    VECTOR(512),             -- CLIP 임베딩 (유사 아이템 검색용)
  metadata     JSONB DEFAULT '{}',
  is_archived  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### Avatars (아바타)
```sql
CREATE TABLE avatars (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100),
  source_image_url TEXT NOT NULL,       -- 원본 인물 사진
  avatar_base_url  TEXT,                -- 생성된 아바타 기본 이미지
  body_params   JSONB,                  -- 체형 파라미터
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### Outfits (코디)
```sql
CREATE TABLE outfits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  avatar_id   UUID REFERENCES avatars(id) ON DELETE SET NULL,
  name        VARCHAR(200),
  description TEXT,
  tags        TEXT[],
  is_public   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Outfit Items (코디-아이템 연결)
```sql
CREATE TABLE outfit_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id       UUID REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
  layer_order     INT DEFAULT 0,       -- 레이어링 순서
  position_data   JSONB                -- 착용 위치 메타데이터
);
```

#### Generated Images (AI 생성 이미지)
```sql
CREATE TABLE generated_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id   UUID REFERENCES outfits(id) ON DELETE CASCADE,
  avatar_id   UUID REFERENCES avatars(id),
  pose        VARCHAR(50),             -- front | side | back | sitting
  image_url   TEXT NOT NULL,
  generation_params JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Outfit Recommendations (추천 이력)
```sql
CREATE TABLE outfit_recommendations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_text   TEXT,                  -- 사용자 입력 텍스트
  weather_data  JSONB,                 -- 날씨 정보
  recommended_outfit_ids UUID[],
  ai_explanation TEXT,
  feedback      VARCHAR(20),           -- liked | disliked | neutral
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 인덱스 전략

```sql
-- 사용자별 아이템 조회 최적화
CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_clothing_items_category ON clothing_items(user_id, category);

-- 벡터 유사도 검색 (pgvector)
CREATE INDEX idx_clothing_embedding ON clothing_items 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 코디 조회 최적화
CREATE INDEX idx_outfits_user_id ON outfits(user_id);
CREATE INDEX idx_outfit_items_outfit_id ON outfit_items(outfit_id);
```

---

## 6. API 설계

### 6.1 RESTful API 엔드포인트 설계

모든 API는 `/api/v1` 접두사를 사용하며, 인증이 필요한 엔드포인트에는 `Bearer {accessToken}` 헤더가 필요합니다.

#### 인증 API
```
POST   /api/v1/auth/register          회원가입
POST   /api/v1/auth/login             로그인
POST   /api/v1/auth/logout            로그아웃
POST   /api/v1/auth/refresh           토큰 갱신
POST   /api/v1/auth/social/{provider} 소셜 로그인
POST   /api/v1/auth/forgot-password   비밀번호 재설정 요청
POST   /api/v1/auth/reset-password    비밀번호 재설정 확인
```

#### 의류 아이템 API
```
GET    /api/v1/wardrobe               아이템 목록 조회 (필터/검색/페이지네이션)
POST   /api/v1/wardrobe               아이템 등록 (이미지 업로드)
POST   /api/v1/wardrobe/import-url    URL로 아이템 가져오기
GET    /api/v1/wardrobe/:id           아이템 상세 조회
PUT    /api/v1/wardrobe/:id           아이템 수정
DELETE /api/v1/wardrobe/:id           아이템 삭제
POST   /api/v1/wardrobe/:id/archive   아이템 보관
```

#### 아바타 API
```
GET    /api/v1/avatars                아바타 목록
POST   /api/v1/avatars                아바타 생성 (사진 업로드)
GET    /api/v1/avatars/:id            아바타 상세
PUT    /api/v1/avatars/:id            아바타 수정
DELETE /api/v1/avatars/:id            아바타 삭제
POST   /api/v1/avatars/:id/default    기본 아바타 설정
```

#### 코디 API
```
GET    /api/v1/outfits                코디 목록 조회
POST   /api/v1/outfits                코디 저장
GET    /api/v1/outfits/:id            코디 상세
PUT    /api/v1/outfits/:id            코디 수정
DELETE /api/v1/outfits/:id            코디 삭제
POST   /api/v1/outfits/:id/generate   AI 코디 이미지 생성 요청
GET    /api/v1/outfits/:id/images     생성된 이미지 목록
```

#### AI 추천 API
```
POST   /api/v1/recommendations        자연어 기반 추천 요청
GET    /api/v1/recommendations        추천 이력 조회
POST   /api/v1/recommendations/:id/feedback  추천 피드백
```

### 6.2 AI 작업 비동기 처리 (WebSocket)

AI 이미지 생성은 처리 시간이 수십 초이므로 비동기 패턴을 사용합니다.

```
1. 클라이언트 → POST /api/v1/outfits/:id/generate
   → 응답: { jobId: "job_xxx", status: "queued" }

2. 클라이언트 ← WebSocket 연결 (ws://api/ws?token=...)
   ← 이벤트: { type: "job_progress", jobId, progress: 50 }
   ← 이벤트: { type: "job_complete", jobId, images: [...] }
   ← 이벤트: { type: "job_failed", jobId, error: "..." }

3. 또는 Polling: GET /api/v1/jobs/:jobId
```

---

## 7. AI 파이프라인 설계

### 7.1 의류 아이템 처리 파이프라인

```
[사용자 이미지 업로드]
        ↓
[이미지 유효성 검사]
  - 파일 형식 확인 (JPEG/PNG/WEBP)
  - 크기 제한 (최대 20MB)
  - 이미지 내 인물/의류 감지
        ↓
[전처리]
  - 이미지 리사이징 (최대 2048px)
  - 색상 보정 및 정규화
        ↓
[배경 제거 (Rembg/SAM2)]
  - 의류 영역 세그멘테이션
  - 투명 배경 PNG 생성
        ↓
[의류 분석 (CLIP + Custom Classifier)]
  - 카테고리 분류 (상의/하의/아우터 등)
  - 서브카테고리 분류 (티셔츠/청바지 등)
  - 주요 색상 추출
  - 스타일 태그 생성 (캐주얼/포멀 등)
  - 계절 적합성 분석
  - CLIP 임베딩 벡터 생성
        ↓
[결과 저장]
  - 원본/처리된 이미지 → S3 업로드
  - 메타데이터 → PostgreSQL 저장
  - 임베딩 → pgvector 저장
        ↓
[사용자에게 결과 반환]
```

### 7.2 아바타 생성 파이프라인

```
[인물 사진 업로드]
        ↓
[얼굴 감지 및 인물 검출]
  - MediaPipe / InsightFace
        ↓
[아바타 기본 포즈 생성]
  - IP-Adapter: 인물 외형 특성 추출
  - ControlNet (OpenPose): 포즈 제어
  - 정면/측면/후면 기본 포즈 생성
        ↓
[아바타 품질 검증]
  - FaceID 유사도 검사
  - 이미지 품질 평가
        ↓
[저장 및 반환]
```

### 7.3 가상 피팅 파이프라인

```
[코디 조합 입력]
  (아바타 이미지 + 의류 아이템들)
        ↓
[의류 레이어링 순서 결정]
  - 속옷 → 상의 → 하의 → 아우터 → 액세서리
        ↓
[가상 피팅 AI 실행 (IDM-VTON / OOTDiffusion)]
  - 각 의류 아이템을 순차적으로 아바타에 합성
  - 피팅 품질 및 자연스러운 주름 생성
        ↓
[다중 포즈 이미지 생성]
  - 정면 포즈
  - 측면 포즈
  - 후면 포즈
  - 캐주얼 포즈 (손 포켓 등)
        ↓
[후처리 및 품질 향상]
  - ESRGAN 기반 해상도 향상
  - 색상 보정
        ↓
[이미지 저장 및 반환]
  - S3 업로드
  - 생성 이미지 URL 반환
```

### 7.4 코디 추천 파이프라인

```
[사용자 요청]
  - 자연어 텍스트 (예: "오늘 데이트가 있어, 세련되게 입고 싶어")
  - 날씨 정보 (선택)
        ↓
[컨텍스트 수집]
  - 현재 날씨 API 호출 (OpenWeatherMap)
  - 사용자 보유 아이템 목록 조회
  - 이전 코디 이력 및 피드백 조회
        ↓
[Claude API 호출]
  System: "너는 패션 전문가야. 사용자의 보유 아이템과 상황을 분석해서
           최적의 코디를 추천해줘."
  User: "{텍스트} | 보유 아이템: {아이템 목록} | 날씨: {날씨 정보}"
        ↓
[추천 결과 파싱]
  - 추천 아이템 ID 추출
  - 추천 이유 텍스트 추출
        ↓
[결과 반환]
  - 추천 코디 조합 (아이템 ID 목록)
  - AI 설명 텍스트
  - 즉시 가상 피팅 이미지 생성 옵션
```

---

## 8. 보안 설계

### 8.1 인증 및 인가

**JWT 이중 토큰 전략:**
- **Access Token:** 만료 시간 15분, 메모리에만 저장 (localStorage 미사용)
- **Refresh Token:** 만료 시간 30일, HttpOnly Secure Cookie 저장
- **토큰 로테이션:** Refresh Token 사용 시 새 Refresh Token 발급 (탈취 감지)
- **Redis 블랙리스트:** 로그아웃된 토큰 즉시 무효화

**권한 관리:**
- 모든 API는 사용자 ID를 기준으로 데이터 접근 제어
- 타인의 아이템/아바타/코디 접근 불가 (공개 설정 제외)
- 관리자 역할 (Role) 구분

### 8.2 데이터 보호

- 비밀번호: bcrypt 해싱 (cost factor 12)
- 저장 데이터: AWS RDS 암호화 at-rest
- 전송 데이터: TLS 1.3 전용 (HTTP → HTTPS 강제 리다이렉트)
- S3 버킷: 퍼블릭 접근 차단, Presigned URL로만 접근
- 개인정보(이메일 등): AES-256 암호화 저장 검토

### 8.3 입력 검증 및 보안 헤더

- 모든 API 입력값 화이트리스트 기반 검증 (zod/joi)
- SQL Injection 방지: Parameterized Query (Prisma ORM)
- XSS 방지: Content Security Policy (CSP) 헤더
- CSRF 방지: SameSite=Strict Cookie + CSRF 토큰
- 업로드 이미지: 파일 타입 매직 바이트 검증, 악성 코드 스캔

### 8.4 Rate Limiting

| API 그룹 | 제한 |
|----------|------|
| 인증 API | 10 req/min/IP |
| 이미지 업로드 | 20 req/hour/user |
| AI 이미지 생성 | 10 req/hour/user |
| 코디 추천 | 30 req/hour/user |
| 일반 API | 100 req/min/user |

### 8.5 개인정보 보호

- 개인정보보호법 및 GDPR 준수
- 계정 삭제 시 모든 개인 데이터 완전 삭제 (이미지 포함)
- 사용자 업로드 이미지를 AI 모델 학습에 무단 사용 금지
- 데이터 처리 방침 및 이용약관 명시

---

## 9. 프론트엔드 설계

### 9.1 주요 페이지 구성

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 랜딩 | `/` | 서비스 소개, 회원가입 유도 |
| 회원가입/로그인 | `/auth/*` | 인증 관련 페이지 |
| 대시보드 | `/dashboard` | 최근 코디, 추천, 요약 |
| 옷장 | `/wardrobe` | 의류 아이템 관리 |
| 아이템 등록 | `/wardrobe/add` | 이미지 업로드/URL 가져오기 |
| 코디 | `/outfits` | 코디 목록 |
| 코디 편집기 | `/outfits/new` | 드래그앤드롭 코디 조합 |
| 가상 피팅 | `/outfits/:id/fitting` | AI 이미지 생성 및 확인 |
| 아바타 | `/avatars` | 아바타 관리 |
| 추천 | `/recommendations` | AI 코디 추천 채팅 인터페이스 |
| 설정 | `/settings` | 계정·알림·개인정보 설정 |

### 9.2 핵심 UI/UX 원칙

- **모바일 우선 반응형 디자인** (320px ~ 1920px 지원)
- **직관적인 드래그앤드롭** 코디 편집기
- **실시간 진행 상황 표시** AI 이미지 생성 중 로딩 UI
- **오프라인 지원** (Service Worker, 기본 기능 캐싱)
- **다크 모드 지원**
- **접근성:** 키보드 네비게이션, 스크린 리더 지원

### 9.3 상태 관리 구조

```typescript
// 전역 상태 (Zustand)
interface AppStore {
  user: User | null;
  activeAvatar: Avatar | null;
  wardrobeFilters: WardrobeFilter;
}

// 서버 상태 (React Query)
const { data: wardrobeItems } = useQuery({
  queryKey: ['wardrobe', { category, search }],
  queryFn: () => fetchWardrobeItems({ category, search }),
  staleTime: 5 * 60 * 1000,  // 5분 캐시
});
```

---

## 10. 인프라 및 배포 전략

### 10.1 AWS 인프라 구성

```
VPC (Private Subnet + Public Subnet)
├── Public Subnet
│   ├── Application Load Balancer
│   └── NAT Gateway
├── Private Subnet (App)
│   ├── ECS Fargate (백엔드 서비스들)
│   └── ECS Fargate (AI 서비스들 - GPU 인스턴스)
└── Private Subnet (Data)
    ├── RDS PostgreSQL (Multi-AZ)
    └── ElastiCache Redis (Cluster)

S3 버킷
├── outfit-app-user-images (사용자 업로드)
├── outfit-app-processed-images (처리된 이미지)
└── outfit-app-generated-images (AI 생성 이미지)

CloudFront
├── 정적 웹 앱 배포 (React SPA)
└── S3 이미지 CDN
```

### 10.2 CI/CD 파이프라인

```
GitHub Push (main/develop)
        ↓
GitHub Actions
  ├── 코드 품질 검사 (ESLint, TypeScript)
  ├── 단위 테스트 (Jest, Pytest)
  ├── 통합 테스트
  ├── 보안 스캔 (SAST, 의존성 취약점)
  └── Docker 이미지 빌드 및 ECR 푸시
        ↓
배포 (Blue/Green)
  ├── Staging 환경 자동 배포
  ├── 스모크 테스트
  └── Production 수동 승인 후 배포
```

### 10.3 AI 모델 서빙 전략

| 모델 | 서빙 방법 | 인스턴스 타입 |
|------|-----------|---------------|
| 배경 제거 (Rembg) | ECS + GPU | AWS g4dn.xlarge |
| CLIP 이미지 분류 | AWS Lambda (경량화) | - |
| 가상 피팅 AI | ECS + GPU + SQS 큐 | AWS g4dn.2xlarge |
| 아바타 생성 | ECS + GPU | AWS g4dn.xlarge |
| LLM 추천 | Claude API (외부) | - |

비용 최적화를 위해 AI GPU 인스턴스는 SQS 큐 길이에 따라 Auto Scaling 적용.

---

## 11. 확장 계획 (모바일 앱)

### 11.1 모바일 앱 전략

웹 서비스 안정화 후 **React Native**를 사용하여 iOS/Android 앱 개발. 웹과 동일한 API를 공유하므로 백엔드 변경 없이 클라이언트만 추가.

### 11.2 모바일 전용 기능

- **카메라 직접 촬영:** 옷을 바로 촬영하여 아이템 등록
- **AR 가상 피팅 (Phase 2):** ARKit/ARCore 기반 실시간 가상 착용
- **푸시 알림:** 날씨 기반 코디 추천 알림, 새 AI 기능 안내
- **위젯 (Phase 2):** 오늘의 코디 추천 홈 위젯

### 11.3 공유 코드 전략 (Monorepo)

```
apps/
├── web/         (React)
├── mobile/      (React Native)
packages/
├── ui/          (공통 컴포넌트 - web only)
├── core/        (공통 비즈니스 로직)
├── api-client/  (API 호출 모듈)
└── types/       (공통 타입 정의)
```

---

## 12. 개발 로드맵

### Phase 1 — MVP (1~3개월)
- 회원가입/로그인 (이메일 + Google)
- 의류 아이템 업로드 및 배경 제거
- 기본 카테고리 분류 (수동 편집 가능)
- 코디 저장 기능 (이미지 생성 없이 아이템 조합만)
- 기본 AI 코디 추천 (텍스트 입력)

### Phase 2 — 가상 피팅 (4~6개월)
- 아바타 생성 기능
- 가상 피팅 AI 이미지 생성
- 다중 포즈 이미지 생성
- AI 이미지 생성 품질 개선

### Phase 3 — 고도화 (7~9개월)
- URL 이미지 가져오기
- 날씨 기반 추천 강화
- 소셜 기능 (코디 공유, 팔로우)
- Kakao/Apple 소셜 로그인
- 성능 최적화 및 UX 개선

### Phase 4 — 모바일 앱 (10~12개월)
- React Native 앱 개발
- 카메라 촬영 기능
- 푸시 알림
- App Store / Google Play 출시

---

## 13. 리스크 및 대응 방안

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|--------|--------|--------|-----------|
| AI 이미지 생성 품질 미흡 | 높음 | 높음 | 여러 모델 A/B 테스트, 사용자 피드백 기반 모델 교체 |
| AI 처리 비용 과다 | 중간 | 높음 | 사용자별 월간 쿼터 적용, 프리미엄 플랜 도입 |
| 저작권 이슈 (URL 크롤링) | 중간 | 높음 | robots.txt 준수, 상업적 크롤링 법적 검토 |
| GPU 인스턴스 비용 급증 | 중간 | 중간 | Spot Instance 활용, 큐 기반 배치 처리 |
| 개인 사진 보안 침해 | 낮음 | 매우 높음 | 엄격한 접근 제어, 암호화, 침투 테스트 정기 실시 |
| 서비스 스케일링 실패 | 낮음 | 높음 | 부하 테스트 선제적 실시, Auto Scaling 철저 설정 |

---

*본 설계서는 초기 기획을 기반으로 작성되었으며, 개발 진행에 따라 지속적으로 업데이트됩니다.*

**문서 버전 이력**

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-06-15 | 초안 작성 |
