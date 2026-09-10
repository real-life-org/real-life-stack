-- Position im Profil (Spec 04 §Profile, Regel 4).
--
-- Opt-in und GLOBAL: eine Person setzt sie einmal in ihrem Profil, und sie
-- gilt in jedem Space, dessen Mitglied sie ist. Eine Position je Space gibt
-- es nicht — darum steht sie hier und nicht an der Mitgliedschaft.
--
-- `position` haelt einen GeoJSON-Point (`{"type":"Point","coordinates":[…]}`),
-- dasselbe Format wie `place/v1`; jsonb statt PostGIS, weil der Connector den
-- Wert nur durchreicht und niemand darauf raeumlich sucht. `location_name`
-- ist der menschliche Name dazu („Frankfurt am Main").
--
-- Beide Spalten sind NULLABLE ohne Default: ein bestehendes Profil ist ein
-- gueltiges Profil ohne Position, es wird nichts migriert.
--
-- RLS bleibt unveraendert: `profiles` ist instanzweit lesbar und nur vom
-- Eigentuemer schreibbar (0001_rls_schema.sql). Die Position erbt genau das
-- — sie ist so oeffentlich wie Name und Bio, und nicht oeffentlicher.

alter table public.profiles add column if not exists position jsonb;
alter table public.profiles add column if not exists location_name text;
