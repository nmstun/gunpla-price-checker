-- 店舗名をstore_nameの文字列スナップショットだけでなく、storesテーブルへの
-- 外部キーでも参照できるようにする。これにより/storesで店舗名をリネームしたとき、
-- スキャン履歴一覧・詳細・各種プルダウンの表示にも変更後の名前が反映されるようになる。
-- store_name自体は残す（store_idが不明・店舗削除後もスキャン時点の記録として使うフォールバック）
alter table public.scan_history add column store_id uuid references public.stores(id) on delete set null;
create index scan_history_store_id_idx on public.scan_history (store_id);

-- 既存行は店舗名が一致するものだけ、その時点でstore_idを埋めておく（一致しない行は
-- store_idがnullのままstore_nameのスナップショット表示にフォールバックする）
update public.scan_history sh
set store_id = st.id
from public.stores st
where sh.store_name = st.name and sh.store_id is null;
