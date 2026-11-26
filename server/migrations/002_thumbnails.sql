-- Thumbnails live in Postgres as bytes. They're small (~30–80 KB each), and keeping them
-- in the database means no separate file storage to set up, and nothing lost when the
-- host restarts (Render and Railway wipe the local disk on every deploy).
CREATE TABLE build_thumbnails (
    build_id   uuid PRIMARY KEY REFERENCES builds(id) ON DELETE CASCADE,
    mime_type  text NOT NULL,
    data       bytea NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
