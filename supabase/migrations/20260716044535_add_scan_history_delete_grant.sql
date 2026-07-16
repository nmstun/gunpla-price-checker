-- 履歴一覧からのスワイプ削除に対応するため、scan_historyへのdelete権限を追加する
create policy "Allow public delete" on public.scan_history for delete using (true);
grant delete on public.scan_history to anon;
