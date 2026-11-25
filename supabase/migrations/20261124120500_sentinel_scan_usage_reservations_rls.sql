-- Defense in depth: this private reservation table is only accessed by
-- SECURITY DEFINER functions owned by postgres. No anon/authenticated
-- table privileges are granted, and no client-facing policy is required.
ALTER TABLE private.scan_usage_reservations
  ENABLE ROW LEVEL SECURITY;
