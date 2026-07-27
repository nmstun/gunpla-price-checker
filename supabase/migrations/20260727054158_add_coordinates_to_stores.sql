-- 登録店舗をまとめて1つの地図にピン表示するための緯度経度。
-- Google Mapsの簡易埋め込み（output=embed）は住所を"|"で連結しても
-- ピンを複数立てられず、地図が広域にズームアウトするだけだったため、
-- 自前で座標を持ってOpenStreetMap上にマーカーを描画する方式に切り替える。
-- 住所から座標への変換（ジオコーディング）は保存時に一度だけ行い、ここに保持する
alter table public.stores add column latitude double precision;
alter table public.stores add column longitude double precision;
