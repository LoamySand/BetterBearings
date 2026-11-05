-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text        NOT NULL ,
  email         text        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON users (lower(username));

CREATE TABLE street_sets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  center      geography(Point, 4326) NOT NULL,
  radius      integer     NOT NULL CHECK (radius > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX street_sets_user_id_idx ON street_sets (user_id);

CREATE TABLE street_set_streets (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  street_set_id    bigint   NOT NULL REFERENCES street_sets (id) ON DELETE CASCADE,
  position         integer  NOT NULL,
  osm_id           bigint,
  name             text     NOT NULL,
  alternative_name text,
  type             text,
  length           double precision,
  width            double precision,
  is_enclosed_area boolean  NOT NULL DEFAULT false,
  included         boolean  NOT NULL DEFAULT true,
  difficulty       smallint CHECK (difficulty BETWEEN 1 AND 3),
  geom             geometry(MultiLineString, 4326) NOT NULL,
  UNIQUE (street_set_id, position)
);

-- Down Migration
DROP TABLE street_set_streets;
DROP TABLE street_sets;
DROP TABLE users;