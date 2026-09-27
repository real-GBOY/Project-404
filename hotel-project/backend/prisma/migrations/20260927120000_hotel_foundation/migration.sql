-- HotelOS foundation (hotel-project/backend/docs/architecture.md §"No double booking").
--
-- The reservation engine's final guarantee against double booking is a
-- PostgreSQL exclusion constraint over (organization_id, room_id, stay daterange).
-- A GiST exclusion constraint that mixes `=` on a scalar column with `&&` on a
-- range needs the btree_gist operator classes, so the extension is part of the
-- product's baseline — installed here, before any table that depends on it.
--
-- Verified 2026-09-27 against production: PostgreSQL 12.22 (aarch64) ships
-- btree_gist 1.5 in contrib, and migrations there run as the `postgres`
-- superuser (btree_gist is not a "trusted" extension before PG13, so it cannot
-- be created by a non-superuser owner on PG12).
--
-- Deliberately NOT `IF EXISTS`-tolerant of failure: if the extension cannot be
-- installed this migration must fail loudly, and the deployment must switch to
-- the documented room_nights fallback — never silently run without the guard.

CREATE EXTENSION IF NOT EXISTS btree_gist;
