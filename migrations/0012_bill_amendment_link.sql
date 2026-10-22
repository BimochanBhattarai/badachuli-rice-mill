-- Link a corrected bill back to the original it replaces.
-- Nullable FK with default NULL → safe as ALTER ADD COLUMN even with foreign_keys=ON.
ALTER TABLE bills
  ADD COLUMN amends_bill_id INTEGER REFERENCES bills(id);
