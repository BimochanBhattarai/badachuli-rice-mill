ALTER TABLE bill_lines
  ADD COLUMN line_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (line_type IN ('sale','processing'));

UPDATE bill_lines
   SET line_type = (SELECT b.bill_type FROM bills b WHERE b.id = bill_lines.bill_id);
