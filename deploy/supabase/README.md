# Supabase self-hosted

Schlanker Supabase-Stack für den `@real-life/supabase-connector`
(db + GoTrue + PostgREST + Realtime + Kong; kein Studio, kein Analytics, kein
Storage). Reduziert aus dem offiziellen
[supabase/docker](https://github.com/supabase/supabase/tree/master/docker)-Setup
(Apache-2.0), Versionen gepinnt, kein Watchtower (ein automatisches
Postgres-Major-Update wäre Datenverlust).

Die Anleitung mit Einordnung steht im Handbuch unter
[Ein Supabase-Backend betreiben](../../docs/handbook/de/handbuch/supabase.mdx).

## Voraussetzungen

- Docker mit Compose-Plugin auf dem Server.
- Ein laufender Traefik-Container namens `traefik` mit dem EntryPoint
  `websecure` und dem Zertifikatsresolver `letsencrypt`.
- Ein DNS-Eintrag für die API-Domain, z. B. `supabase.example.org`.

## Erst-Setup (einmalig)

```bash
# 1. Dateien auf den Server (vom Repo-Root):
scp -r deploy/supabase user@server:apps/
scp -r supabase/migrations user@server:apps/supabase/

# 2. Auf dem Server:
cd apps/supabase
SUPABASE_DOMAIN=supabase.example.org \
SITE_URL=https://netzwerk.example.org \
./generate-secrets.sh        # .env (chmod 600) + Traefik ↔ supabase-Netz; gibt NUR den ANON_KEY aus
docker compose up -d
./apply-migrations.sh        # wartet auf GoTrue, wendet migrations/*.sql an (journaled)
./smoke.sh                   # prüft die RLS-Grenze durch Kong
```

`SUPABASE_DOMAIN` und `SITE_URL` landen in `.env`. Fehlt `SUPABASE_DOMAIN`
dort, verweigert `docker compose` den Start mit einer Meldung.

Die App-Instanz (`deploy/app/`) zeigt dann mit `RLS_DEFAULT_CONNECTOR=supabase`,
`RLS_SUPABASE_URL=https://supabase.example.org` und dem ausgegebenen
`RLS_SUPABASE_ANON_KEY` auf dieses Backend.

## Architektur-Notizen

- **Eigenes `supabase`-Netz:** Der Stack braucht Inter-Container-DNS; das
  server-übliche `network_mode: bridge` hat keins. Traefik wird per
  `docker network connect supabase traefik` verbunden (macht
  `generate-secrets.sh` idempotent). ⚠️ Wird der Traefik-Container neu
  ERSTELLT (nicht nur neu gestartet), ist die Verbindung weg →
  `generate-secrets.sh` erneut ausführen. Sauberer Fix: Netz-Join im
  infrastructure-Repo verankern (offen).
- **Secrets:** liegen nur in `.env` auf dem Server (600). Der ANON_KEY ist
  public by design (steht im Frontend-Bundle). SERVICE_ROLE_KEY und
  JWT_SECRET niemals herausgeben. Key-Rotation (invalidiert alle Sessions):
  `mv .env .env.alt`, dann `generate-secrets.sh` mit `SUPABASE_DOMAIN` und
  `SITE_URL` aus `.env.alt` aufrufen, eigene Ergänzungen aus `.env.alt`
  übernehmen, `docker compose up -d`.
- **GoTrue ohne SMTP:** `MAILER_AUTOCONFIRM=true` — E-Mail-Signups sind
  sofort bestätigt, die Adresse ist also nicht geprüft. Anonyme Logins sind
  aktiv. Wer Bestätigungsmails oder Passwort-Reset braucht, setzt in
  `docker-compose.yml` die `GOTRUE_SMTP_*`-Variablen und
  `GOTRUE_MAILER_AUTOCONFIRM: "false"`. Die Links in den Mails zeigen über
  `GOTRUE_MAILER_URLPATHS_*` schon auf `/auth/v1/verify`, den Pfad, den
  Kong an GoTrue durchreicht. Wer keine anonymen Konten will,
  `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false"`.
- **Admin-Zugriff:** `docker exec -it supabase-db psql -U postgres` (kein
  Studio deployed).

## Sichtbarkeitsmodell (seit Migration 0003)

- **items:** `group_id IS NULL` → instanzweit sichtbar; Gruppen-Items nur
  für Mitglieder (lesen UND schreiben). Ausnahme seit 0009: `relation`,
  `comment` und `reaction` ändert und löscht nur ihr Autor.
- **groups / group_members:** nur Creator + Mitglieder; **einladen dürfen
  nur Mitglieder** (der frühere Selbst-Beitritt Beliebiger ist zu)
- **profiles:** instanzweit lesbar (Mitgliederauswahl beim Einladen)
- Mitgliedschafts-Checks als `security definer`-Funktionen im
  `private`-Schema (Standard-Muster gegen die RLS-Rekursionsfalle
  groups ↔ group_members); Realtime (WALRUS) wertet dieselben Policies aus

## Smoke-Tests

```bash
curl -s https://supabase.example.org/auth/v1/health   # GoTrue-Version
# PostgREST mit anon key (aus generate-secrets.sh):
curl -s "https://supabase.example.org/rest/v1/items?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# → [] oder 200 mit Daten; ohne apikey → 401 (Kong key-auth)
```

## Live-Contract-Suite dagegen fahren

Nur gegen eine Testinstanz: Die Suite legt Konten an und lässt Einträge
zurück, die angemeldete Nutzer sehen. `ANON_KEY` und `SERVICE_ROLE_KEY` aus
der `.env` der Testinstanz in die Shell holen, dann:

```bash
SUPABASE_URL=https://supabase-test.example.org \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
pnpm --filter @real-life/supabase-connector test
```

## Vertrag: Space-Zugehörigkeit und Gruppen-Löschung (seit 0007)

- **`items.group_id` ist unveränderlich** (Trigger `items_scope_immutable`).
  Ein Item wechselt seinen Space nicht — weder global→Gruppe noch
  Gruppe→global noch zwischen Gruppen. Die UPDATE-Policy allein reicht
  dafür nicht, weil sie alten und neuen Scope nur getrennt prüft. Ein
  fachlich gewollter Space-Wechsel wäre eine eigene autorisierte Operation.
- **Gruppen-Löschung kaskadiert** (`on delete cascade`): Die Gruppe nimmt
  ihre Inhalte mit. Vorher stand der Fremdschlüssel auf `set null` — dann
  wären die Items instanzweit sichtbar geworden, Löschen wäre
  Veröffentlichen gewesen. Wer Archivierung/Wiederherstellung will, braucht
  `restrict` plus expliziten Löschworkflow (eigener Feature-Schnitt).

## Neue Migrationen ausrollen

Neue Datei in `supabase/migrations/` → per scp in
`apps/supabase/migrations/` auf dem Server → `./apply-migrations.sh` (skippt
bereits angewendete Dateien über die Journal-Tabelle
`schema_migrations_rls`, die nicht über die API erreichbar ist).

## Sichern

Der Stack sichert nichts von selbst. Die Daten liegen im Volume
`supabase-db-data`. Ein logisches Backup mit Inhalten und Konten (Schema
`auth`) zieht der Superuser des Images:

```bash
docker exec supabase-db pg_dump -U supabase_admin -Fc postgres > rls-$(date +%F).dump
```

Eine Wiederherstellung daraus ist noch nicht durchgespielt.

Dazu gehört `.env`: Ohne `JWT_SECRET` sind wiederhergestellte Sessions und
Schlüssel ungültig.

## Instanz des Projekts

| | |
|---|---|
| API-Domain | `supabase.real-life-stack.de` (A-Record auf `85.214.196.122`) |
| Server-Pfad | `/home/timo/apps/supabase/` |
| TLS | Traefik/Let's Encrypt (Label auf dem Kong-Container) |

Diese Instanz entstand, bevor die Domain aus `.env` kam. Ihre `.env` braucht
einmalig die Zeile `SUPABASE_DOMAIN=supabase.real-life-stack.de`, sonst
startet `docker compose up -d` nicht mehr.
