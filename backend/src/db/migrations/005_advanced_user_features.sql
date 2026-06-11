-- Migration 005: Advanced User-Facing Features
-- Adds: Group enhancements, Expense enhancements, Settlement enhancements, 
--        Budget enhancements, Comments, Reactions, New split types

-- ============================================================
-- ENUM EXTENSIONS
-- ============================================================

-- New split types
ALTER TYPE split_type ADD VALUE IF NOT EXISTS 'item_wise';
ALTER TYPE split_type ADD VALUE IF NOT EXISTS 'days_wise';
ALTER TYPE split_type ADD VALUE IF NOT EXISTS 'consumption_wise';
ALTER TYPE split_type ADD VALUE IF NOT EXISTS 'hybrid';

-- New settlement statuses
DO $$ BEGIN
  ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'requested';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'reversed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New notification types
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'settlement_request'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'settlement_reminder'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'settlement_reversal'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'comment_added'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'expense_reaction'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ownership_transferred'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'budget_exceeded'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New activity actions
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'approve'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'reject'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'remind'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'transfer'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'archive'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'clone'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'comment'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'react'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'reverse'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New entity types
DO $$ BEGIN ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'comment'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'attachment'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- GROUP ENHANCEMENTS
-- ============================================================

ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ============================================================
-- EXPENSE ENHANCEMENTS
-- ============================================================

-- Draft flag
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Expense Attachments
CREATE TABLE IF NOT EXISTS expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense ON expense_attachments (expense_id) WHERE deleted_at IS NULL;

-- Multiple Payers
CREATE TABLE IF NOT EXISTS expense_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_payers_unique ON expense_payers (expense_id, member_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_payers_expense ON expense_payers (expense_id) WHERE deleted_at IS NULL;

-- Item-wise Split Items
CREATE TABLE IF NOT EXISTS expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items (expense_id) WHERE deleted_at IS NULL;

-- Item-wise Split Participants
CREATE TABLE IF NOT EXISTS expense_item_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id),
  share_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_item_participants_item ON expense_item_participants (item_id);

-- ============================================================
-- SETTLEMENT ENHANCEMENTS
-- ============================================================

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS parent_settlement_id UUID REFERENCES settlements(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES users(id);

-- Settlement Reminders
CREATE TABLE IF NOT EXISTS settlement_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  from_member_id UUID NOT NULL REFERENCES group_members(id),
  to_member_id UUID NOT NULL REFERENCES group_members(id),
  amount NUMERIC(14,2) NOT NULL,
  message TEXT,
  sent_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_reminders_group ON settlement_reminders (group_id);

-- ============================================================
-- BUDGET ENHANCEMENTS
-- ============================================================

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES group_members(id);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_type VARCHAR(20) DEFAULT 'group';

CREATE INDEX IF NOT EXISTS idx_budgets_member ON budgets (member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_type ON budgets (budget_type);

-- ============================================================
-- COMMENTS (Threaded)
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  group_id UUID REFERENCES groups(id),
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments (entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- EXPENSE REACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(expense_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_expense_reactions_expense ON expense_reactions (expense_id);
