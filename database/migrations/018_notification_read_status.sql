-- Migration 018: Add read status to notification_deliveries
-- Also ensures the in-app notifications table has the is_read column (it already does from 003)

ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS is_read  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at  TIMESTAMPTZ;

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_is_read
  ON notification_deliveries (user_id, is_read);
