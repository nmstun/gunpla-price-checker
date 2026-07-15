-- バーコードを読み取った実店舗を記録するスキャン履歴。
-- items（JANコードごとの価格キャッシュ）とは別に、店舗・日時ごとの
-- スキャンイベントを1行ずつ残す（同じJANコードでも複数店舗・複数回残せる）
create table public.scan_history (
  id uuid primary key default gen_random_uuid(),
  jan_code text not null,
  item_name text not null,
  official_price integer not null,
  price_source text not null,
  store_name text not null,
  scanned_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.scan_history enable row level security;
create policy "Allow public read" on public.scan_history for select using (true);
create policy "Allow public insert" on public.scan_history for insert with check (true);

grant select, insert on public.scan_history to anon;
