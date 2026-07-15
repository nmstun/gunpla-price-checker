-- 店舗の販売価格を後から編集できるように、scan_historyへのupdate権限が
-- 抜けていた（select/insertしか付与していなかった）ため追加する
create policy "Allow public update" on public.scan_history for update using (true) with check (true);
grant update on public.scan_history to anon;
