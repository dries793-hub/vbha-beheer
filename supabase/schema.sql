-- =====================================================================
-- VBHA Beheer - databaseschema voor Supabase
-- Uitvoeren in Supabase: SQL Editor > New query > plakken > Run.
-- Het script mag meerdere keren uitgevoerd worden.
-- =====================================================================

-- 1. Bestuursleden die toegang hebben ---------------------------------
create table if not exists public.bestuur (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  rol        text not null default 'bewerker' check (rol in ('bewerker','lezer')),
  created_at timestamptz not null default now()
);
alter table public.bestuur enable row level security;
drop policy if exists eigen_rij on public.bestuur;
create policy eigen_rij on public.bestuur for select to authenticated using (user_id = auth.uid());

create or replace function public.is_bestuur() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.bestuur where user_id = auth.uid()) $$;

create or replace function public.is_bewerker() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.bestuur where user_id = auth.uid() and rol = 'bewerker') $$;

-- Iedereen die je uitnodigt via Authentication > Users > Invite user,
-- wordt automatisch bestuurslid met de rol 'bewerker'.
-- Zet de rol in de tabel 'bestuur' op 'lezer' voor alleen-lezen toegang.
create or replace function public.nieuw_bestuurslid() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.bestuur (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nieuw_bestuurslid();

-- Bestaande gebruikers (vóór dit script aangemaakt) ook toevoegen
insert into public.bestuur (user_id, email) select id, email from auth.users on conflict (user_id) do nothing;

-- 2. Gegevenstabellen --------------------------------------------------
-- Elke tabel bewaart een record als JSON (kolom data), met een vaste id.
create or replace function public.zet_updated() returns trigger
language plpgsql as $$ begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['leden','boekingen','jaarleden','sponsors','jaren','templates','config','archief','regels','imports','ronde','banket','kinderfeest'] loop
    execute format('create table if not exists public.%I (
        id text primary key,
        data jsonb not null default ''{}''::jsonb,
        updated_at timestamptz not null default now(),
        updated_by uuid default auth.uid())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists lezen on public.%I', t);
    execute format('create policy lezen on public.%I for select to authenticated using (public.is_bestuur())', t);
    execute format('drop policy if exists toevoegen on public.%I', t);
    execute format('create policy toevoegen on public.%I for insert to authenticated with check (public.is_bewerker())', t);
    execute format('drop policy if exists wijzigen on public.%I', t);
    execute format('create policy wijzigen on public.%I for update to authenticated using (public.is_bewerker()) with check (public.is_bewerker())', t);
    execute format('drop policy if exists verwijderen on public.%I', t);
    execute format('create policy verwijderen on public.%I for delete to authenticated using (public.is_bewerker())', t);
    execute format('drop trigger if exists zet_updated on public.%I', t);
    execute format('create trigger zet_updated before update on public.%I for each row execute function public.zet_updated()', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Sleutelvelden van boekingen als echte kolommen, voor snelle filters
-- en om dubbele bankverrichtingen uit te sluiten.
alter table public.boekingen add column if not exists jaar int generated always as ((data->>'jaar')::int) stored;
alter table public.boekingen add column if not exists bank_ref text generated always as (nullif(data->>'bankRef','')) stored;
create index if not exists boekingen_jaar_idx on public.boekingen (jaar);
create unique index if not exists boekingen_bank_ref_uniek on public.boekingen (bank_ref) where bank_ref is not null;

-- 3. Bankkoppeling (enkel toegankelijk voor de server) -----------------
-- Geen policies: gewone gebruikers kunnen deze tabellen niet lezen of schrijven.
create table if not exists public.bank_koppelingen (
  id         text primary key,          -- Enable Banking session_id
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.bank_koppelingen enable row level security;

create table if not exists public.bank_auth (
  state      text primary key,
  user_id    uuid,
  data       jsonb,
  created_at timestamptz not null default now()
);
alter table public.bank_auth enable row level security;
