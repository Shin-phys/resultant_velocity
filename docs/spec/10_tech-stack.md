# 10 技術構成

## 1. 方針

- 相対速度アニメーターとそろえ、**Vite + TypeScript + React** のモジュール構成にする。管理・改訂しやすさを優先し、単一 HTML にはしない。
- 描画はすべて **SVG**（React で直接描く）。2D 俯瞰で要素数も少なく、タッチ操作の当たり判定やダークモード対応が扱いやすいため。three.js は使わない。
- 依存ライブラリは最小限にする。状態管理は React の `useReducer` ＋ Context で足りる想定。
- 公開は **GitHub Pages**（GitHub Actions でビルドして配信）。

## 2. ディレクトリ構成（案）

```
src/
  model/                 # 物理と判定。React に依存しない純粋な関数だけ
    vector.ts            #   2次元ベクトル（整数）演算
    kinematics.ts        #   位置・軌跡・終了時刻の計算
    viewport.ts          #   ①の表示範囲の決定（答えが推測できない対称な範囲）
    judge.ts             #   作図・成分表・予想の判定
    diagnose.ts          #   誤答パターン D1〜D6 の診断
    problems.ts          #   問題データの読み込み・検証・類題生成
  state/
    store.ts             # アプリ状態（モード、v₁, v₂, 再生状態、練習中の入力）
    actions.ts
  views/
    scene/               # ① 場面ビュー（媒質シート、物体、軌跡、予想）
    vector/              # ② ベクトル図ビュー（方眼、矢印、ハンドル）
    table/               # ③ 成分表ビュー
  playback/
    continuous.ts        # 連続再生
    stepper.ts           # コマ送り（(a)→(b)→(c)）
  ui/                    # ヘッダー、操作バー、フィードバック欄、記録画面
  skins/                 # 川と船、風と飛行機、動く歩道と人
  data/problems/         # stage1.json 〜 stage4.json
  styles/                # 色トークン（v₁=青, v₂=緑, v=赤）、ダークモード
tests/                   # model/ の単体テスト（Vitest）
docs/spec/               # この仕様書
```

## 3. 実装上の約束

- 物理量はすべて SI（m, s, m/s）で `model/` 内に持ち、画面の座標変換は `views/` 側で行う。
- `model/` には単体テストを書く。特に、収録問題の正答（[08_problems.md](08_problems.md) の表の値）がそのまま計算で再現されることをテストで確かめる。
- 色は CSS 変数（トークン）で定義し、どの窓でも同じトークンを使う（[02_screen-layout.md](02_screen-layout.md) の色の約束）。
- 画面の文言は日本語。ルビは使わない。
- アニメーションは `requestAnimationFrame` で進め、経過時間はフレーム間隔から計算する（端末の性能差で速さが変わらないように）。
- 学習記録の保存（localStorage）は読み書きを try/catch で包み、保存できない環境でも動くようにする。
- オフラインでの再訪に備え、ビルド成果物は外部 CDN に依存しない。
