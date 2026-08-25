-- ============================================================
-- Migration 0002: Add is_default flag to units
-- ============================================================

ALTER TABLE units ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

-- Kilogram is the system-wide default unit
UPDATE units SET is_default = 1 WHERE abbreviation = 'kg';
