-- 「バンダイ公式で確認できない場合は量販店価格を定価として代用する」フォールバックを廃止し、
-- 確認できなければofficial_priceをnullのまま記録するようにする。
-- itemsテーブルは確認できた（バンダイ公式照合済みの）商品のみキャッシュする運用に変えるため
-- official_priceはnot nullのままでよいが、scan_historyは全てのスキャンを記録するためnull許容にする
alter table public.scan_history alter column official_price drop not null;

-- 常に「バンダイ公式のみ」を意味するようになり価値が無くなったため列ごと削除する
alter table public.items drop column price_source;
alter table public.scan_history drop column price_source;
