-- 実際にその店舗で見かけた販売価格（任意項目）。未入力の場合はnull
alter table public.scan_history add column store_price integer;
