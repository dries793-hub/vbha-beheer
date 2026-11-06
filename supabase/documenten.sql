-- Documenten (Administratie › Documenten): tabel met gegevens + privé opslag voor de bestanden.
-- Eenmalig uitvoeren in Supabase › SQL Editor. Mag gerust opnieuw uitgevoerd worden.
create table if not exists public.documenten (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid());
alter table public.documenten enable row level security;
drop policy if exists lezen on public.documenten;
create policy lezen on public.documenten for select to authenticated using (public.is_bestuur());
drop policy if exists toevoegen on public.documenten;
create policy toevoegen on public.documenten for insert to authenticated with check (public.is_bewerker());
drop policy if exists wijzigen on public.documenten;
create policy wijzigen on public.documenten for update to authenticated using (public.is_bewerker()) with check (public.is_bewerker());
drop policy if exists verwijderen on public.documenten;
create policy verwijderen on public.documenten for delete to authenticated using (public.is_bewerker());
drop trigger if exists zet_updated on public.documenten;
create trigger zet_updated before update on public.documenten for each row execute function public.zet_updated();
do $$ begin
  if exists (select 1 from pg_proc where proname = 'log_wijziging') then
    drop trigger if exists log_wijziging on public.documenten;
    create trigger log_wijziging after insert or update or delete on public.documenten for each row execute function public.log_wijziging();
  end if;
end $$;
do $$ begin alter publication supabase_realtime add table public.documenten; exception when duplicate_object then null; end $$;

-- privé opslag (max. 50 MB per bestand); alleen bestuursleden kunnen lezen, alleen bewerkers opladen of verwijderen
insert into storage.buckets (id, name, public, file_size_limit)
values ('documenten', 'documenten', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists "documenten lezen" on storage.objects;
create policy "documenten lezen" on storage.objects for select to authenticated using (bucket_id = 'documenten' and public.is_bestuur());
drop policy if exists "documenten opladen" on storage.objects;
create policy "documenten opladen" on storage.objects for insert to authenticated with check (bucket_id = 'documenten' and public.is_bewerker());
drop policy if exists "documenten wijzigen" on storage.objects;
create policy "documenten wijzigen" on storage.objects for update to authenticated using (bucket_id = 'documenten' and public.is_bewerker());
drop policy if exists "documenten verwijderen" on storage.objects;
create policy "documenten verwijderen" on storage.objects for delete to authenticated using (bucket_id = 'documenten' and public.is_bewerker());
