PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'sales',
  country TEXT NOT NULL DEFAULT 'UA',
  language TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'trial',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT 'Manager',
  team TEXT NOT NULL DEFAULT 'Sales',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'custom',
  criteria_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  manager_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  language TEXT NOT NULL DEFAULT 'ru',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  transcript TEXT,
  audio_r2_key TEXT,
  score INTEGER,
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  summary TEXT,
  evidence_quote TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  action_items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lead_id TEXT,
  type TEXT NOT NULL DEFAULT 'mini_audit',
  title TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  calls_count INTEGER NOT NULL DEFAULT 0,
  high_risk_calls INTEGER NOT NULL DEFAULT 0,
  value_at_risk INTEGER NOT NULL DEFAULT 0,
  main_finding TEXT,
  markdown TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  role TEXT,
  contact TEXT NOT NULL,
  company TEXT NOT NULL,
  website TEXT,
  team_size TEXT,
  niche TEXT,
  pain TEXT,
  data_link TEXT,
  status TEXT NOT NULL DEFAULT '01_NEW',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  organization_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'demo',
  status TEXT NOT NULL DEFAULT 'trial',
  minutes_limit INTEGER NOT NULL DEFAULT 75,
  minutes_used REAL NOT NULL DEFAULT 0,
  renewal_date TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_risk ON calls(organization_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_reports_org_created ON reports(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);
