-- Migration: add geofence columns to documents table
-- Apply with: prisma db push  OR  run manually against PostgreSQL
-- All columns are nullable — existing documents are unaffected.
-- Documents without geofence configured accept GPS as evidence only (no blocking).

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "geofenceLat"          DOUBLE PRECISION;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "geofenceLng"          DOUBLE PRECISION;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters" INTEGER;
