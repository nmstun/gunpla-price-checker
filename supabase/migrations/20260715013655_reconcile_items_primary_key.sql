-- 本番環境ではmigration 20260709092451が「id主キー・jan_code非一意」の
-- 内容で既に適用済みだったため、後からそのファイルの中身をjan_code主キーの
-- スキーマに書き換えても本番には反映されていなかった（Supabaseはmigrationを
-- タイムスタンプで管理し、内容の差分は見ないため）。
-- このmigrationで本番の実スキーマを、ローカル/ファイル上の意図した最終形
-- （jan_code主キー・official_priceはinteger）に揃える。

-- 同一jan_codeが複数行ある場合は最新（created_atが新しい方）だけを残す
delete from public.items
where ctid not in (
  select distinct on (jan_code) ctid
  from public.items
  order by jan_code, created_at desc
);

alter table public.items drop constraint if exists items_pkey;
alter table public.items drop column if exists id;
alter table public.items alter column official_price type integer using round(official_price)::integer;
alter table public.items add primary key (jan_code);
