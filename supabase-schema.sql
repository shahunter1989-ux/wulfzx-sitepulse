CREATE TABLE IF NOT EXISTS public.qa_reports (
  id uuid PRIMARY KEY,
  tester_name text NOT NULL,
  tester_contact text,
  project text NOT NULL,
  build_version text,
  device text,
  browser text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'new',
  summary text NOT NULL,
  feedback text,
  final_notes text,
  uploads_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qa_bug_items (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.qa_reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  steps text,
  expected text,
  actual text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY,
  reporter_name text NOT NULL,
  project text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'new',
  description text NOT NULL,
  uploads_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_bug_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- The Node/Express backend uses SUPABASE_SERVICE_ROLE_KEY, so public table policies are intentionally not opened.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qa-uploads',
  'qa-uploads',
  false,
  26214400,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
