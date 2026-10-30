# 合成速度ラボ（resultant_velocity）

高校物理基礎「速度の合成」を、**予想 → 作図 → 再生 → 照合**のくり返しで理解するための Web アプリ。

3つの窓で同じ運動を表す。

- ① **イメージ図**：流れる媒質（川など）と物体の運動。媒質に対する軌跡と地面に対する軌跡を並べて描く
- ② **ベクトル図**：方眼上で v₁・v₂・v を作図する
- ③ **成分表**：vx, vy の数値で成分ごとの和を確かめる

教師の提示に使う**探究モード**（3窓が自動連動）と、生徒が欠けた表現を自分で作る**練習モード**（非連動・答え合わせで連動）がある。

> 現在はフェーズ1（探究モード）まで実装済み。練習モードはフェーズ2で追加する。

## 開発

```bash
npm install
npm run dev          # 開発サーバー
npm test             # model の単体テスト（Vitest）
npm run build        # GitHub Pages 用のビルド（dist/）
npm run build:single # 1ファイルの試用版（dist-single/index.html）
```

main に push すると GitHub Actions がテストとビルドを行い、GitHub Pages に公開する（リポジトリの Settings → Pages で Source を「GitHub Actions」にしておく）。

## 仕様書

| ファイル | 内容 |
|---|---|
| [00_overview.md](docs/spec/00_overview.md) | 目的・対象・原案からの変更点 |
| [01_learning-design.md](docs/spec/01_learning-design.md) | 用語と記号、想定するつまずき、学習サイクル、段階、授業例 |
| [02_screen-layout.md](docs/spec/02_screen-layout.md) | 画面構成、画面サイズごとの配置、色の約束 |
| [03_scene-view.md](docs/spec/03_scene-view.md) | ① イメージ図 |
| [04_vector-view.md](docs/spec/04_vector-view.md) | ② ベクトル図ビュー |
| [05_table-view.md](docs/spec/05_table-view.md) | ③ 成分表ビュー |
| [06_modes-and-sync.md](docs/spec/06_modes-and-sync.md) | 探究モード・練習モードと同期 |
| [07_playback.md](docs/spec/07_playback.md) | 連続再生・コマ送り再生・比較表示 |
| [08_problems.md](docs/spec/08_problems.md) | 問題の型、収録問題、問題データ形式 |
| [09_judging-and-feedback.md](docs/spec/09_judging-and-feedback.md) | 判定、誤答診断、学習記録 |
| [10_tech-stack.md](docs/spec/10_tech-stack.md) | 技術構成とディレクトリ構成 |
| [11_roadmap.md](docs/spec/11_roadmap.md) | 開発フェーズと未決事項 |
| [12_acceleration.md](docs/spec/12_acceleration.md) | 加速度のある合成（放物線・直線になる場合） |

## 関連

- 相対速度アニメーター（[Shin-phys/Relative_speed_animator](https://github.com/Shin-phys/Relative_speed_animator)）
