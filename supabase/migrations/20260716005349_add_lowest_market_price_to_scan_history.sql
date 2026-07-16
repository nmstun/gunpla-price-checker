-- スキャン時点でのYahoo!ショッピング最安値（任意）。詳細画面での参考表示や
-- キャッシュヒット時・定価再取得前の履歴には値が無いことがある
alter table public.scan_history add column lowest_market_price integer;
