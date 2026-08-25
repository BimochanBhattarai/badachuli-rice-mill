-- ============================================================
-- Migration 0003: Replace item category enum with purpose flags
-- ============================================================

ALTER TABLE items ADD COLUMN is_buyable    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN is_sellable   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN is_processable INTEGER NOT NULL DEFAULT 0;

-- Back-fill from existing category values
UPDATE items SET is_buyable = 1, is_processable = 1 WHERE category = 'raw_material';
UPDATE items SET is_sellable = 1                    WHERE category = 'finished';
UPDATE items SET is_sellable = 1                    WHERE category = 'byproduct';
UPDATE items SET is_buyable  = 1                    WHERE category = 'consumable';
