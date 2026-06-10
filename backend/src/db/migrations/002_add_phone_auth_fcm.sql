-- Migration to make email nullable and add fcm_token

-- Drop the NOT NULL constraint on email
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Update the email active index to ensure we only enforce uniqueness on non-null emails
DROP INDEX IF EXISTS idx_users_email_active;
CREATE UNIQUE INDEX idx_users_email_active ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Add fcm_token column for push notifications
ALTER TABLE refresh_tokens ADD COLUMN fcm_token VARCHAR(255);

-- Make sure we have an index for phone number since we will login via phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_active ON users (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
