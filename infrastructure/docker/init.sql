-- PostgreSQL 초기화 스크립트
-- pgvector 확장 설치 (Docker 이미지에 포함되어 있음)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- CLIP 임베딩 컬럼 추가 (Prisma 마이그레이션 후 수동 실행)
-- ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS embedding vector(512);
-- CREATE INDEX IF NOT EXISTS idx_clothing_embedding ON clothing_items
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
