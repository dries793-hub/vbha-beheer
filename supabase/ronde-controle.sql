-- Kalenderronde: reserveren, bedeling melden en controle door het bestuur (zelfde tabellen ronde en rondemeldingen).
-- Geschreven voor schema "test". Voor productie: overal "test." en 'test' vervangen door "public." en 'public'.
--
-- rondemeldingen.data voor een bedeling (soort "done", nieuw model):
--   gemeld      = reported_quantity (door het lid, wordt NOOIT overschreven)
--   bevestigd   = confirmed_quantity (null zolang niet gecontroleerd)
--   controle    = verification_status: pending | confirmed | adjusted | rejected
--   effectief   = effective_quantity: pending -> gemeld, confirmed/adjusted -> bevestigd, rejected -> 0
--   bron        = identity_source: personal_link | manual_member_selection | admin | migratie
--   vorig       = toestand van de straten vóór de melding (om bij afwijzen terug te zetten)
--   audit       = lijst van wijzigingen (elke stap: oud/nieuw effectief, delta, oude/nieuwe status, wie, reden)
-- Teller = som van "effectief" over alle registraties van het jaar (ronde_teller). Er wordt nergens een los totaal bijgehouden,
-- dus de teller is altijd opnieuw te berekenen en een melding kan maar één bijdrage hebben (één rij, unieke id).

-- ---------- hulpfunctie: straten die (geheel of deels) al bezet zijn ----------
create or replace function test.ronde_bezet(p_jaar int, p_straten text[])
returns table(straat text, status text, lid text, door text, via text, exact boolean)
language sql stable security definer set search_path to 'test' as $$
  select s, r.data->>'status', r.data->>'lidId', r.data->>'by', r.data->>'viaMelding', (r.data->>'straat') = s
  from unnest(p_straten) s
  join test.ronde r on r.data->>'jaar' = p_jaar::text and (
       r.data->>'straat' = s                                                     -- zelfde straat of hetzelfde stuk
    or (position('~' in s) = 0 and r.data->>'straat' like s || '~%')             -- hele straat gevraagd, een stuk is bezet
    or (position('~' in s) > 0 and r.data->>'straat' = split_part(s, '~', 1)))   -- stuk gevraagd, de hele straat is bezet
$$;

-- ---------- reserveren: alles of niets ----------
create or replace function test.ronde_reserveer(p_jaar int, p_straten text[], p_lid text, p_by text, p_bron text)
returns jsonb language plpgsql security definer set search_path to 'test' as $$
declare c jsonb; nu text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_bron not in ('personal_link', 'manual_member_selection', 'admin') then raise exception 'bron ongeldig'; end if;
  if coalesce(array_length(p_straten, 1), 0) = 0 then raise exception 'geen straten'; end if;
  -- een straat en een stuk van diezelfde straat samen kan niet
  if exists (select 1 from unnest(p_straten) a, unnest(p_straten) b where a <> b and position('~' in b) > 0 and split_part(b, '~', 1) = a) then
    return jsonb_build_object('ok', false, 'fout', 'dubbel'); end if;
  perform pg_advisory_xact_lock(84211, p_jaar); -- alle reservaties en meldingen van dit jaar na elkaar (geen race)
  select jsonb_agg(distinct jsonb_build_object('s', b.straat, 'st', case when b.status = 'done' then 'd' else 'r' end, 'mijn', b.lid = p_lid))
    into c from test.ronde_bezet(p_jaar, p_straten) b;
  if c is not null then return jsonb_build_object('ok', false, 'conflict', c); end if;
  insert into test.ronde(id, data)
  select p_jaar || '_' || s, jsonb_strip_nulls(jsonb_build_object('jaar', p_jaar, 'straat', s, 'status', 'reserved', 'by', p_by, 'lidId', p_lid,
         'at', nu, 'bron', p_bron, 'deel', case when position('~' in s) > 0 then true end))
  from unnest(p_straten) s;
  return jsonb_build_object('ok', true, 'straten', to_jsonb(p_straten), 'at', nu);
end $$;

-- ---------- reservatie aanpassen: eigen gereserveerde (niet gemelde) straten vrijgeven ----------
create or replace function test.ronde_vrijgeven(p_jaar int, p_straten text[], p_lid text)
returns jsonb language plpgsql security definer set search_path to 'test' as $$
declare weg text[];
begin
  perform pg_advisory_xact_lock(84211, p_jaar);
  with d as (delete from test.ronde r where r.data->>'jaar' = p_jaar::text and r.data->>'straat' = any(p_straten)
             and r.data->>'status' = 'reserved' and r.data->>'lidId' = p_lid returning r.data->>'straat' s)
  select coalesce(array_agg(s), '{}') into weg from d;
  return jsonb_build_object('ok', true, 'vrij', to_jsonb(weg));
end $$;

-- ---------- bedeling melden: telt meteen mee (pending), idempotent via de id van de melding ----------
create or replace function test.ronde_meld(p_id text, p_jaar int, p_straten text[], p_lid text, p_naam text, p_toon text, p_by text,
  p_bron text, p_gemeld int, p_adressen int, p_dozen jsonb)
returns jsonb language plpgsql security definer set search_path to 'test' as $$
declare bestaand jsonb; c jsonb; vorig jsonb; nu text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); d jsonb;
begin
  if p_bron not in ('personal_link', 'manual_member_selection', 'admin') then raise exception 'bron ongeldig'; end if;
  if p_gemeld is null or p_gemeld < 0 then raise exception 'aantal ongeldig'; end if;
  if p_id !~ '^k[0-9a-z]{12,40}$' then raise exception 'id ongeldig'; end if;
  perform pg_advisory_xact_lock(84211, p_jaar);
  -- dezelfde melding nog eens (dubbelklik, opnieuw versturen na time-out): niets opnieuw tellen
  select data into bestaand from test.rondemeldingen where id = p_id;
  if bestaand is not null then
    if bestaand->>'lidId' is distinct from p_lid then raise exception 'id al gebruikt'; end if;
    return jsonb_build_object('ok', true, 'al', true, 'melding', bestaand);
  end if;
  if exists (select 1 from unnest(p_straten) a, unnest(p_straten) b where a <> b and position('~' in b) > 0 and split_part(b, '~', 1) = a) then
    return jsonb_build_object('ok', false, 'fout', 'dubbel'); end if;
  -- toegelaten: vrije straten en straten die dit lid zelf reserveerde (exact dezelfde straat of hetzelfde stuk)
  select jsonb_agg(distinct jsonb_build_object('s', b.straat, 'st', case when b.status = 'done' then 'd' else 'r' end))
    into c from test.ronde_bezet(p_jaar, p_straten) b
    where not (b.exact and b.status = 'reserved' and (b.lid = p_lid or (b.lid is null and lower(coalesce(b.door, '')) = lower(coalesce(p_by, '')))));
  if c is not null then return jsonb_build_object('ok', false, 'conflict', c); end if;
  select coalesce(jsonb_agg(jsonb_build_object('straat', s, 'data', r.data)), '[]') into vorig
    from unnest(p_straten) s left join test.ronde r on r.id = p_jaar || '_' || s;
  insert into test.ronde(id, data)
  select p_jaar || '_' || s, jsonb_strip_nulls(jsonb_build_object('jaar', p_jaar, 'straat', s, 'status', 'done', 'by', p_by, 'lidId', p_lid, 'at', nu,
         'viaMelding', p_id, 'bron', p_bron, 'deel', case when position('~' in s) > 0 then true end, 'mee', r.data->'mee'))
  from unnest(p_straten) s left join test.ronde r on r.id = p_jaar || '_' || s
  on conflict (id) do update set data = excluded.data;
  d := jsonb_strip_nulls(jsonb_build_object('jaar', p_jaar, 'straten', to_jsonb(p_straten), 'soort', 'done', 'lidId', p_lid, 'naam', p_naam, 'toon', p_toon,
       'op', nu, 'stand', 'gemeld', 'bron', p_bron, 'gemeld', p_gemeld, 'adressen', p_adressen, 'controle', 'pending', 'effectief', p_gemeld,
       'vorig', vorig, 'dozen', p_dozen,
       'audit', jsonb_build_array(jsonb_build_object('t', nu, 'actie', 'gemeld', 'door', 'lid', 'bron', p_bron, 'gemeld', p_gemeld,
                 'effVoor', 0, 'effNa', p_gemeld, 'delta', p_gemeld, 'statusVoor', null, 'statusNa', 'pending'))));
  perform set_config('vbha.rm', '1', true);
  insert into test.rondemeldingen(id, data) values (p_id, d);
  return jsonb_build_object('ok', true, 'melding', d);
end $$;

-- ---------- controle door het bestuur: enkel het verschil telt, afwijzen draait alles terug ----------
create or replace function test.ronde_controle(p_id text, p_actie text, p_aantal int, p_reden text, p_opm text)
returns jsonb language plpgsql security definer set search_path to 'test' as $$
declare m jsonb; oud text; nieuw text; effO int; effN int; bev int; w text; wnaam text; nu text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v jsonb; r jsonb; jaar int;
begin
  if not (test.is_bewerker() or test.mag('kalenders')) then raise exception 'geen rechten' using errcode = '42501'; end if;
  select data into m from test.rondemeldingen where id = p_id for update;
  if m is null or m->>'soort' <> 'done' or not (m ? 'controle') then raise exception 'melding niet gevonden'; end if;
  jaar := (m->>'jaar')::int;
  perform pg_advisory_xact_lock(84211, jaar);
  oud := m->>'controle'; effO := coalesce((m->>'effectief')::int, 0);
  if oud = 'rejected' then raise exception 'Deze melding werd al afgewezen.'; end if;
  p_reden := nullif(btrim(coalesce(p_reden, '')), ''); p_opm := nullif(btrim(coalesce(p_opm, '')), '');
  if p_actie = 'bevestig' then
    nieuw := 'confirmed'; bev := (m->>'gemeld')::int; effN := bev;
  elsif p_actie = 'pas' then
    if p_aantal is null or p_aantal < 0 or p_aantal > 100000 then raise exception 'Geef een geldig aantal (geheel getal, 0 of meer).'; end if;
    if p_reden is null then raise exception 'Geef een reden voor de aanpassing.'; end if;
    bev := p_aantal; effN := p_aantal; nieuw := case when p_aantal = (m->>'gemeld')::int then 'confirmed' else 'adjusted' end;
  elsif p_actie = 'wijs' then
    if p_reden is null then raise exception 'Geef een reden voor de afwijzing.'; end if;
    if m->>'bron' = 'migratie' then raise exception 'Een overgenomen registratie kan je niet afwijzen. Pas het aantal aan.'; end if;
    nieuw := 'rejected'; bev := null; effN := 0;
  else raise exception 'actie ongeldig'; end if;
  -- niets veranderd (bv. twee keer op Bevestigen geklikt): geen nieuwe auditregel, geen delta
  if nieuw = oud and effN = effO and (bev is not distinct from (m->>'bevestigd')::int) and p_opm is null then
    return jsonb_build_object('ok', true, 'al', true, 'delta', 0, 'effVoor', effO, 'effNa', effN, 'melding', m); end if;
  w := coalesce(auth.uid()::text, ''); select coalesce(nullif(naam, ''), email) into wnaam from test.bestuur where user_id = auth.uid();
  -- afwijzen: de straten van deze melding terug zoals ze waren (enkel als ze sindsdien niet door iets anders veranderden)
  if nieuw = 'rejected' then
    for v in select * from jsonb_array_elements(coalesce(m->'vorig', '[]')) loop
      select data into r from test.ronde where id = jaar || '_' || (v->>'straat');
      if r is not null and r->>'viaMelding' = p_id then
        if jsonb_typeof(v->'data') = 'object' then update test.ronde set data = v->'data' where id = jaar || '_' || (v->>'straat');
        else delete from test.ronde where id = jaar || '_' || (v->>'straat'); end if;
      end if;
    end loop;
  end if;
  m := m || jsonb_build_object('controle', nieuw, 'effectief', effN, 'bevestigd', bev, 'gecontroleerd', nu,
        'audit', coalesce(m->'audit', '[]') || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('t', nu,
          'actie', case p_actie when 'bevestig' then 'bevestigd' when 'pas' then 'aangepast' else 'afgewezen' end,
          'door', 'bestuur', 'user', w, 'naam', wnaam, 'gemeld', (m->>'gemeld')::int, 'bevestigd', bev,
          'effVoor', effO, 'effNa', effN, 'delta', effN - effO, 'statusVoor', oud, 'statusNa', nieuw, 'reden', p_reden, 'opm', p_opm))));
  if p_opm is not null then m := m || jsonb_build_object('opm', p_opm); end if;
  if nieuw = 'rejected' then m := m || jsonb_build_object('stand', 'geweigerd'); end if;
  perform set_config('vbha.rm', '1', true);
  update test.rondemeldingen set data = m where id = p_id;
  return jsonb_build_object('ok', true, 'delta', effN - effO, 'effVoor', effO, 'effNa', effN, 'melding', m, 'teller', test.ronde_teller(jaar));
end $$;

-- ---------- teller: altijd opnieuw berekend uit de registraties ----------
create or replace function test.ronde_teller(p_jaar int)
returns jsonb language sql stable security definer set search_path to 'test' as $$
  select jsonb_build_object(
    'bedeeld', coalesce(sum((data->>'effectief')::int), 0),
    'teControleren', count(*) filter (where data->>'controle' = 'pending'),
    'voorlopig', coalesce(sum((data->>'effectief')::int) filter (where data->>'controle' = 'pending'), 0),
    'registraties', count(*))
  from test.rondemeldingen where data->>'jaar' = p_jaar::text and data->>'soort' = 'done' and data ? 'controle'
$$;

-- ---------- bescherming: gemeld blijft zoals het lid het doorgaf; status/teller enkel via de functies hierboven ----------
create or replace function test.rm_bescherm() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.data ? 'controle' and coalesce(current_setting('vbha.rm', true), '') <> '1' then raise exception 'Een bedelingsmelding kan je niet verwijderen.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.data ? 'controle' and coalesce(current_setting('vbha.rm', true), '') <> '1' then raise exception 'Bedelingsmeldingen enkel via de kaart.'; end if;
    return new;
  end if;
  if old.data ? 'controle' then
    if (new.data->'gemeld') is distinct from (old.data->'gemeld') then raise exception 'Het gemelde aantal blijft altijd bewaard.'; end if;
    if coalesce(current_setting('vbha.rm', true), '') <> '1' and (
         (new.data->'controle') is distinct from (old.data->'controle') or (new.data->'effectief') is distinct from (old.data->'effectief')
      or (new.data->'bevestigd') is distinct from (old.data->'bevestigd') or (new.data->'audit') is distinct from (old.data->'audit')
      or (new.data->'vorig') is distinct from (old.data->'vorig') or (new.data->'straten') is distinct from (old.data->'straten')) then
      raise exception 'Controle van een melding enkel via Bevestigen, Aanpassen of Afwijzen.'; end if;
  elsif new.data ? 'controle' and coalesce(current_setting('vbha.rm', true), '') <> '1' then
    raise exception 'Bedelingsmeldingen enkel via de kaart.';
  end if;
  return new;
end $$;
drop trigger if exists rm_bescherm on test.rondemeldingen;
create trigger rm_bescherm before insert or update or delete on test.rondemeldingen for each row execute function test.rm_bescherm();

-- enkel de server (service role) mag reserveren/melden; controle enkel aangemelde bestuursleden (rechten in de functie)
revoke all on function test.ronde_bezet(int, text[]) from public, anon, authenticated;
revoke all on function test.ronde_reserveer(int, text[], text, text, text) from public, anon, authenticated;
revoke all on function test.ronde_vrijgeven(int, text[], text) from public, anon, authenticated;
revoke all on function test.ronde_meld(text, int, text[], text, text, text, text, text, int, int, jsonb) from public, anon, authenticated;
revoke all on function test.ronde_teller(int) from public, anon;
revoke all on function test.ronde_controle(text, text, int, text, text) from public, anon;
grant execute on function test.ronde_bezet(int, text[]), test.ronde_reserveer(int, text[], text, text, text), test.ronde_vrijgeven(int, text[], text),
  test.ronde_meld(text, int, text[], text, text, text, text, text, int, int, jsonb), test.ronde_teller(int) to service_role;
grant execute on function test.ronde_controle(text, text, int, text, text), test.ronde_teller(int) to authenticated, service_role;

-- ---------- overname van bestaande bedelingen (eenmalig, uitgevoerd op schema test) ----------
-- Elke straat die in het actieve jaar al op "done" stond (zonder registratie in het nieuwe model) kreeg één registratie
-- id "mig<jaar>_<straat>", bron "migratie", controle "confirmed", gemeld = bevestigd = effectief = aantal adressen van die straat
-- volgens de kaart (api/_lib/kr_adressen.js). Het oorspronkelijke melding-id staat in "oudVia". Zo is de teller meteen volledig
-- en blijft hij opnieuw te berekenen. Afwijzen kan voor zo'n registratie niet (er is geen "vorige toestand"); aanpassen wel.
-- Voor productie: dezelfde stappen met de adressen uit kr_adressen.js voor de straten die daar op "done" staan (zie het rapport).
-- Sinds 22/11: automatisch via test.ronde_overname(jaar, [{s, a}]) bij elke GET /api/ronde (idempotent, unieke id per straat).
-- Reden: de testomgeving wordt soms vernieuwd vanuit productie; een eenmalige overname zou dan verloren gaan.
create or replace function test.ronde_overname(p_jaar int, p_rijen jsonb)
returns int language plpgsql security definer set search_path to 'test' as $$
declare n int; nu text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  perform pg_advisory_xact_lock(84211, p_jaar);
  perform set_config('vbha.rm', '1', true);
  with src as (
    select r.data d, coalesce((x->>'a')::int, 0) a from jsonb_array_elements(p_rijen) x
    join test.ronde r on r.id = p_jaar || '_' || (x->>'s') and r.data->>'status' = 'done'
    where not exists (select 1 from test.rondemeldingen m where m.data->>'jaar' = p_jaar::text and m.data->>'soort' = 'done'
                      and m.data ? 'controle' and m.data->>'controle' <> 'rejected' and m.data->'straten' ? (x->>'s')))
  insert into test.rondemeldingen(id, data)
  select 'mig' || p_jaar || '_' || (d->>'straat'), jsonb_strip_nulls(jsonb_build_object('jaar', p_jaar, 'straten', jsonb_build_array(d->>'straat'), 'soort', 'done',
    'lidId', d->>'lidId', 'naam', d->>'by', 'toon', d->>'by', 'op', coalesce(d->>'at', nu), 'stand', 'migratie', 'bron', 'migratie',
    'gemeld', a, 'bevestigd', a, 'adressen', a, 'controle', 'confirmed', 'effectief', a, 'vorig', '[]'::jsonb, 'oudVia', d->>'viaMelding',
    'audit', jsonb_build_array(jsonb_build_object('t', nu, 'actie', 'overgenomen', 'door', 'migratie', 'bron', 'migratie', 'gemeld', a, 'bevestigd', a,
      'effVoor', 0, 'effNa', a, 'delta', a, 'statusNa', 'confirmed',
      'opm', 'Bedeelde straat zonder melding (van voor de nieuwe controle of rechtstreeks in de app aangeduid), overgenomen met het aantal adressen volgens de kaart.'))))
  from src
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function test.ronde_overname(int, jsonb) from public, anon, authenticated;
grant execute on function test.ronde_overname(int, jsonb) to service_role;

-- ================= 22/11 (later): terug naar DOZEN =================
-- Op vraag van het bestuur werkt alles in dozen, niet in adressen:
--   * gemeld/bevestigd/effectief = dozen (per kwart doos), berekend uit de antwoorden over de dozen en de verdeling
--   * teller = (afgewerkte dozen in jaarleden + dozen van meldingen met controle "pending") × kalenders per doos
--   * bevestigen/aanpassen: de app boekt de dozen in de verdeling (afgewerkt); de melding is dan niet meer "pending" -> nooit dubbel
--   * enkel meldingen die nog te controleren zijn, kunnen gecontroleerd worden
--   * de overname van oude straten (mig...) en ronde_overname zijn verwijderd (niet meer nodig: oude bedelingen zitten al in jaarleden)
-- Toegepast op schema test als migratie "test_ronde_dozen": ronde_meld/ronde_controle met numeric aantallen, ronde_teller geeft "voorlopig".
