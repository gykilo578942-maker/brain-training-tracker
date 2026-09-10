# 脳トレ管理アプリ 設計書

- 日付: 2026-09-10
- ステータス: 承認済み(ユーザー確認済み)

## 1. 目的

ライフワークとして続けている複数の「脳トレ」活動について、日々の実施記録を残し、
週/月/年単位で実施率・傾向を振り返れるようにする。クラウド(Firebase)にデータを
保存し、iPhoneのホーム画面にアプリとして追加してオフラインでも使えるようにする。

## 2. 対象ユーザー

本人のみ(単一ユーザー)。マルチユーザー対応・共有機能は不要。

## 3. 全体構成

- フロントエンド: 素のHTML/CSS/JavaScript(フレームワーク不使用)。ビルドツール不要。
- ホスティング: GitHub Pages(無料、静的サイト)。
- データ・認証: Firebase
  - Firestore Database(asia-northeast1) — データ保存
  - Authentication(メール/パスワード) — ログイン(本人のみ利用)
- PWA化: `manifest.json` + アイコン + Service Worker で、iPhone Safariの
  「ホーム画面に追加」でアドレスバーなしの単独アプリとして起動できるようにする。
  Service Workerはアプリ本体(HTML/CSS/JS)をキャッシュしてオフライン起動を可能にする。
  データ自体はFirestoreのオフライン永続化機能(`enableIndexedDbPersistence`)を使う。

### Firebase設定値(公開情報。APIキーは制限用でシークレットではない)

```js
const firebaseConfig = {
  apiKey: "AIzaSyB9lPb-I6I4RRGO9s-wNPvp1s3u8Nr4-hI",
  authDomain: "brain-training-tracker.firebaseapp.com",
  projectId: "brain-training-tracker",
  storageBucket: "brain-training-tracker.firebasestorage.app",
  messagingSenderId: "768684319007",
  appId: "1:768684319007:web:c0eea618fb06f68fd7502a"
};
```

## 4. データモデル(Firestore)

すべて認証済みユーザーの `users/{uid}/...` 以下に保存する(Firestoreセキュリティ
ルールで、リクエストの `uid` が自分自身のデータ以外にアクセスできないよう制限する)。

### `users/{uid}/activities/{activityId}`

脳トレ項目マスタ。

| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 項目名(例: "ランニング・筋トレ") |
| icon | string | 表示用の絵文字(例: "🏃") |
| color | string | 表示用の色コード |
| order | number | 表示順 |
| active | boolean | true=表示中, false=アーカイブ済み |
| createdAt | timestamp | 作成日時 |

初期投入する6件(実装時にアプリ初回起動時のシード処理として作成、コードへの
ハードコードではなくFirestoreへの初回書き込みで行う):

1. 🏃 ランニング・筋トレ
2. 🧘 瞑想
3. 🎸 楽器の練習
4. 📖 速読トレーニング
5. 🗣️ 英語学習
6. ♟️ チェスの練習

### `users/{uid}/logs/{date}` (date = "YYYY-MM-DD")

1日1ドキュメント。その日の全項目の実施状況をまとめて持つ。

| フィールド | 型 | 説明 |
|---|---|---|
| entries | map<activityId, {done: boolean, memo: string}> | 項目ごとの実施記録 |
| updatedAt | timestamp | 最終更新日時 |

日付をドキュメントIDにすることで、週/月/年の集計は `logs` コレクションを
`date` の範囲(文字列の辞書順 = 日付順になる "YYYY-MM-DD" 形式)で絞り込むだけで
取得できる。

## 5. 画面構成

1. **ログイン画面**: メール/パスワードでログイン。Firebase Authの永続化設定
   (`browserLocalPersistence`)により、以後は自動ログイン。
2. **今日の記録画面**(ホーム):
   - `active: true` の項目を一覧表示、各項目に○×トグルボタン+メモ入力欄(任意)
   - 上部の日付ピッキャーで別日を選択すれば、その日の記録も編集可能
3. **振り返り画面**:
   - 週/月/年タブ切り替え
   - 全体の実施率(%)
   - 項目ごとの実施率(横並びの棒グラフ)
   - 継続日数(現在のストリーク・最長ストリーク)
   - グラフはdataviz方針に沿って実装(シンプルなSVG/Canvasベースの自作、または
     軽量ライブラリをCDN経由で読み込み)
4. **項目管理画面**: 項目の追加・名称変更・並び替え・アーカイブ切り替え

## 6. セキュリティルール(Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 7. デプロイ

- このフォルダ(`脳トレ管理アプリ`)をGitHubリポジトリとして作成しプッシュ
- リポジトリの Settings → Pages でGitHub Pagesを有効化(ブランチ: `main`, ルート)
- 公開URL: `https://<ユーザー名>.github.io/<リポジトリ名>/`
- 以後の更新はコミット→プッシュのみで反映(Service Workerのキャッシュ更新を
  含めて自動反映されるようにバージョニングを行う)

## 8. iPhoneへのインストール

公開URLをiPhone SafariでOpen → 共有ボタン → 「ホーム画面に追加」。
詳細手順はユーザーへの案内済み。

## 9. スコープ外(今回はやらない)

- マルチユーザー・共有機能
- プッシュ通知によるリマインダー(将来的な拡張候補)
- チェス・ギター等の既存の専用スキル(chess-kifu-review, guitar-practice-journal等)
  との連携・データ統合(今回は完全に独立した「実施記録」のみ)

## 10. 将来の拡張候補(今回は実装しない)

- リマインダー通知
- 既存の専用スキル(チェス棋譜解析、ギター練習レビュー等)からの実施記録の自動連携
