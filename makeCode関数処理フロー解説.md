# makeCode関数の処理フロー解説

## 概要
`makeCode`関数は、QRコードライブラリのメイン処理となる関数で、テキストデータからQRコードを生成し、DOM要素に描画する処理を担当します。

## 処理フロー

### 1. 関数の定義と位置
- **場所**: `index.js:1427-1442`
- **クラス**: `QRCode.prototype.makeCode`
- **引数**: `sText` - QRコードに含めるテキストデータ

### 2. 詳細な処理ステップ

#### ステップ1: QRCodeModelインスタンスの生成 (`index.js:1429-1432`)
```javascript
this._oQRCode = new QRCodeModel(
  _getTypeNumber(sText, this._htOption.correctLevel),
  this._htOption.correctLevel
);
```

**処理内容:**
- `_getTypeNumber`関数でテキストの長さとエラー訂正レベルから最適なQRコードバージョンを計算
- バージョン（typeNumber）とエラー訂正レベルを指定してQRCodeModelインスタンスを作成

#### ステップ2: データの追加 (`index.js:1434`)
```javascript
this._oQRCode.addData(sText);
```

**処理内容:**
- QRCodeModelの`addData`メソッドでテキストデータを追加
- 内部で`QR8bitByte`インスタンスが作成され、UTF-8エンコーディング処理が実行される

#### ステップ3: QRコードの生成 (`index.js:1435`)
```javascript
this._oQRCode.make();
```

**処理内容:**
- QRCodeModelの`make`メソッドを呼び出し
- 最適なマスクパターンの自動選択
- 各種パターン（位置検出、タイミング、位置合わせ）の配置
- データのマッピング処理

#### ステップ4: DOM要素への属性設定 (`index.js:1437`)
```javascript
this._el.title = sText;
```

**処理内容:**
- 描画対象のDOM要素のtitle属性にテキストを設定
- ツールチップでQRコードの内容を確認可能

#### ステップ5: QRコードの描画 (`index.js:1439`)
```javascript
this._oDrawing.draw(this._oQRCode);
```

**処理内容:**
- 描画器（Drawing）インスタンスのdrawメソッドを実行
- 使用される描画方法は環境により自動選択:
  - SVG描画（SVG環境）
  - Canvas描画（Canvasサポート環境）

#### ステップ6: 画像化処理 (`index.js:1441`)
```javascript
this.makeImage();
```

**処理内容:**
- Canvas使用時にPNG画像として変換
- SVGやTable描画時は何も実行されない

## 主要な関連処理

### _getTypeNumber関数 (`index.js:1307-1341`)
テキストの長さからQRコードのバージョンを決定する関数です。

**処理ロジック:**
1. UTF-8文字長を計算
2. エラー訂正レベル別の容量制限テーブルと照合
3. データが収まる最小のバージョンを返却

### QRCodeModel.make() の内部処理
1. **makeImpl()呼び出し** - 最適なマスクパターンで実装
2. **getBestMaskPattern()** - 8種類のマスクパターンを試行してペナルティ最小を選択
3. **各種パターン配置:**
   - 位置検出パターン（3つの角の正方形）
   - タイミングパターン（読み取り精度向上の白黒交互パターン）
   - 位置合わせパターン（大型QRコード用）
   - 形式情報・バージョン情報の配置
4. **データマッピング** - エンコードされたデータを実際のモジュールに配置

## 描画処理の分岐

### Canvas描画 (`index.js:1168-1297`)
- 高品質な描画が可能
- PNG画像として出力可能
- アンチエイリアシング処理を含む

### SVG描画 (`index.js:1026-1098`)
- ベクター形式でスケーラブル
- viewBox使用でレスポンシブ対応
- use要素で効率的な描画

### Table描画 (`index.js:1106-1167`)
- Canvasが使用できない古いブラウザ向け
- HTMLテーブル要素でピクセル単位描画
- マージン調整で中央配置

## エラーハンドリング

- **容量超過**: テキストが長すぎる場合は`"Too long data"`エラー
- **無効なバージョン**: サポートされていないQRコードバージョンの場合はエラー
- **マスクパターンエラー**: 無効なマスクパターン指定時はエラー

## まとめ

`makeCode`関数は、QRコード生成の全工程を統括する中心的な関数です。テキスト入力から最終的な描画まで、データエンコーディング、QRコード構造の生成、最適化、そして環境に応じた描画処理まで、複雑な処理を段階的に実行します。