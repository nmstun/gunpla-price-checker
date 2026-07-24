-- 店舗情報（名前・住所・URL）をlocalStorage単独管理から脱却し、
-- 端末・ブラウザをまたいで共有できるようDBに保存する
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text not null default '',
  url text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stores enable row level security;
create policy "Allow public read" on public.stores for select using (true);
create policy "Allow public insert" on public.stores for insert with check (true);
create policy "Allow public update" on public.stores for update using (true) with check (true);
create policy "Allow public delete" on public.stores for delete using (true);

grant select, insert, update, delete on public.stores to anon;
