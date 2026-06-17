-- Wispr Flow Clone — transcriptions persistence
CREATE TABLE IF NOT EXISTS transcriptions (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    text        TEXT NOT NULL
);

-- newest first is the access pattern; index supports ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions (created_at DESC);
