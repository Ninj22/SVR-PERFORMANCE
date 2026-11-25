CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext UNIQUE NOT NULL,
    password_hash text NOT NULL,
    display_name  text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE builds (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          text NOT NULL,
    slug          text UNIQUE NOT NULL,
    config        jsonb NOT NULL,
    is_public     boolean NOT NULL DEFAULT false,
    thumbnail_url text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX builds_user_id_idx ON builds (user_id);
CREATE INDEX builds_public_idx ON builds (is_public, created_at DESC);
