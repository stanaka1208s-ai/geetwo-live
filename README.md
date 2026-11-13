# Gee Two LIVE 参加申し込み (Netlify版)

## 中身
- public/ … サイト本体 (index.html、写真2枚、楽譜用フォント)
- netlify/functions/entries.mjs … 申し込みの保存・一覧・削除 (Netlify Blobs に保存)
- netlify.toml / package.json … Netlify の設定

## 公開方法 (どちらか)
### A. GitHub 連携
1. このフォルダの中身をそのまま GitHub の新しいリポジトリに入れる
2. Netlify で「Add new site → Import an existing project」からそのリポジトリを選ぶ
3. 設定は netlify.toml から自動で入るので、そのまま Deploy

### B. Netlify CLI
    npm install
    npx netlify-cli login
    npx netlify-cli deploy --prod

※ 画面へのドラッグ&ドロップ公開では、申し込みの保存機能 (functions) が動きません。

## 申し込みの削除 (管理用)
1. Netlify の Site configuration → Environment variables に ADMIN_KEY を追加 (好きな合言葉)
2. 再デプロイ
3. https://<サイトのURL>/?admin=<合言葉> で開くと、各申し込みに「削除」ボタンが出ます

## メモ
- 申し込みは最大500件まで
- 一覧は約8秒ごとに自動更新
