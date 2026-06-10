-- Split Expense Platform — Initial Schema
-- Run via: npm run db:migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('email', 'google');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE group_member_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE group_member_status AS ENUM ('active', 'invited', 'left', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE split_type AS ENUM ('equal', 'unequal', 'percentage', 'shares');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('active', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE settlement_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE settlement_method AS ENUM ('cash', 'upi', 'bank_transfer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'group_invite', 'expense_added', 'expense_updated', 'settlement_suggested',
    'settlement_completed', 'member_joined', 'member_left', 'budget_alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_action AS ENUM (
    'create', 'update', 'delete', 'restore', 'invite', 'join', 'leave', 'settle', 'void'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM (
    'user', 'group', 'group_member', 'expense', 'settlement',
    'budget', 'event', 'recurring_expense', 'invitation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('planned', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  phone VARCHAR(20),
  default_currency CHAR(3) NOT NULL DEFAULT 'INR',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  email_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- USER IDENTITIES (OAuth)
CREATE TABLE IF NOT EXISTS user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider auth_provider NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider ON user_identities (provider, provider_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities (user_id);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- GROUPS
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  group_type VARCHAR(50) NOT NULL DEFAULT 'general',
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups (created_by);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups (group_type);
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups (deleted_at);

DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- GROUP MEMBERS
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role group_member_role NOT NULL DEFAULT 'member',
  status group_member_status NOT NULL DEFAULT 'active',
  nickname VARCHAR(100),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique ON group_members (group_id, user_id)
  WHERE deleted_at IS NULL AND status IN ('active', 'invited');
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members (status);

DROP TRIGGER IF EXISTS trg_group_members_updated_at ON group_members;
CREATE TRIGGER trg_group_members_updated_at BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- GROUP INVITATIONS
CREATE TABLE IF NOT EXISTS group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  invited_by UUID NOT NULL REFERENCES users(id),
  invitee_email VARCHAR(255) NOT NULL,
  invitee_user_id UUID REFERENCES users(id),
  token VARCHAR(64) NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_group_id ON group_invitations (group_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON group_invitations (invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON group_invitations (token);

-- EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- EVENTS (future-ready)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50),
  location TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status event_status NOT NULL DEFAULT 'planned',
  created_by UUID NOT NULL REFERENCES users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_group_id ON events (group_id);

-- RECURRING EXPENSES (future-ready)
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  template_title VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  paid_by_member_id UUID REFERENCES group_members(id),
  split_type split_type NOT NULL,
  split_config JSONB NOT NULL DEFAULT '{}',
  frequency recurrence_frequency NOT NULL,
  interval_count INTEGER DEFAULT 1,
  next_run_at DATE NOT NULL,
  last_run_at DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  paid_by_member_id UUID NOT NULL REFERENCES group_members(id),
  created_by UUID NOT NULL REFERENCES users(id),
  category_id UUID REFERENCES expense_categories(id),
  event_id UUID REFERENCES events(id),
  recurring_expense_id UUID REFERENCES recurring_expenses(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  expense_date DATE NOT NULL,
  split_type split_type NOT NULL DEFAULT 'equal',
  status expense_status NOT NULL DEFAULT 'active',
  receipt_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  idempotency_key VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_idempotency ON expenses (group_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses (group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_date ON expenses (group_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses (paid_by_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status);

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- EXPENSE PARTICIPANTS
CREATE TABLE IF NOT EXISTS expense_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id),
  member_id UUID NOT NULL REFERENCES group_members(id),
  share_amount NUMERIC(14,2) NOT NULL CHECK (share_amount >= 0),
  share_percentage NUMERIC(5,2),
  share_units NUMERIC(10,4),
  is_included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_participants_unique ON expense_participants (expense_id, member_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id ON expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_member_id ON expense_participants (member_id);

-- LEDGER ENTRIES
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  member_id UUID NOT NULL REFERENCES group_members(id),
  entry_type VARCHAR(30) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  reference_type entity_type NOT NULL,
  reference_id UUID NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ledger_group_member ON ledger_entries (group_id, member_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_entries (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_occurred_at ON ledger_entries (occurred_at DESC);

-- SETTLEMENTS
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  from_member_id UUID NOT NULL REFERENCES group_members(id),
  to_member_id UUID NOT NULL REFERENCES group_members(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status settlement_status NOT NULL DEFAULT 'pending',
  method settlement_method,
  notes TEXT,
  settled_at TIMESTAMPTZ,
  recorded_by UUID NOT NULL REFERENCES users(id),
  is_suggested BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (from_member_id <> to_member_id)
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements (group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_member ON settlements (from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to_member ON settlements (to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements (status);

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON settlements;
CREATE TRIGGER trg_settlements_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  action activity_action NOT NULL,
  summary VARCHAR(500) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_group_occurred ON activity_logs (group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs (actor_user_id);

-- AUDIT LOGS (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  before_state JSONB,
  after_state JSONB,
  changed_fields TEXT[],
  ip_address INET,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs (request_id);

-- ENTITY REVISIONS
CREATE TABLE IF NOT EXISTS entity_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  snapshot JSONB NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, revision_number)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  type notification_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  entity_type entity_type,
  entity_id UUID,
  payload JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;

-- BUDGETS (future-ready)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  category_id UUID REFERENCES expense_categories(id),
  name VARCHAR(150) NOT NULL,
  amount_limit NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  period budget_period NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  alert_threshold_pct INTEGER DEFAULT 80,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_budgets_group_period ON budgets (group_id, period_start, period_end);

-- MIGRATIONS TRACKING
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SEED SYSTEM CATEGORIES
INSERT INTO expense_categories (name, icon, color, is_system)
SELECT * FROM (VALUES
  ('Food & Dining', 'restaurant', '#FF5722', true),
  ('Transport', 'directions_car', '#2196F3', true),
  ('Shopping', 'shopping_bag', '#9C27B0', true),
  ('Entertainment', 'movie', '#E91E63', true),
  ('Utilities', 'bolt', '#FF9800', true),
  ('Travel', 'flight', '#009688', true),
  ('Rent', 'home', '#795548', true),
  ('Healthcare', 'local_hospital', '#F44336', true),
  ('Other', 'more_horiz', '#607D8B', true)
) AS v(name, icon, color, is_system)
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE is_system = true LIMIT 1);
