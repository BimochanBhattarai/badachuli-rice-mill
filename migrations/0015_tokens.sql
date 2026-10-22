-- Daily queue tokens, generated from the dashboard (independent of bills).
-- The token number is a single shared counter that resets every day:
-- COALESCE(MAX(token_number), 0) + 1 scoped to DATE(created_at) = DATE('now').
CREATE TABLE IF NOT EXISTS tokens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_number INTEGER NOT NULL,
  business_id  INTEGER REFERENCES businesses(id),
  item_id      INTEGER NOT NULL REFERENCES items(id),
  operator_id  INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at);
