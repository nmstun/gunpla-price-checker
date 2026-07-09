create table public.items (
  jan_code text not null primary key,       -- 13桁のバーコード（主キー）
  item_name text not null,                 -- ガンプラの商品名
  official_price integer not null,         -- 正しい定価（税込）
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- セキュリティ（RLS）の設定：誰でも読み込み・追加ができるようにする
alter table public.items enable row level security;
create policy "Allow public read" on public.items for select using (true);
create policy "Allow public insert" on public.items for insert with check (true);