-- Aussagen einer Person: den Inhalt aendert nur die Autorin (Spec 08)
--
-- Spec 08 („Aussagen einer Person", Regel 6): Ein authoritative-Store darf
-- `trusted` nur beanspruchen, wenn jeder Ingress-Pfad die Autorbindung
-- erzwingt UND Aenderungen am Inhalt auf die Autorin beschraenkt. Bisher
-- durfte hier jedes Mitglied jedes Statement bearbeiten und loeschen.
--
-- Gesteuert allein durch den Katalog `item-authorial` (Spec 08, Tabelle der
-- Katalogtypen), ohne typspezifische Logik. Der Katalog unten MUSS dem in
-- packages/data-interface/src/claims.ts (AUTHORIAL_ITEM_TYPES) entsprechen;
-- ein Test in packages/supabase-connector prueft das.
--
-- Regeln fuer Items eines Katalogtyps:
-- 1. Den Inhalt (Inhaltsfelder und Inhaltsrelationen) aendert nur die
--    Autorin. Alles andere (Tags, weitere Felder) bleibt nach den
--    allgemeinen Item-Regeln schreibbar. Die strengere Zeilensperre fuer
--    comment/reaction aus 0009 bleibt bestehen.
-- 2. Einfrieren: Existiert eine inhaltsgebundene Bezugnahme einer anderen
--    Person (Relation Record mit `contentHash` auf das Item), ist der Inhalt
--    auch fuer die Autorin gesperrt.
-- 3. Loeschen darf nur die Autorin (wie bei relation, comment, reaction).
-- 4. authoritative-Stores schreiben keinen Claim: `data.claim` wird bei
--    Katalogtypen verworfen.
--
-- Der privilegierte Pfad (service_role, Fixtures/Wartung) ist ausgenommen,
-- wie in Spec 08 fuer gekennzeichnete Fixture-Pfade vorgesehen.
--
-- Nebenlaeufigkeit: Eine Stimme, die parallel zu einer Inhaltsaenderung
-- entsteht, sieht der Trigger nicht. Dann gilt Spec 08, Einfrieren Regel 1:
-- Ihr Hash passt nicht mehr zum Inhalt, sie zaehlt nicht.

-- catalog:begin (type | Inhaltsfelder | Inhaltsrelationen)
create or replace function private.authorial_item_types()
returns table (type text, content_fields text[], content_relations text[])
language sql
immutable
set search_path = ''
as $$
  values
    ('statement', array['title', 'description', 'variantOf'], array[]::text[]),
    ('comment', array['content', 'replyTo', 'replyToComment'], array['commentOn']),
    ('reaction', array['emoji'], array['reactsTo'])
$$;
-- catalog:end

-- Inhalt eines Items wie itemContent() in claims.ts: jedes Inhaltsfeld
-- (fehlend = null) und je Inhaltsrelation die sortierten Ziele. Null fuer
-- Typen ausserhalb des Katalogs. Verglichen wird als jsonb; Strings bleiben
-- dabei byte-genau (keine Unicode-Normalisierung).
create or replace function private.authorial_content(item_type text, item_data jsonb, item_relations jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'data', coalesce((
      select jsonb_object_agg(field, coalesce(item_data -> field, 'null'::jsonb))
      from unnest(c.content_fields) as field
    ), '{}'::jsonb),
    'relations', coalesce((
      select jsonb_object_agg(predicate, coalesce((
        select jsonb_agg(r ->> 'target' order by r ->> 'target' collate "C")
        from jsonb_array_elements(
          case when jsonb_typeof(item_relations) = 'array' then item_relations else '[]'::jsonb end
        ) as r
        where r ->> 'predicate' = predicate
      ), '[]'::jsonb))
      from unnest(c.content_relations) as predicate
    ), '{}'::jsonb)
  )
  from private.authorial_item_types() as c
  where c.type = item_type
$$;

-- Autorgebunden: Katalogtypen plus relation (wie isAuthoredItemType).
-- security definer wie is_group_member: sonst inlint Postgres die Funktion
-- in die Policy und loest ihren Rumpf mit den Rechten des Aufrufers auf, der
-- kein Recht auf das Schema private hat.
create or replace function private.is_authored_item_type(item_type text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select item_type = 'relation'
    or exists (select 1 from private.authorial_item_types() as c where c.type = item_type)
$$;

revoke all on function private.authorial_item_types() from public;
revoke all on function private.authorial_content(text, jsonb, jsonb) from public;
revoke all on function private.is_authored_item_type(text) from public;
grant execute on function private.is_authored_item_type(text) to authenticated;

create or replace function private.enforce_authorial_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_content jsonb;
begin
  if coalesce((select auth.role()), '') = 'service_role' then
    return new;
  end if;
  if not exists (select 1 from private.authorial_item_types() as c where c.type = new.type) then
    return new;
  end if;

  new.data := new.data - 'claim';
  if tg_op = 'INSERT' then
    return new;
  end if;

  old_content := private.authorial_content(old.type, old.data, old.relations);
  if private.authorial_content(new.type, new.data, new.relations) is not distinct from old_content then
    return new;
  end if;

  if old.created_by is distinct from (select auth.uid())::text then
    raise exception 'only the author may change the content of a %', old.type
      using errcode = '42501';
  end if;
  -- Sieht alle Bezugnahmen, auch ausserhalb der eigenen Sichtbarkeit
  -- (security definer), damit das Einfrieren nicht von RLS abhaengt.
  if exists (
    select 1 from public.items as r
    where r.type = 'relation'
      and r.created_by is distinct from old.created_by
      and r.relations @> jsonb_build_array(jsonb_build_object('predicate', 'to', 'target', 'item:' || old.id))
      and jsonb_typeof(r.data -> 'contentHash') = 'string'
  ) then
    raise exception 'this % is frozen: another person has bound a reference to its content — create a new version instead', old.type
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_authorial_content() from public;

drop trigger if exists items_authorial_content on public.items;
create trigger items_authorial_content
  before insert or update on public.items
  for each row
  execute function private.enforce_authorial_content();

-- Loeschen: nur die Autorin, fuer alle autorgebundenen Typen aus dem
-- Katalog (loest die feste Liste aus 0009 ab; Statements kommen hinzu).
drop policy if exists "delete item" on public.items;
create policy "delete item"
  on public.items for delete to authenticated
  using (
    (group_id is null or private.is_group_member(group_id))
    and (not private.is_authored_item_type(type)
         or created_by = (select auth.uid())::text)
  );
