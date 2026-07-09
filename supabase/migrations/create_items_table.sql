-- supabase/migrations/xxxx_create_items_table.sql
create table public.items (
  id bigint generated always as identity primary key,
  jan_code text not null,
  item_name text not null,
  official_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.items enable row level security;

create policy "誰でもデータを追加できるようにする" on public.items for insert with check (true);
create policy "誰でもデータを閲覧できるようにする" on public.items for select using (true);