-- Tabellen voor Kalenderronde, Banket, Kinderfeest, Activiteiten en Vergaderingen (eenmalig uitvoeren in Supabase › SQL Editor).
-- Mag gerust opnieuw uitgevoerd worden.
do $$
declare t text;
begin
  foreach t in array array['ronde','banket','kinderfeest','activiteiten','vergaderingen'] loop
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
    -- logboek (als supabase/logboek.sql al uitgevoerd is)
    if exists (select 1 from pg_proc where proname = 'log_wijziging') then
      execute format('drop trigger if exists log_wijziging on public.%I', t);
      execute format('create trigger log_wijziging after insert or update or delete on public.%I for each row execute function public.log_wijziging()', t);
    end if;
  end loop;
end $$;
