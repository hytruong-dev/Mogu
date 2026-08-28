CREATE TABLE IF NOT EXISTS dish_file_import_sessions (
  id UUID PRIMARY KEY,
  created_by_id UUID NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/csv',
  file_size_bytes INTEGER NOT NULL,
  csv_text TEXT NOT NULL,
  sheet_name TEXT,
  header_row INTEGER NOT NULL DEFAULT 1,
  mapping_snapshot JSONB,
  options_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  total_rows INTEGER NOT NULL DEFAULT 0,
  eligible_rows INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  job_id TEXT,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dish_file_import_rows (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES dish_file_import_sessions(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  normalized_data JSONB,
  issues JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  duplicate_dish_id UUID,
  created_dish_id UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, row_number)
);

CREATE TABLE IF NOT EXISTS dish_editor_audit_logs (
  id UUID PRIMARY KEY,
  dish_id UUID,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dfis_created_by_idx ON dish_file_import_sessions(created_by_id, created_at);
CREATE INDEX IF NOT EXISTS dfir_session_status_idx ON dish_file_import_rows(session_id, status);
CREATE INDEX IF NOT EXISTS deal_dish_idx ON dish_editor_audit_logs(dish_id, created_at);

-- BA-003 tables that were never created (dishes already exists with BA-004 schema)
CREATE TABLE IF NOT EXISTS saved_dishes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dish_id UUID NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT saved_dishes_pkey PRIMARY KEY (id),
    CONSTRAINT saved_dishes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT saved_dishes_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
    CONSTRAINT saved_dishes_user_id_dish_id_key UNIQUE (user_id, dish_id)
);
CREATE INDEX IF NOT EXISTS saved_dishes_user_idx ON saved_dishes(user_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    deep_link TEXT,
    image_url TEXT,
    status notification_status NOT NULL DEFAULT 'UNREAD',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS notifications_user_status_idx ON notifications(user_id, status);

CREATE TABLE IF NOT EXISTS recommendation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dish_id UUID,
    event TEXT NOT NULL,
    position INTEGER,
    session_id TEXT,
    goal_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recommendation_logs_pkey PRIMARY KEY (id),
    CONSTRAINT recommendation_logs_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS rec_logs_user_created_idx ON recommendation_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS rec_logs_dish_idx ON recommendation_logs(dish_id);
