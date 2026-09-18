-- ============================================================
--  Migration 069: Add revocation to document integrity
-- ============================================================

ALTER TABLE document_hashes
  ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
