-- 定価（official_price）を手動で入力・編集できるようにする。
-- バンダイ公式で照合できた定価（公式照合済み）と、ユーザーが手動入力した定価は
-- 意味が異なる（後者は「確認できないので手で入れた値」）ため、フラグで区別して
-- UI上のバッジ表示を変える。既存行・新規スキャンは全て公式照合由来なので default false
alter table public.scan_history add column official_price_is_manual boolean not null default false;
