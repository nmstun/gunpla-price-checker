@AGENTS.md

## バージョン番号
`package.json`の`version`は画面右上に常時表示される（README参照）。src/配下のコードに変更を加えてコミットする際は、機能追加か不具合修正かを問わず`package.json`の`version`をパッチ/マイナー単位で上げること。`package-lock.json`にも同じ`version`が2箇所（ルートと`packages[""]`）あるため、両方とも個別に編集する（`replace_all`は使わない。他パッケージのversionまで書き換えてしまうため）。
