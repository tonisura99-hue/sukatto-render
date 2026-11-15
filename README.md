# sukatto-render

縦型ショート動画の描画コード（[Remotion](https://www.remotion.dev/)）と、検品用の静止画を焼くワークフロー。

## 中身

| 場所 | 中身 |
|---|---|
| `src/` | 描画のコード（Remotion の部品） |
| `public/fonts/` | 字体3つ（SIL Open Font License 1.1）と、ライセンスの文・出どころ（`README.txt`） |
| `tools/stills_v2.mjs` | 指定したコマを PNG の静止画で焼く |
| `tools/qa_frames.py` | 検品で見るコマの表を作る |
| `tools/episode_assets.py` | 1回分を焼くのに要るファイルの一覧を作る |
| `tools/fetch_private.py` | 焼く前に、非公開の倉庫から「その回の物だけ」を読み取り専用の鍵で取る |
| `.github/workflows/qa-stills.yml` | 検品用の静止画を焼くワークフロー（手で起動するだけ） |

## この倉庫に無い物

素材（絵・声・音楽・台本）はここには置かない（絵と音楽は再配布できない）。
ワークフローが焼く時だけ非公開の倉庫から取り、成果物にもログにも出さない（焼き終われば実行の環境ごと消える）。

## 使い方

1. 倉庫の **Settings → Secrets and variables → Actions** に `SUKATTO_ASSETS_TOKEN` を置く（非公開の倉庫1つだけ・Contents の読み取りだけの fine-grained token・期限つき）
2. **Actions → qa-stills → Run workflow** で、回の名前と非公開の倉庫の版（40桁の sha）を入れて起動する
   - コマを空にすると `tools/qa_frames.py` の表（33コマ）を焼く
3. 成果物（PNG だけ・3日で消える）を空のフォルダへ落とす：`gh run download <実行の番号> -R tonisura99-hue/sukatto-render -D <空のフォルダ>`

- ⚠️ このワークフローは動画（mp4）を焼かない。描画のコードを試す静止画だけ
- ⚠️ `tools/fetch_private.py` は、この倉庫のコードが非公開の倉庫のその版と同じでなければ止まる（検品の絵と本番の動画が別のコードになるのを防ぐ）

## ライセンス

`public/fonts/` の字体は SIL Open Font License 1.1（`public/fonts/OFL-*.txt`）。
