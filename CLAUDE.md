# team-ops-web

少年サッカーチーム運営ツールのWeb画面(React + TypeScript + Vite)。スマホのブラウザが主な利用環境。
要件・機能仕様・デザインの方向性(ADR-0007)は ../team-ops にある。

## コマンド

- 開発サーバー:`npm run dev`(/api は team-ops-api にプロキシされる)
- テスト:`npm test`(Vitest + Testing Library)
- lint:`npm run lint`(oxlint)
- 型チェック:`npm run typecheck`

## 設計ルール

- 構成:`src/features/<機能>/` に画面・部品・テストをまとめる。共通部品は `src/components/`
- API:team-ops-api だけを呼ぶ。notify-relay を直接呼ばない。APIの型は OpenAPI から生成したものを使い、手書きしない
- デザイン:色・書体・角丸は `src/styles/tokens.css` の変数だけを使う。値を直接書かない
- アクセシビリティ:ボタンは `<button>`、遷移は `<a href>`、入力には `<label>`。タップ領域は44px以上。文字のコントラストは WCAG AA
- 日本語:改行は文節単位(word-break: auto-phrase は tokens/index.css で設定済み)

## テスト

- 受け入れ基準のIDをテスト名に入れる(例:`AC-005-02 shows the recipient count`)
- 画面のテストは、利用者に見える文言とロールで要素を探す(getByRole / getByText)
