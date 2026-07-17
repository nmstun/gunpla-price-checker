-- Yahoo!出品名にプレミアムバンダイ（プレバン）限定を示す目印があったかどうかを記録する。
-- プレバン限定品は説明書サイトの索引に無いことが多く定価が未確認になりやすいため、
-- UI側でその理由をユーザーに伝えるバッジ表示に使う
alter table public.scan_history add column is_premium_bandai_exclusive boolean not null default false;
alter table public.items add column is_premium_bandai_exclusive boolean not null default false;
