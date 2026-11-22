-- Test van de databaselogica voor reserveren, melden en controle (schema test). Alles wordt op het einde teruggedraaid:
-- het resultaat komt als foutmelding "RESULTAAT: ..." (zo blijft er niets achter in de database).
do $t$
declare r jsonb; m jsonb; t0 int; t1 int; adm uuid; ok text := ''; fout text := ''; n int;
  procedure_dummy int;
begin
  select user_id into adm from test.bestuur where rol in ('admin','bewerker') limit 1;
  t0 := (test.ronde_teller(2026)->>'bedeeld')::int;
  -- 7 vrije straat reserveren
  r := test.ronde_reserveer(2026, array['zz-test-a','zz-test-b'], 'LIDA', 'Lid A', 'manual_member_selection');
  if r->>'ok' = 'true' then ok := ok || ' 7'; else fout := fout || ' 7:' || r; end if;
  -- 8 dubbel reserveren voorkomen (ander lid, zelfde straat) — alles of niets
  r := test.ronde_reserveer(2026, array['zz-test-c','zz-test-a'], 'LIDB', 'Lid B', 'manual_member_selection');
  if r ? 'conflict' and not exists (select 1 from test.ronde where id = '2026_zz-test-c') then ok := ok || ' 8'; else fout := fout || ' 8:' || r; end if;
  -- 9 twee leden tegelijk: unieke sleutel per straat + slot per jaar; tweede insert faalt
  begin insert into test.ronde(id, data) values ('2026_zz-test-a', '{"jaar":2026,"straat":"zz-test-a"}'); fout := fout || ' 9'; exception when unique_violation then ok := ok || ' 9'; end;
  -- 10 gedeeltelijke straat: stuk van een gereserveerde straat kan niet; losse stukken wel; daarna hele straat niet
  r := test.ronde_reserveer(2026, array['zz-test-a~1'], 'LIDB', 'Lid B', 'manual_member_selection');
  if not (r ? 'conflict') then fout := fout || ' 10a'; end if;
  r := test.ronde_reserveer(2026, array['zz-test-d~0','zz-test-d~1'], 'LIDB', 'Lid B', 'personal_link');
  if r->>'ok' <> 'true' then fout := fout || ' 10b'; end if;
  r := test.ronde_reserveer(2026, array['zz-test-d'], 'LIDA', 'Lid A', 'manual_member_selection');
  if r ? 'conflict' then ok := ok || ' 10'; else fout := fout || ' 10c'; end if;
  -- 11-14 lid meldt 494: teller meteen +494, status pending
  r := test.ronde_meld('kzztest000000001', 2026, array['zz-test-a','zz-test-b'], 'LIDA', 'A', 'Lid A', 'Lid A', 'manual_member_selection', 494, 494, null);
  t1 := (test.ronde_teller(2026)->>'bedeeld')::int;
  if r->>'ok' = 'true' then ok := ok || ' 11'; else fout := fout || ' 11:' || r; end if;
  if t1 - t0 = 494 then ok := ok || ' 12'; else fout := fout || ' 12:' || (t1 - t0); end if;
  if r->'melding'->>'controle' = 'pending' and (r->'melding'->>'effectief')::int = 494 and r->'melding'->>'bevestigd' is null then ok := ok || ' 13'; else fout := fout || ' 13'; end if;
  if (select data->>'status' from test.ronde where id = '2026_zz-test-a') = 'done' then ok := ok || ' 14(groen)'; else fout := fout || ' 14'; end if;
  -- 23/24 refresh/dubbelklik: zelfde id nog eens -> niets extra
  r := test.ronde_meld('kzztest000000001', 2026, array['zz-test-a','zz-test-b'], 'LIDA', 'A', 'Lid A', 'Lid A', 'manual_member_selection', 494, 494, null);
  if r->>'al' = 'true' and (test.ronde_teller(2026)->>'bedeeld')::int = t1 then ok := ok || ' 23 24'; else fout := fout || ' 23'; end if;
  -- al bedeelde straat nog eens melden kan niet
  r := test.ronde_meld('kzztest000000009', 2026, array['zz-test-a'], 'LIDB', 'B', 'Lid B', 'Lid B', 'manual_member_selection', 10, 10, null);
  if not (r ? 'conflict') then fout := fout || ' dubbelmeld'; end if;
  -- 31-34: lid (anon/authenticated) kan de functies niet rechtstreeks gebruiken; controle zonder bestuursrol faalt
  if has_function_privilege('anon', 'test.ronde_meld(text,int,text[],text,text,text,text,text,int,int,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'test.ronde_reserveer(int,text[],text,text,text)', 'execute')
     or has_function_privilege('anon', 'test.ronde_controle(text,text,int,text,text)', 'execute') then fout := fout || ' 31'; else ok := ok || ' 31 32 33'; end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin perform test.ronde_controle('kzztest000000001', 'bevestig', null, null, null); fout := fout || ' 34'; exception when others then if sqlerrm like '%geen rechten%' then ok := ok || ' 34'; else fout := fout || ' 34:' || sqlerrm; end if; end;
  -- bestuurslid
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  -- 35 correctie vereist reden
  begin perform test.ronde_controle('kzztest000000001', 'pas', 487, '  ', null); fout := fout || ' 35'; exception when others then ok := ok || ' 35'; end;
  -- 15/16 bevestigen: verschil 0
  r := test.ronde_controle('kzztest000000001', 'bevestig', null, null, null);
  if (r->>'delta')::int = 0 and (test.ronde_teller(2026)->>'bedeeld')::int = t1 then ok := ok || ' 15 16'; else fout := fout || ' 15:' || r->>'delta'; end if;
  -- 25 nog eens bevestigen: niets
  r := test.ronde_controle('kzztest000000001', 'bevestig', null, null, null);
  if r->>'al' = 'true' and (r->>'delta')::int = 0 then ok := ok || ' 25'; else fout := fout || ' 25'; end if;
  -- 17/18 aanpassen 494 -> 487: -7 (opnieuw openen van een bevestigde melding telt enkel het verschil: 26)
  r := test.ronde_controle('kzztest000000001', 'pas', 487, '7 adressen leegstand', null);
  if (r->>'delta')::int = -7 and (test.ronde_teller(2026)->>'bedeeld')::int = t1 - 7 then ok := ok || ' 17 18 26'; else fout := fout || ' 17:' || r->>'delta'; end if;
  -- 19/20 andere melding van 494 -> 500: +6
  r := test.ronde_meld('kzztest000000002', 2026, array['zz-test-d~0'], 'LIDB', 'B', 'Lid B', 'Lid B', 'personal_link', 494, 494, null);
  r := test.ronde_controle('kzztest000000002', 'pas', 500, 'appartementen extra', null);
  if (r->>'delta')::int = 6 then ok := ok || ' 19 20'; else fout := fout || ' 19:' || r->>'delta'; end if;
  -- 21/22 afwijzen: volledige bijdrage terug (-494 voor een nieuwe melding), straten terug zoals voorheen
  r := test.ronde_meld('kzztest000000003', 2026, array['zz-test-e'], 'LIDB', 'B', 'Lid B', 'Lid B', 'manual_member_selection', 494, 494, null);
  t1 := (test.ronde_teller(2026)->>'bedeeld')::int;
  r := test.ronde_controle('kzztest000000003', 'wijs', null, 'straat niet bedeeld', null);
  if (r->>'delta')::int = -494 and (test.ronde_teller(2026)->>'bedeeld')::int = t1 - 494 and not exists (select 1 from test.ronde where id = '2026_zz-test-e') then ok := ok || ' 21 22'; else fout := fout || ' 21:' || r->>'delta'; end if;
  -- afgewezen melding kan niet meer gewijzigd worden
  begin perform test.ronde_controle('kzztest000000003', 'bevestig', null, null, null); fout := fout || ' afgewezen-wijzigbaar'; exception when others then null; end;
  -- 27 teller opnieuw te berekenen uit de registraties
  select coalesce(sum((data->>'effectief')::int), 0) into n from test.rondemeldingen where data->>'jaar' = '2026' and data->>'soort' = 'done' and data ? 'controle';
  if n = (test.ronde_teller(2026)->>'bedeeld')::int then ok := ok || ' 27'; else fout := fout || ' 27'; end if;
  -- 36-39 audit: melding, bevestiging, correctie; gemeld blijft 494
  m := (select data from test.rondemeldingen where id = 'kzztest000000001');
  if jsonb_array_length(m->'audit') = 3 and m->'audit'->0->>'actie' = 'gemeld' and m->'audit'->1->>'actie' = 'bevestigd' and m->'audit'->2->>'actie' = 'aangepast'
     and (m->'audit'->2->>'delta')::int = -7 and m->'audit'->2->>'reden' = '7 adressen leegstand' and m->'audit'->2->>'user' = adm::text then ok := ok || ' 36 37 38'; else fout := fout || ' 36:' || (m->'audit'); end if;
  if (m->>'gemeld')::int = 494 and (m->>'bevestigd')::int = 487 and m->>'controle' = 'adjusted' then ok := ok || ' 39'; else fout := fout || ' 39'; end if;
  -- 39b direct overschrijven via de tabel kan niet (trigger)
  perform set_config('vbha.rm', '', true);
  begin update test.rondemeldingen set data = data || '{"gemeld":1}' where id = 'kzztest000000001'; fout := fout || ' 39b'; exception when others then ok := ok || ' 39b'; end;
  begin update test.rondemeldingen set data = data || '{"effectief":1}' where id = 'kzztest000000001'; fout := fout || ' 39c'; exception when others then ok := ok || ' 39c'; end;
  -- vrijgeven: enkel eigen, niet gemelde straten
  r := test.ronde_reserveer(2026, array['zz-test-f'], 'LIDA', 'Lid A', 'manual_member_selection');
  r := test.ronde_vrijgeven(2026, array['zz-test-f','zz-test-d~1','zz-test-a'], 'LIDA');
  if r->'vrij' = '["zz-test-f"]'::jsonb then ok := ok || ' vrijgeven'; else fout := fout || ' vrijgeven:' || r; end if;
  raise exception 'RESULTAAT ok:% | fout:%', ok, coalesce(nullif(fout, ''), 'geen');
end $t$;
