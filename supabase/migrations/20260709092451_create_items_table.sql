-- supabase/migrations/xxxx_create_items_table.sql
create table public.items (
  jan_code text not null primary key,       -- 13桁のバーコード（主キー、1JANコードにつき1行）
  item_name text not null,                 -- ガンプラの商品名
  official_price integer not null,         -- 正しい定価（税込）
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- セキュリティ（RLS）の設定：誰でも読み込み・追加ができるようにする
alter table public.items enable row level security;
create policy "Allow public read" on public.items for select using (true);
create policy "Allow public insert" on public.items for insert with check (true);

-- RLSポリシーだけではテーブルへの実際のアクセス権は付与されないため、
-- anonロール（アプリがNEXT_PUBLIC_SUPABASE_ANON_KEYで使うロール）に明示的にGRANTする
grant select, insert on public.items to anon;
