-- Team Hub — internal communication + employee self-service. NEW TABLES ONLY.
-- Does not touch any existing table. Safe to run multiple times (IF NOT EXISTS).
-- Every FK here targets a real, existing column (users.id, branches.id) — verified
-- against schemaDef.js before writing this, so no corrections were needed to the
-- table shapes themselves (unlike the route file, which assumed a different schema).

CREATE TABLE IF NOT EXISTS hub_channels (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  channel_type VARCHAR(20) NOT NULL
    CHECK (channel_type IN ('direct','group','announcement','task')),
  name VARCHAR(200),
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  task_reference_type VARCHAR(30),
  task_reference_id INTEGER,
  task_reference_number VARCHAR(50),
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_channel_members (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES hub_channels(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member'
    CHECK (role IN ('admin','moderator','member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP,
  is_muted BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS hub_messages (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES hub_channels(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text','image','document','voice','system','form')),
  content TEXT,
  file_url TEXT,
  file_name VARCHAR(200),
  file_size INTEGER,
  file_type VARCHAR(50),
  reply_to_id INTEGER REFERENCES hub_messages(id),
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  form_type VARCHAR(50),
  form_data JSONB,
  form_status VARCHAR(20) DEFAULT 'pending'
    CHECK (form_status IN ('pending','approved','rejected','cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_message_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES hub_messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS hub_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES hub_messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS hub_forms (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  form_type VARCHAR(50) NOT NULL
    CHECK (form_type IN (
      'leave_request','advance_request','expense_claim','complaint','suggestion',
      'asset_request','work_from_home','overtime_request','resignation','other'
    )),
  submitted_by INTEGER REFERENCES users(id),
  submitted_to INTEGER REFERENCES users(id),
  channel_message_id INTEGER REFERENCES hub_messages(id),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','under_review','approved','rejected','cancelled')),
  form_data JSONB NOT NULL,
  response TEXT,
  responded_by INTEGER REFERENCES users(id),
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_notifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER DEFAULT 1,
  user_id INTEGER REFERENCES users(id),
  notification_type VARCHAR(30) NOT NULL
    CHECK (notification_type IN (
      'new_message','mention','form_submitted','form_approved','form_rejected',
      'announcement','channel_invite','task_comment'
    )),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  channel_id INTEGER REFERENCES hub_channels(id),
  message_id INTEGER REFERENCES hub_messages(id),
  form_id INTEGER REFERENCES hub_forms(id),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_ch_company ON hub_channels(company_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_hub_cm_channel ON hub_channel_members(channel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_hub_cm_user ON hub_channel_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hub_msg_channel ON hub_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hub_msg_sender ON hub_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_hub_reads_msg ON hub_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_hub_reads_user ON hub_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_forms_user ON hub_forms(submitted_by, status);
CREATE INDEX IF NOT EXISTS idx_hub_notif_user ON hub_notifications(user_id, is_read);
