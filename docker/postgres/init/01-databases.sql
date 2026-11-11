-- Executado uma única vez, na criação do volume (docker-entrypoint-initdb.d).
-- Extensões exigidas pelo modelo de dados (ADR-0003: exclusion constraint com btree_gist).
CREATE DATABASE agende_test OWNER agende;

\connect agende
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;

\connect agende_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
