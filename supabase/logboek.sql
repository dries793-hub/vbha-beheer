-- Logboek: elke wijziging aan leden, punten/kalenders en transacties wordt automatisch bijgehouden,
-- met wie het deed (e-mailadres van de aangemelde gebruiker) en wat er veranderde.
-- Uitvoeren in Supabase › SQL Editor (één keer). Mag gerust opnieuw uitgevoerd worden.

create table if not exists public.logboek (
  id      bigint generated always as identity primary key,
  ts      timestamptz not null default now(),
  wie     text,
  tabel   text not null,
  doc_id  text,
  actie   text not null,          -- nieuw | gewijzigd | verwijderd
  oud     jsonb,
  nieuw   jsonb
);
create index if not exists logboek_ts on public.logboek (ts desc);
create index if not exists logboek_doc on public.logboek (tabel, doc_id);

alter table public.logboek enable row level security;
drop policy if exists lezen on public.logboek;
create policy lezen on public.logboek for select to authenticated using (public.is_bestuur());
-- geen policies voor insert/update/delete: niemand kan het logboek vanuit de app aanpassen of wissen

create or replace function public.log_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    case when coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
         then 'Automatisch (formulier of bank)' end,
    'Systeem');
begin
  if tg_op = 'INSERT' then
    insert into logboek (wie, tabel, doc_id, actie, nieuw) values (w, tg_table_name, new.id, 'nieuw', new.data);
  elsif tg_op = 'UPDATE' then
    if new.data is distinct from old.data then
      insert into logboek (wie, tabel, doc_id, actie, oud, nieuw) values (w, tg_table_name, new.id, 'gewijzigd', old.data, new.data);
    end if;
  else
    insert into logboek (wie, tabel, doc_id, actie, oud) values (w, tg_table_name, old.id, 'verwijderd', old.data);
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['leden','jaarleden','boekingen','ronde','banket','kinderfeest','activiteiten','vergaderingen'] loop
    execute format('drop trigger if exists log_wijziging on public.%I', t);
    execute format('create trigger log_wijziging after insert or update or delete on public.%I for each row execute function public.log_wijziging()', t);
  end loop;
end $$;
