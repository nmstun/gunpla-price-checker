-- 'bandai_msrp'（バンダイ公式サイトでJAN照合済みの希望小売価格）か
-- 'estimated'（量販店の実売価格から推定した目安価格）かを記録する
alter table public.items add column price_source text not null default 'estimated';

-- 同じJANコードの再スキャン時にupsertできるよう、updateの権限とポリシーを追加する
create policy "Allow public update" on public.items for update using (true) with check (true);
grant update on public.items to anon;
