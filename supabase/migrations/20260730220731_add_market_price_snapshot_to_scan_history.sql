-- スキャンした時点の通販最安値を記録する。
-- これまで最安値は都度取得の値として表示するだけで保存しておらず、
-- 「前に見たときよりプレ値化が進んでいるか」を判断できなかった。
-- 同じJANコードのスキャン履歴が日時付きで複数行たまるため、この2列を足すだけで
-- 商品ごとの相場の推移をたどれるようになる。
-- スキャン時点のスナップショットとして扱い、定価再取得では上書きしない
-- （上書きすると過去の記録が消えて推移が追えなくなるため）
alter table public.scan_history add column lowest_new_price integer;
alter table public.scan_history add column lowest_used_price integer;

-- 商品ごとの推移をたどる際にJANコードで絞って時系列に並べるため
create index scan_history_jan_code_scanned_at_idx
  on public.scan_history (jan_code, scanned_at desc);
