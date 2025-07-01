# QRコード生成ライブラリ (index.js) Step-by-Step詳細解説

## 📖 QRコードとは何か？基本的な仕組みの理解

### QRコードの基本構造
QRコード（Quick Response Code）は、1994年にデンソーウェーブが開発した2次元バーコードです。白と黒の正方形のセル（モジュール）で構成され、縦横どちらの方向からも読み取れます。

### QRコードの主要構成要素

#### 1. 位置検出パターン（Finder Pattern）
```
■■■■■■■
■　　　　　■
■　■■■　■  ← これが3つの角にある
■　■■■　■
■　■■■　■
■　　　　　■
■■■■■■■
```
**役割**: QRコードリーダーがコードの位置と方向を認識
**配置**: 左上、右上、左下の3箇所

#### 2. タイミングパターン（Timing Pattern）
```
■　■　■　■　■
```
**役割**: モジュールの境界を正確に検出
**配置**: 6行目と6列目に白黒交互のパターン

#### 3. 位置合わせパターン（Alignment Pattern）
```
■■■■■
■　　　■
■　■　■  ← 小さな正方形パターン
■　　　■
■■■■■
```
**役割**: 大きなQRコードでの読み取り精度向上
**配置**: バージョン2以上で配置位置が決まっている

#### 4. 形式情報（Format Information）
**役割**: エラー訂正レベルとマスクパターンの情報
**配置**: 位置検出パターンの周囲

#### 5. データ領域
**役割**: 実際の情報とエラー訂正符号
**配置**: 上記以外の全領域

### QRコードのサイズ（バージョン）
- **バージョン1**: 21×21 モジュール
- **バージョン2**: 25×25 モジュール
- **バージョン40**: 177×177 モジュール
- 計算式: `(バージョン × 4) + 17`

### エラー訂正の仕組み
QRコードは Reed-Solomon エラー訂正符号を使用：

#### エラー訂正レベル
- **L (Low)**: 約7%のエラー復旧可能
- **M (Medium)**: 約15%のエラー復旧可能  
- **Q (Quartile)**: 約25%のエラー復旧可能
- **H (High)**: 約30%のエラー復旧可能

#### なぜエラー訂正が必要？
- QRコードが汚れたり欠けたりしても読み取り可能
- 印刷品質が悪くても機能する
- カメラのピンボケや歪みに対応

### データエンコーディングモード
QRコードは内容に応じて最適なエンコード方式を選択：

1. **数字モード**: 0-9の数字のみ（最も効率的）
2. **英数字モード**: 0-9, A-Z, スペース, $ % * + - . / :
3. **8ビットバイトモード**: 任意のバイナリデータ（このライブラリが使用）
4. **漢字モード**: Shift JIS の漢字

### マスクパターンの役割
データをそのまま配置すると、読み取りにくいパターンができる場合があります：

#### 問題のあるパターン例
- 同じ色のセルが大量に連続する
- ファインダーパターンに似た模様ができる
- データが偏って配置される

#### マスクパターンによる解決
8種類の数学的パターンでデータを「マスク」（反転）して、最も読み取りやすいパターンを選択

### QRコード生成の基本フロー
```
テキスト入力
    ↓
UTF-8エンコーディング
    ↓
データサイズに応じたバージョン選択
    ↓
モジュール配列の初期化
    ↓
機能パターンの配置
    ↓
データのエンコード・エラー訂正符号生成
    ↓
8種類のマスクパターンで最適化
    ↓
データのジグザグ配置
    ↓
SVG/Canvasで視覚化
```

## 概要
このドキュメントでは、上記のQRコードの仕組みを踏まえて、QRコード生成JavaScriptライブラリの動作を実際の処理フローに沿って、step-by-stepで詳細に解説します。

## 🚀 Step 1: 初期化とライブラリ構造の準備

### Step 1.1: グローバル変数の宣言 (1-2行目)
```javascript
// QRCodeライブラリの全グローバル変数を定義
var QRCode;
```
**何をしているか**: 
- グローバルスコープに`QRCode`変数を宣言
- この変数が後でライブラリの公開APIとなる

### Step 1.2: 即座実行関数によるカプセル化 (5行目, 1399行目)
```javascript
(function () {
  // 全ての処理がここに含まれる
})();
```
**何をしているか**:
1. 無名関数を定義して即座に実行
2. プライベートスコープを作成し、グローバル名前空間の汚染を防止
3. 内部の変数や関数を外部から隠蔽

**なぜこうするのか**:
- 他のライブラリとの名前衝突を防ぐ
- 内部実装の詳細を隠蔽してAPIを明確にする

## 🔤 Step 2: UTF-8文字エンコーディング処理

### Step 2.1: QR8bitByteクラスの定義開始 (7-14行目)
```javascript
function QR8bitByte(data) {
  // 8ビットバイトモードに設定
  this.mode = QRMode.MODE_8BIT_BYTE;
  // 元データを保存
  this.data = data;
  // UTF-8エンコード用の解析済みデータ配列を初期化
  this.parsedData = [];
```
**何をしているか**:
1. 8ビットバイトモードでデータを処理するクラスを定義
2. 入力データを保存
3. UTF-8バイト配列を格納する配列を初期化

### Step 2.2: 文字列の1文字ずつ処理ループ (16-19行目)
```javascript
// UTF-8文字をサポートするための処理
for (var i = 0, l = this.data.length; i < l; i++) {
  var byteArray = [];
  // 文字のUnicodeコードポイントを取得
  var code = this.data.charCodeAt(i);
```
**何をしているか**:
1. 入力文字列を1文字ずつ処理するループを開始
2. 各文字用のバイト配列を初期化
3. `charCodeAt()`でUnicodeコードポイントを取得

### Step 2.3: 4バイト文字の処理 (22-26行目)
```javascript
// 4バイト文字（0x10000以上）の場合
if (code > 0x10000) {
  byteArray[0] = 0xf0 | ((code & 0x1c0000) >>> 18);
  byteArray[1] = 0x80 | ((code & 0x3f000) >>> 12);
  byteArray[2] = 0x80 | ((code & 0xfc0) >>> 6);
  byteArray[3] = 0x80 | (code & 0x3f);
```
**何をしているか**:
1. Unicodeコードポイントが65536以上かチェック
2. UTF-8の4バイト表現に変換:
   - 第1バイト: `11110xxx` (先頭4ビット固定、下位3ビットに上位3ビット)
   - 第2バイト: `10xxxxxx` (先頭2ビット固定、下位6ビットに次の6ビット)
   - 第3バイト: `10xxxxxx` (先頭2ビット固定、下位6ビットに次の6ビット)
   - 第4バイト: `10xxxxxx` (先頭2ビット固定、下位6ビットに最後の6ビット)

**詳細な計算例**:
- コードポイント 0x1F600 (😀絵文字)の場合:
  - `0x1c0000`: マスク `0001 1100 0000 0000 0000 0000`
  - `>>> 18`: 18ビット右シフト
  - `0xf0 |`: `11110000` とOR演算

### Step 2.4: 3バイト文字の処理 (28-31行目)
```javascript
} else if (code > 0x800) {
  // 3バイト文字（0x800以上）の場合
  byteArray[0] = 0xe0 | ((code & 0xf000) >>> 12);
  byteArray[1] = 0x80 | ((code & 0xfc0) >>> 6);
  byteArray[2] = 0x80 | (code & 0x3f);
```
**何をしているか**:
1. Unicodeコードポイントが2048以上65535以下かチェック
2. UTF-8の3バイト表現に変換
3. 日本語文字（ひらがな、カタカナ、漢字）はここで処理される

### Step 2.5: 2バイト文字の処理 (33-35行目)
```javascript
} else if (code > 0x80) {
  // 2バイト文字（0x80以上）の場合
  byteArray[0] = 0xc0 | ((code & 0x7c0) >>> 6);
  byteArray[1] = 0x80 | (code & 0x3f);
```
**何をしているか**:
1. Unicodeコードポイントが128以上2047以下かチェック
2. UTF-8の2バイト表現に変換
3. 拡張ASCII文字などがここで処理される

### Step 2.6: 1バイト文字(ASCII)の処理 (37-39行目)
```javascript
} else {
  // 1バイト文字（ASCII）の場合
  byteArray[0] = code;
}
```
**何をしているか**:
1. Unicodeコードポイントが127以下（ASCII文字）
2. そのままバイト値として格納
3. 英数字、記号などの基本文字

### Step 2.7: バイト配列の追加 (41-43行目)
```javascript
// バイト配列をパースデータに追加
this.parsedData.push(byteArray);
```
**何をしているか**:
- 各文字のUTF-8バイト配列を`parsedData`に追加
- この時点では2次元配列（文字ごとにバイト配列）

### Step 2.8: 配列の平坦化 (45-46行目)
```javascript
// 2次元配列を1次元配列に平坦化
this.parsedData = Array.prototype.concat.apply([], this.parsedData);
```
**何をしているか**:
1. `concat.apply`を使って2次元配列を1次元配列に変換
2. 例: `[[72, 101], [108, 108], [111]]` → `[72, 101, 108, 108, 111]`

**なぜこうするのか**:
- QRコードはバイトストリームとしてデータを処理するため

### Step 2.9: UTF-8 BOM（Byte Order Mark）の処理 (48-53行目)
```javascript
// UTF-8のBOM（Byte Order Mark）が必要な場合は先頭に追加
if (this.parsedData.length != this.data.length) {
  this.parsedData.unshift(191); // 0xBF
  this.parsedData.unshift(187); // 0xBB
  this.parsedData.unshift(239); // 0xEF
}
```
**何をしているか**:
1. パース後のバイト数と元の文字数を比較
2. 異なる場合（マルチバイト文字を含む場合）は UTF-8 BOMを先頭に追加
3. BOM: `EF BB BF` (239, 187, 191)

**なぜこうするのか**:
- UTF-8エンコーディングであることを明示
- 文字化けを防ぐため

**QRコード仕様上の意味**:
- QRコードは「8ビットバイトモード」でデータを格納
- UTF-8は国際的な文字エンコーディング標準
- 日本語、絵文字、特殊文字なども正確に表現可能

## 🏗️ Step 3: QRCodeModelクラス - QRコードの構造構築

### Step 3.1: QRCodeModelクラスの初期化 (72-85行目)
```javascript
function QRCodeModel(typeNumber, errorCorrectLevel) {
  // QRコードのバージョン（サイズ）
  this.typeNumber = typeNumber;
  // エラー訂正レベル
  this.errorCorrectLevel = errorCorrectLevel;
  // QRコードのモジュール（セル）配列
  this.modules = null;
  // モジュール数（一辺のセル数）
  this.moduleCount = 0;
  // データキャッシュ
  this.dataCache = null;
  // データリスト
  this.dataList = [];
}
```
**何をしているか**:
1. QRコードのバージョン（1-40）を設定
2. エラー訂正レベル（L/M/Q/H）を設定
3. QRコードを構成する要素を初期化

**各プロパティの役割**:
- `typeNumber`: QRコードサイズ決定（バージョン1=21×21、バージョン2=25×25...）
- `modules`: 2次元配列でQRコードの各セル（黒/白）を表現
- `dataList`: エンコードするデータのリスト

**QRコード仕様上の意味**:
- `typeNumber`はISO/IEC 18004で定義されたQRコードバージョン
- バージョンが大きいほど多くのデータを格納可能
- `modules`は最終的なQRコードの視覚的表現

### Step 3.2: データ追加メソッド (90-95行目)
```javascript
// データを追加するメソッド
addData: function (data) {
  var newData = new QR8bitByte(data);
  this.dataList.push(newData);
  // データが追加されたのでキャッシュをクリア
  this.dataCache = null;
},
```
**何をしているか**:
1. 入力データを`QR8bitByte`でUTF-8エンコード
2. データリストに追加
3. 既存のキャッシュをクリア

## 🎯 Step 4: QRコード生成のメインフロー

### Step 4.1: make メソッドの開始 (114-116行目)
```javascript
// QRコードを生成する（最適なマスクパターンを自動選択）
make: function () {
  this.makeImpl(false, this.getBestMaskPattern());
},
```
**何をしているか**:
1. 最適なマスクパターンを取得
2. 実際の生成処理(`makeImpl`)を呼び出し

### Step 4.2: モジュール配列の初期化 (119-128行目)
```javascript
// モジュール数を計算（バージョン * 4 + 17）
this.moduleCount = this.typeNumber * 4 + 17;
// 2次元配列を初期化
this.modules = new Array(this.moduleCount);
for (var row = 0; row < this.moduleCount; row++) {
  this.modules[row] = new Array(this.moduleCount);
  for (var col = 0; col < this.moduleCount; col++) {
    this.modules[row][col] = null;
  }
}
```
**何をしているか**:
1. QRコードサイズを計算（バージョン1=21×21、バージョン2=25×25...）
2. 2次元配列を作成
3. 全セルを`null`で初期化

**サイズ計算の例**:
- バージョン1: 1 × 4 + 17 = 21×21
- バージョン2: 2 × 4 + 17 = 25×25
- バージョン10: 10 × 4 + 17 = 57×57

### Step 4.3: 位置検出パターンの配置 (130-132行目)
```javascript
// 位置検出パターンを配置（3つの角）
this.setupPositionProbePattern(0, 0);
this.setupPositionProbePattern(this.moduleCount - 7, 0);
this.setupPositionProbePattern(0, this.moduleCount - 7);
```
**何をしているか**:
1. 左上角に位置検出パターンを配置
2. 右上角に位置検出パターンを配置  
3. 左下角に位置検出パターンを配置

**位置検出パターンとは**:
- QRコードの3つの角にある大きな正方形
- QRコードリーダーが位置と方向を認識するために使用

**QRコード仕様上の重要性**:
- カメラで撮影する際、どの角度からでも認識可能
- 3つのパターンで回転角度も検出
- 7×7モジュールの固定パターン（1:1:3:1:1の比率）

### Step 4.4: 位置検出パターンの詳細実装 (155-172行目)
```javascript
setupPositionProbePattern: function (row, col) {
  for (var r = -1; r <= 7; r++) {
    if (row + r <= -1 || this.moduleCount <= row + r) continue;
    for (var c = -1; c <= 7; c++) {
      if (col + c <= -1 || this.moduleCount <= col + c) continue;
      // 位置検出パターンの形状を定義
      if (
        (0 <= r && r <= 6 && (c == 0 || c == 6)) ||
        (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
        (2 <= r && r <= 4 && 2 <= c && c <= 4)
      ) {
        this.modules[row + r][col + c] = true;
      } else {
        this.modules[row + r][col + c] = false;
      }
    }
  }
}
```
**何をしているか**:
1. 9×9の範囲（-1から7まで）をスキャン
2. 境界チェック（配列の範囲外アクセスを防ぐ）
3. パターン形状の判定:
   - 外枠（r=0,6 または c=0,6）: 黒
   - 中央部（r=2-4 かつ c=2-4）: 黒
   - それ以外: 白

**パターンの形状**:
```
■■■■■■■
■　　　　　■
■　■■■　■
■　■■■　■
■　■■■　■
■　　　　　■
■■■■■■■
```

### Step 4.5: タイミングパターンの配置 (189-206行目)
```javascript
setupTimingPattern: function () {
  // 縦のタイミングパターン（6列目）
  for (var r = 8; r < this.moduleCount - 8; r++) {
    if (this.modules[r][6] != null) {
      continue;
    }
    // 偶数行は黒、奇数行は白
    this.modules[r][6] = r % 2 == 0;
  }
  // 横のタイミングパターン（6行目）
  for (var c = 8; c < this.moduleCount - 8; c++) {
    if (this.modules[6][c] != null) {
      continue;
    }
    // 偶数列は黒、奇数列は白
    this.modules[6][c] = c % 2 == 0;
  }
}
```
**何をしているか**:
1. 6行目に横方向のタイミングパターンを配置
2. 6列目に縦方向のタイミングパターンを配置
3. 既に値が設定されているセルはスキップ
4. 偶数位置を黒、奇数位置を白に設定

**タイミングパターンとは**:
- QRコードの読み取り精度を向上させる白黒交互パターン
- スキャナーがモジュールの境界を正確に検出するために使用

**QRコード仕様上の重要性**:
- 印刷やカメラの歪みを補正
- モジュールサイズの基準線として機能
- 必ず6行目・6列目に配置される（QR仕様で固定）

## 🎭 Step 5: マスクパターンの最適化

### Step 5.1: 最適マスクパターンの選択プロセス (174-187行目)
```javascript
getBestMaskPattern: function () {
  var minLostPoint = 0;
  var pattern = 0;
  // 8種類のマスクパターンを試して最適なものを選択
  for (var i = 0; i < 8; i++) {
    this.makeImpl(true, i);
    var lostPoint = QRUtil.getLostPoint(this);
    if (i == 0 || minLostPoint > lostPoint) {
      minLostPoint = lostPoint;
      pattern = i;
    }
  }
  return pattern;
}
```
**何をしているか**:
1. 8種類すべてのマスクパターンを試行
2. 各パターンでQRコードを生成（テストモード）
3. ペナルティポイントを計算
4. 最小ペナルティポイントのパターンを選択

**なぜ8種類試すのか**:
- QRコードの読み取り性能を最大化するため
- 同色セルの連続やパターンの偏りを最小化

**QRコード仕様上の重要性**:
- ISO/IEC 18004で8種類のマスクパターンが規定
- リーダーの誤読を防ぐ「ペナルティルール」で評価
- 最適パターンで読み取り成功率が大幅に向上

### Step 5.2: マスクパターンの適用 (512-533行目)
```javascript
getMask: function (maskPattern, i, j) {
  switch (maskPattern) {
    case QRMaskPattern.PATTERN000:
      return (i + j) % 2 == 0;
    case QRMaskPattern.PATTERN001:
      return i % 2 == 0;
    case QRMaskPattern.PATTERN010:
      return j % 3 == 0;
    case QRMaskPattern.PATTERN011:
      return (i + j) % 3 == 0;
    case QRMaskPattern.PATTERN100:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
    case QRMaskPattern.PATTERN101:
      return ((i * j) % 2) + ((i * j) % 3) == 0;
    case QRMaskPattern.PATTERN110:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0;
    case QRMaskPattern.PATTERN111:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 == 0;
    default:
      throw new Error("bad maskPattern:" + maskPattern);
  }
}
```
**何をしているか**:
1. 座標(i,j)に対してマスクパターンを適用
2. パターンごとに異なる数式で判定
3. `true`の場合はデータビットを反転

**各パターンの特徴と数式**:
- **パターン0**: `(i + j) % 2 == 0` - チェッカーボード模様
- **パターン1**: `i % 2 == 0` - 横縞模様
- **パターン2**: `j % 3 == 0` - 縦の3分割線
- **パターン3**: `(i + j) % 3 == 0` - 斜めの3分割線
- **パターン4**: `(floor(i/2) + floor(j/3)) % 2 == 0` - 複合パターン
- **パターン5**: `((i*j) % 2) + ((i*j) % 3) == 0` - 乗算ベース
- **パターン6**: `(((i*j) % 2) + ((i*j) % 3)) % 2 == 0` - 複雑な乗算
- **パターン7**: `(((i*j) % 3) + ((i+j) % 2)) % 2 == 0` - 最も複雑

**マスクの仕組み**:
- 数式が`true`を返す位置のデータビットを反転
- 機能パターン（位置検出、タイミングなど）は影響を受けない
- 各パターンで異なる視覚的効果を生成

## 📊 Step 6: データエンコーディングとエラー訂正

### Step 6.1: データエンコーディングの開始 (310-321行目)
```javascript
QRCodeModel.createData = function (typeNumber, errorCorrectLevel, dataList) {
  var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
  var buffer = new QRBitBuffer();
  for (var i = 0; i < dataList.length; i++) {
    var data = dataList[i];
    buffer.put(data.mode, 4);
    buffer.put(
      data.getLength(),
      QRUtil.getLengthInBits(data.mode, typeNumber)
    );
    data.write(buffer);
  }
```
**何をしているか**:
1. Reed-Solomon ブロック情報を取得
2. ビットバッファを初期化
3. 各データに対して:
   - モード情報（4ビット）を書き込み
   - データ長を書き込み
   - 実データを書き込み

**QRコード データストリーム構造**:
```
[モード指示子(4bit)] [文字数指示子(8-16bit)] [データ] [ターミネータ(0000)] [パディング]
```

**モード指示子の意味**:
- `0001`: 数字モード
- `0010`: 英数字モード  
- `0100`: 8ビットバイトモード（このライブラリが使用）
- `1000`: 漢字モード

### Step 6.2: パディング処理 (335-350行目)
```javascript
if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
  buffer.put(0, 4);
}
while (buffer.getLengthInBits() % 8 != 0) {
  buffer.putBit(false);
}
while (true) {
  if (buffer.getLengthInBits() >= totalDataCount * 8) {
    break;
  }
  buffer.put(QRCodeModel.PAD0, 8);
  if (buffer.getLengthInBits() >= totalDataCount * 8) {
    break;
  }
  buffer.put(QRCodeModel.PAD1, 8);
}
```
**何をしているか**:
1. ターミネータ（0000）を追加（容量に余裕がある場合）
2. 8ビット境界に合わせるためのパディング
3. 容量を満たすまで交互パディングパターン（EC 11）を追加

**QRコード仕様上のパディング**:
- **ターミネータ**: データの終了を示す`0000`
- **ビット境界調整**: 8ビット単位にするため0で埋める
- **パディングコードワード**: `11101100` (EC) と `00010001` (11) を交互に配置
- 規定の容量を完全に使い切るまで繰り返し

### Step 6.3: Reed-Solomon エラー訂正符号の生成 (353-399行目)

**Reed-Solomon符号とは**:
- CD、DVD、QRコードで使われる強力なエラー訂正技術
- 有限体（ガロア体）の数学を使用
- バイトレベルでの誤り検出・訂正が可能
- QRコードのエラー訂正レベルL/M/Q/Hに対応

**なぜエラー訂正が必要か**:
- 印刷のかすれ、汚れ、破損への対処
- カメラの焦点ボケ、光の反射への対処
- データの一部が読めなくても復元可能

この処理は非常に複雑ですが、step-by-stepで説明します：

#### Step 6.3.1: データコードワードの分離
```javascript
for (var r = 0; r < rsBlocks.length; r++) {
  var dcCount = rsBlocks[r].dataCount;
  dcdata[r] = new Array(dcCount);
  for (var i = 0; i < dcdata[r].length; i++) {
    dcdata[r][i] = 0xff & buffer.buffer[i + offset];
  }
  offset += dcCount;
```
**何をしているか**:
1. 各RSブロックのデータ部分を抽出
2. バイト単位でデータを分離

**RSブロック分離の目的**:
- 大きなQRコードは複数のブロックに分割
- 各ブロックで独立してエラー訂正符号を計算
- ブロック間でのエラー分散により訂正能力向上

#### Step 6.3.2: エラー訂正符号の計算
```javascript
var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
var modPoly = rawPoly.mod(rsPoly);
```
**何をしているか**:
1. エラー訂正用の生成多項式を取得
2. データを多項式として表現
3. 多項式の除算を実行してエラー訂正符号を算出

**ガロア体演算の仕組み**:
- 通常の演算とは異なる「有限体」での計算
- 8ビット（256通り）の範囲で循環演算
- 加算は XOR演算、乗算は特殊なテーブル使用
- この数学により強力なエラー訂正が実現

#### Step 6.3.3: インターリーブ配置
```javascript
// データコードワードのインターリーブ
for (var i = 0; i < maxDcCount; i++) {
  for (var r = 0; r < rsBlocks.length; r++) {
    if (i < dcdata[r].length) {
      data[index++] = dcdata[r][i];
    }
  }
}
```
**何をしているか**:
1. 複数のRSブロックのデータを交互に配置
2. エラー訂正符号も同様に交互配置
3. バースト（連続）エラーに対する耐性を向上

**インターリーブの重要性**:
- 物理的な損傷（傷、汚れ）は連続したエリアに発生しがち
- ブロック単位で分散配置することで、1つのブロックに集中することを防ぐ
- 例: `[ブロック1-1][ブロック2-1][ブロック1-2][ブロック2-2]...`

## 🗺️ Step 7: データマッピング（ジグザグ配置）

### Step 7.1: データマッピングの初期化 (272-277行目)
```javascript
mapData: function (data, maskPattern) {
  var inc = -1;                    // 移動方向
  var row = this.moduleCount - 1;  // 右下から開始
  var bitIndex = 7;               // ビットインデックス
  var byteIndex = 0;              // バイトインデックス
```
**何をしているか**:
1. 右下角からデータ配置を開始
2. 上向きに移動する設定
3. ビット単位での処理準備

**なぜ右下から開始？**:
- QRコード仕様で定められた標準的な配置方法
- 機能パターン（左上、右上、左下）を避けるため
- ジグザグパターンで効率的にデータを配置

### Step 7.2: ジグザグパターンでのデータ配置 (277-305行目)
```javascript
for (var col = this.moduleCount - 1; col > 0; col -= 2) {
  if (col == 6) col--;  // タイミングパターン列をスキップ
  
  while (true) {
    for (var c = 0; c < 2; c++) {
      if (this.modules[row][col - c] == null) {
        var dark = false;
        if (byteIndex < data.length) {
          dark = ((data[byteIndex] >>> bitIndex) & 1) == 1;
        }
        // マスクパターン適用
        var mask = QRUtil.getMask(maskPattern, row, col - c);
        if (mask) dark = !dark;
        
        this.modules[row][col - c] = dark;
        bitIndex--;
        if (bitIndex == -1) {
          byteIndex++;
          bitIndex = 7;
        }
      }
    }
    // ジグザグ移動
    row += inc;
    if (row < 0 || this.moduleCount <= row) {
      row -= inc;
      inc = -inc;
      break;
    }
  }
}
```
**何をしているか**:
1. 右から左へ2列ずつ処理
2. タイミングパターン（6列目）をスキップ
3. 各列で上下にジグザグ移動
4. 既に使用されているセルはスキップ
5. データビットを取得してマスクを適用
6. 境界に達したら方向転換

**ジグザグパターンの動き**:
```
  ↑ ↓   ↑ ↓   ↑ ↓
  15 14  11 10   7 6
  13 16   9 12   5 8
  ↓ ↑   ↓ ↑   ↓ ↑
```

**QRコード仕様上のデータ配置ルール**:
- 右から左へ2列ずつ処理
- 各2列内では右→左の順序
- 縦方向は上下交互（ジグザグ）
- タイミングパターン（6列目）はスキップ
- 機能パターンの場所は自動的にスキップ

## 🎨 Step 8: 描画処理

### Step 8.1: 描画エンジンの選択 (1095-1099行目)
```javascript
var useSVG = document.documentElement.tagName.toLowerCase() === "svg";

// Drawing selection: SVG or Canvas
var Drawing = useSVG
  ? svgDrawer
  : canvasDrawer;
```
**何をしているか**:
1. 現在のドキュメントがSVGかチェック
2. 適切な描画エンジンを選択

### Step 8.2: SVG描画の実装 (1028-1088行目)
```javascript
Drawing.prototype.draw = function (oQRCode) {
  var nCount = oQRCode.getModuleCount();
  
  // SVG要素作成ヘルパー
  function makeSVG(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs)
      if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  
  // ベースSVG作成
  var svg = makeSVG("svg", {
    viewBox: "0 0 " + String(nCount) + " " + String(nCount),
    width: "100%",
    height: "100%",
    fill: this._htOption.colorLight,
  });
```
**何をしているか**:
1. QRコードのモジュール数を取得
2. SVG要素作成のヘルパー関数を定義
3. ベースSVG要素を作成

**SVG描画の利点**:
- ベクター形式なので拡大縮小で劣化しない
- CSS/JavaScriptで色やスタイルを動的変更可能
- 印刷時の品質が高い
- ファイルサイズが小さい（特に大きなQRコード）

### Step 8.3: SVGテンプレートとモジュール描画 (1059-1087行目)
```javascript
// テンプレート要素作成
svg.appendChild(
  makeSVG("rect", {
    fill: this._htOption.colorDark,
    width: "1",
    height: "1",
    id: "template",
  })
);

for (var row = 0; row < nCount; row++) {
  for (var col = 0; col < nCount; col++) {
    if (oQRCode.isDark(row, col)) {
      var child = makeSVG("use", { x: String(col), y: String(row) });
      child.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "href",
        "#template"
      );
      svg.appendChild(child);
    }
  }
}
```
**何をしているか**:
1. 黒セル用のテンプレート要素を作成
2. 全モジュールをスキャン
3. 黒セルの場合のみ`<use>`要素でテンプレートを参照
4. メモリ効率的な描画

**テンプレート＋参照方式の利点**:
- SVGファイルサイズの大幅削減
- 1つのテンプレート定義を複数箇所で再利用
- ブラウザのレンダリング最適化
- 白セルは背景色なので要素作成不要

## 🚀 Step 9: 公開API - QRCodeクラス

### Step 9.1: コンストラクタの処理フロー (1307-1351行目)

#### Step 9.1.1: デフォルト設定の初期化
```javascript
this._htOption = {
  width: 256,                           // 描画幅
  height: 256,                          // 描画高さ
  typeNumber: 4,                        // QRバージョン
  colorDark: "#000000",                // 黒色
  colorLight: "#ffffff",               // 白色
  correctLevel: QRErrorCorrectLevel.H, // 最高エラー訂正
};
```

#### Step 9.1.2: オプション処理
```javascript
// 文字列が渡された場合はテキストオプションとして処理
if (typeof vOption === "string") {
  vOption = {
    text: vOption,
  };
}

// オプションを上書き
if (vOption) {
  for (var i in vOption) {
    this._htOption[i] = vOption[i];
  }
}
```
**何をしているか**:
1. 文字列が渡された場合は`text`オプションとして解釈
2. オブジェクトの場合は各プロパティをデフォルト設定に上書き

#### Step 9.1.3: DOM要素の取得
```javascript
// 文字列IDが渡された場合はDOM要素を取得
if (typeof el == "string") {
  el = document.getElementById(el);
}
```

#### Step 9.1.4: 描画器の初期化と初期QRコード生成
```javascript
// インスタンス変数を初期化
this._el = el;
this._oQRCode = null;
this._oDrawing = new Drawing(this._el, this._htOption);

// 初期テキストが指定されている場合はQRコードを生成
if (this._htOption.text) {
  this.makeCode(this._htOption.text);
}
```

### Step 9.2: makeCode メソッドの詳細フロー (1358-1373行目)
```javascript
QRCode.prototype.makeCode = function (sText) {
  // テキストの長さに応じて最適なQRコードバージョンを計算
  this._oQRCode = new QRCodeModel(
    _getTypeNumber(sText, this._htOption.correctLevel),
    this._htOption.correctLevel
  );
  // データを追加してQRコードを生成
  this._oQRCode.addData(sText);
  this._oQRCode.make();
  // DOM要素のtitle属性にテキストを設定
  this._el.title = sText;
  // QRコードを描画
  this._oDrawing.draw(this._oQRCode);
  // Canvasの場合は画像化
  this.makeImage();
};
```
**実行順序**:
1. 最適なQRバージョンを自動計算
2. QRCodeModelインスタンスを作成
3. データを追加
4. QRコード生成実行
5. DOM要素にtitle属性設定
6. 描画実行
7. Canvas→画像変換（該当する場合）

## 🔄 完全な処理フローサマリー

### 実際にQRコードが生成される際の完全なステップ：

1. **初期化**: `new QRCode(element, options)`
2. **文字エンコーディング**: 入力文字列 → UTF-8バイト配列
3. **バージョン決定**: データサイズに応じた最適QRサイズ選択
4. **モジュール配列初期化**: 2次元配列作成・初期化
5. **機能パターン配置**: 位置検出・タイミング・位置合わせパターン
6. **データエンコーディング**: モード情報・データ長・実データをビットストリーム化
7. **パディング**: 容量を満たすまでパディングデータ追加
8. **エラー訂正**: Reed-Solomon符号生成
9. **マスクパターン最適化**: 8種類試行して最適選択
10. **データマッピング**: ジグザグパターンでデータ配置・マスク適用
11. **描画**: SVGまたはCanvasで視覚化

この一連の処理により、入力されたテキストが読み取り可能なQRコードとして出力されます。

## 🔍 QRコード読み取り時の逆工程

### QRコードリーダーが行う処理（参考）
実際にQRコードを読み取る際は、生成の逆工程を辿ります：

1. **位置検出**: カメラ画像から3つの位置検出パターンを発見
2. **歪み補正**: カメラ角度による台形歪みを正方形に補正
3. **タイミング読み取り**: タイミングパターンでモジュール境界を特定
4. **形式情報読み取り**: エラー訂正レベルとマスクパターンを取得
5. **データ抽出**: ジグザグパターンに従ってデータビットを抽出
6. **マスク解除**: 適用されたマスクパターンを逆変換
7. **エラー訂正**: Reed-Solomon符号でエラー検出・訂正
8. **データデコード**: UTF-8バイト列を元の文字列に復元

### QRコードの堅牢性の秘密
このライブラリが実装している各機能が、QRコードの高い信頼性を支えています：

- **冗長性**: エラー訂正符号による情報の冗長性
- **構造化**: 位置検出・タイミングパターンによる構造的堅牢性  
- **最適化**: マスクパターンによる読み取り最適化
- **標準化**: ISO/IEC 18004準拠による互換性

### 実用的な応用例
- **URL**: ウェブサイトへの簡単アクセス
- **WiFi情報**: パスワード入力なしでWiFi接続
- **連絡先**: vCard形式で連絡先情報共有
- **決済**: QRコード決済システム
- **認証**: ワンタイムパスワード、チケット認証

### 2. UTF-8文字エンコーディング処理

#### QR8bitByteクラス (7-69行目)
文字列データをUTF-8バイト配列に変換するクラス

**コンストラクタ処理 (7-54行目)**
```javascript
function QR8bitByte(data) {
  this.mode = QRMode.MODE_8BIT_BYTE;  // 8ビットバイトモードに設定
  this.data = data;                   // 元データ保存
  this.parsedData = [];              // UTF-8バイト配列
```

**Unicode文字分類とUTF-8エンコーディング (16-43行目)**
```javascript
for (var i = 0, l = this.data.length; i < l; i++) {
  var code = this.data.charCodeAt(i);  // Unicodeコードポイント取得
```

1. **4バイト文字処理 (22-26行目)**: U+10000以上の文字
   - 第1バイト: `0xF0 | ((code & 0x1C0000) >>> 18)`
   - 第2バイト: `0x80 | ((code & 0x3F000) >>> 12)`
   - 第3バイト: `0x80 | ((code & 0xFC0) >>> 6)`
   - 第4バイト: `0x80 | (code & 0x3F)`

2. **3バイト文字処理 (28-31行目)**: U+0800-U+FFFF
   - 第1バイト: `0xE0 | ((code & 0xF000) >>> 12)`
   - 第2バイト: `0x80 | ((code & 0xFC0) >>> 6)`
   - 第3バイト: `0x80 | (code & 0x3F)`

3. **2バイト文字処理 (33-35行目)**: U+0080-U+07FF
   - 第1バイト: `0xC0 | ((code & 0x7C0) >>> 6)`
   - 第2バイト: `0x80 | (code & 0x3F)`

4. **1バイト文字処理 (37-38行目)**: U+0000-U+007F (ASCII)
   - そのままバイト値として格納

**配列平坦化とBOM処理 (45-53行目)**
```javascript
this.parsedData = Array.prototype.concat.apply([], this.parsedData);
if (this.parsedData.length != this.data.length) {
  this.parsedData.unshift(191, 187, 239);  // UTF-8 BOM (EF BB BF)
}
```

**プロトタイプメソッド (57-69行目)**
- `getLength()`: パース済みデータ長を返却
- `write(buffer)`: バッファに8ビット単位でデータ書き込み

### 3. QRCodeModelクラス - コア処理エンジン

#### 初期化と基本構造 (72-85行目)
```javascript
function QRCodeModel(typeNumber, errorCorrectLevel) {
  this.typeNumber = typeNumber;           // QRバージョン(1-40)
  this.errorCorrectLevel = errorCorrectLevel;  // エラー訂正レベル
  this.modules = null;                    // 2次元モジュール配列
  this.moduleCount = 0;                   // 一辺のセル数
  this.dataCache = null;                  // エンコード済みデータキャッシュ
  this.dataList = [];                     // データリスト
}
```

#### QRコード生成メインフロー (114-152行目)
```javascript
make: function () {
  this.makeImpl(false, this.getBestMaskPattern());
}
```

**makeImpl実装詳細 (118-152行目)**
1. **モジュール配列初期化 (119-128行目)**
   ```javascript
   this.moduleCount = this.typeNumber * 4 + 17;  // サイズ計算
   this.modules = new Array(this.moduleCount);   // 2次元配列作成
   ```

2. **機能パターン配置**
   - 位置検出パターン配置 (130-132行目): 3つの角に7×7の正方形パターン
   - 位置合わせパターン配置 (134行目): 読み取り精度向上用
   - タイミングパターン配置 (136行目): 白黒交互パターン
   - 形式情報配置 (138行目): エラー訂正レベルとマスクパターン情報

3. **データエンコーディングとマッピング (144-152行目)**
   ```javascript
   if (this.dataCache == null) {
     this.dataCache = QRCodeModel.createData(...);
   }
   this.mapData(this.dataCache, maskPattern);
   ```

#### 位置検出パターン生成 (155-172行目)
QRコードの3つの角に配置される7×7の正方形パターン
```javascript
setupPositionProbePattern: function (row, col) {
  for (var r = -1; r <= 7; r++) {
    for (var c = -1; c <= 7; c++) {
      // パターン形状判定
      if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
          (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
        this.modules[row + r][col + c] = true;  // 黒セル
      } else {
        this.modules[row + r][col + c] = false; // 白セル
      }
    }
  }
}
```

#### 最適マスクパターン選択 (174-187行目)
8種類のマスクパターンを試行し、ペナルティポイント最小のものを選択
```javascript
getBestMaskPattern: function () {
  var minLostPoint = 0;
  var pattern = 0;
  for (var i = 0; i < 8; i++) {
    this.makeImpl(true, i);              // テストモードで生成
    var lostPoint = QRUtil.getLostPoint(this);  // ペナルティ計算
    if (i == 0 || minLostPoint > lostPoint) {
      minLostPoint = lostPoint;
      pattern = i;
    }
  }
  return pattern;
}
```

#### タイミングパターン生成 (189-206行目)
6行目と6列目に白黒交互パターンを配置
```javascript
setupTimingPattern: function () {
  // 縦方向タイミングパターン (6列目)
  for (var r = 8; r < this.moduleCount - 8; r++) {
    if (this.modules[r][6] != null) continue;
    this.modules[r][6] = r % 2 == 0;  // 偶数行=黒、奇数行=白
  }
  // 横方向タイミングパターン (6行目)
  for (var c = 8; c < this.moduleCount - 8; c++) {
    if (this.modules[6][c] != null) continue;
    this.modules[6][c] = c % 2 == 0;  // 偶数列=黒、奇数列=白
  }
}
```

#### データマッピング (272-306行目)
エンコード済みデータをQRコードモジュールにジグザグパターンで配置
```javascript
mapData: function (data, maskPattern) {
  var inc = -1;                    // 移動方向
  var row = this.moduleCount - 1;  // 右下から開始
  var bitIndex = 7;               // ビットインデックス
  var byteIndex = 0;              // バイトインデックス
  
  for (var col = this.moduleCount - 1; col > 0; col -= 2) {
    if (col == 6) col--;  // タイミングパターン列をスキップ
    
    while (true) {
      for (var c = 0; c < 2; c++) {
        if (this.modules[row][col - c] == null) {
          var dark = false;
          if (byteIndex < data.length) {
            dark = ((data[byteIndex] >>> bitIndex) & 1) == 1;
          }
          // マスクパターン適用
          var mask = QRUtil.getMask(maskPattern, row, col - c);
          if (mask) dark = !dark;
          
          this.modules[row][col - c] = dark;
          bitIndex--;
          if (bitIndex == -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      // ジグザグ移動
      row += inc;
      if (row < 0 || this.moduleCount <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
}
```

### 4. データエンコーディング処理

#### createData静的メソッド (310-352行目)
データリストからQRコード用バイト配列を生成

**RSブロック取得とバッファ準備 (310-321行目)**
```javascript
var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
var buffer = new QRBitBuffer();

for (var i = 0; i < dataList.length; i++) {
  var data = dataList[i];
  buffer.put(data.mode, 4);                    // モード情報 (4ビット)
  buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
  data.write(buffer);                          // 実データ
}
```

**パディング処理 (335-350行目)**
```javascript
if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
  buffer.put(0, 4);  // ターミネータ追加
}
while (buffer.getLengthInBits() % 8 != 0) {
  buffer.putBit(false);  // ビット境界調整
}
// 交互パディングパターンで容量まで埋める
while (true) {
  if (buffer.getLengthInBits() >= totalDataCount * 8) break;
  buffer.put(QRCodeModel.PAD0, 8);  // 0xEC
  if (buffer.getLengthInBits() >= totalDataCount * 8) break;
  buffer.put(QRCodeModel.PAD1, 8);  // 0x11
}
```

#### エラー訂正符号生成 (353-399行目)
Reed-Solomon符号によるエラー訂正符号を生成
```javascript
createBytes: function (buffer, rsBlocks) {
  // データコードワード分離
  for (var r = 0; r < rsBlocks.length; r++) {
    var dcCount = rsBlocks[r].dataCount;
    dcdata[r] = new Array(dcCount);
    for (var i = 0; i < dcdata[r].length; i++) {
      dcdata[r][i] = 0xff & buffer.buffer[i + offset];
    }
    
    // エラー訂正符号計算
    var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
    var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
    var modPoly = rawPoly.mod(rsPoly);
    
    // エラー訂正符号データ格納
    ecdata[r] = new Array(rsPoly.getLength() - 1);
    for (var i = 0; i < ecdata[r].length; i++) {
      var modIndex = i + modPoly.getLength() - ecdata[r].length;
      ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
  }
  
  // インターリーブ配置
  var data = new Array(totalCodeCount);
  var index = 0;
  
  // データコードワードのインターリーブ
  for (var i = 0; i < maxDcCount; i++) {
    for (var r = 0; r < rsBlocks.length; r++) {
      if (i < dcdata[r].length) {
        data[index++] = dcdata[r][i];
      }
    }
  }
  
  // エラー訂正コードワードのインターリーブ
  for (var i = 0; i < maxEcCount; i++) {
    for (var r = 0; r < rsBlocks.length; r++) {
      if (i < ecdata[r].length) {
        data[index++] = ecdata[r][i];
      }
    }
  }
  
  return data;
}
```

### 5. 定数定義とユーティリティ

#### QRモード定数 (401-406行目)
```javascript
var QRMode = {
  MODE_NUMBER: 1 << 0,     // 数字モード (1)
  MODE_ALPHA_NUM: 1 << 1,  // 英数字モード (2)
  MODE_8BIT_BYTE: 1 << 2,  // 8ビットバイトモード (4)
  MODE_KANJI: 1 << 3,      // 漢字モード (8)
};
```

#### エラー訂正レベル (408行目)
```javascript
var QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
// L: 約7%復旧可能, M: 約15%, Q: 約25%, H: 約30%
```

#### マスクパターン (410-419行目)
8種類のマスクパターン定数と対応する数式

### 6. QRUtilオブジェクト - 汎用ユーティリティ

#### 位置合わせパターン配置テーブル (423-464行目)
各QRバージョン(1-40)における位置合わせパターンの座標を定義

#### BCH符号化処理 (483-500行目)
形式情報とバージョン情報のエラー検出符号生成
```javascript
getBCHTypeInfo: function (data) {
  var d = data << 10;  // 10ビット左シフト
  while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
    d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15));
  }
  return ((data << 10) | d) ^ QRUtil.G15_MASK;
}
```

#### マスクパターン計算 (512-533行目)
8種類のマスクパターンに対する判定関数
```javascript
getMask: function (maskPattern, i, j) {
  switch (maskPattern) {
    case QRMaskPattern.PATTERN000: return (i + j) % 2 == 0;
    case QRMaskPattern.PATTERN001: return i % 2 == 0;
    case QRMaskPattern.PATTERN010: return j % 3 == 0;
    case QRMaskPattern.PATTERN011: return (i + j) % 3 == 0;
    case QRMaskPattern.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
    case QRMaskPattern.PATTERN101: return ((i * j) % 2) + ((i * j) % 3) == 0;
    case QRMaskPattern.PATTERN110: return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0;
    case QRMaskPattern.PATTERN111: return (((i * j) % 3) + ((i + j) % 2)) % 2 == 0;
  }
}
```

#### ペナルティポイント計算 (585-667行目)
マスクパターン品質評価のための4つのルール
1. **同色連続パターン検出 (588-612行目)**: 隣接セルの同色数カウント
2. **2×2ブロック検出 (613-624行目)**: 同色4セルブロックペナルティ
3. **ファインダーパターン類似検出 (625-654行目)**: 1:1:3:1:1パターン検出
4. **暗色比率評価 (655-666行目)**: 全体の黒セル比率が50%から離れるほど加算

### 7. 数学ライブラリ (QRMath)

#### ガロア体演算 (669-700行目)
Reed-Solomon符号計算に必要なGF(256)体演算
```javascript
var QRMath = {
  glog: function (n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return QRMath.LOG_TABLE[n];
  },
  gexp: function (n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRMath.EXP_TABLE[n];
  },
  EXP_TABLE: new Array(256),  // 指数テーブル
  LOG_TABLE: new Array(256),  // 対数テーブル
};

// 指数テーブル初期化
for (var i = 0; i < 8; i++) {
  QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
  QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^
                        QRMath.EXP_TABLE[i - 5] ^
                        QRMath.EXP_TABLE[i - 6] ^
                        QRMath.EXP_TABLE[i - 8];
}
```

### 8. 多項式演算 (QRPolynomial)

#### Reed-Solomon多項式計算 (701-746行目)
```javascript
function QRPolynomial(num, shift) {
  // 先頭の0を除去
  var offset = 0;
  while (offset < num.length && num[offset] == 0) {
    offset++;
  }
  this.num = new Array(num.length - offset + shift);
  for (var i = 0; i < num.length - offset; i++) {
    this.num[i] = num[i + offset];
  }
}

QRPolynomial.prototype = {
  multiply: function (e) {
    var num = new Array(this.getLength() + e.getLength() - 1);
    for (var i = 0; i < this.getLength(); i++) {
      for (var j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  },
  
  mod: function (e) {
    if (this.getLength() - e.getLength() < 0) return this;
    var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    var num = new Array(this.getLength());
    for (var i = 0; i < this.getLength(); i++) {
      num[i] = this.get(i);
    }
    for (var i = 0; i < e.getLength(); i++) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  }
};
```

### 9. RSブロック管理 (747-948行目)

#### RSブロックテーブル (751-912行目)
QRバージョンとエラー訂正レベルごとのRSブロック構成データ

#### RSブロック生成 (913-948行目)
```javascript
QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {
  var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
  var length = rsBlock.length / 3;
  var list = [];
  
  for (var i = 0; i < length; i++) {
    var count = rsBlock[i * 3 + 0];       // ブロック数
    var totalCount = rsBlock[i * 3 + 1];  // 総コードワード数
    var dataCount = rsBlock[i * 3 + 2];   // データコードワード数
    
    for (var j = 0; j < count; j++) {
      list.push(new QRRSBlock(totalCount, dataCount));
    }
  }
  return list;
}
```

### 10. ビットバッファ (949-976行目)

#### ビット単位データ管理
```javascript
function QRBitBuffer() {
  this.buffer = [];  // バイト配列
  this.length = 0;   // 総ビット長
}

QRBitBuffer.prototype = {
  put: function (num, length) {
    for (var i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) == 1);
    }
  },
  
  putBit: function (bit) {
    var bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    }
    this.length++;
  }
};
```

### 11. 描画エンジン

#### SVG描画器 (1021-1093行目)
```javascript
var svgDrawer = (function () {
  var Drawing = function (el, htOption) {
    this._el = el;          // 描画対象DOM要素
    this._htOption = htOption;  // 描画オプション
  };
  
  Drawing.prototype.draw = function (oQRCode) {
    var nCount = oQRCode.getModuleCount();
    
    // SVG要素作成ヘルパー
    function makeSVG(tag, attrs) {
      var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (var k in attrs)
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      return el;
    }
    
    // ベースSVG作成
    var svg = makeSVG("svg", {
      viewBox: "0 0 " + String(nCount) + " " + String(nCount),
      width: "100%",
      height: "100%",
      fill: this._htOption.colorLight,
    });
    
    // テンプレート要素作成
    svg.appendChild(makeSVG("rect", {
      fill: this._htOption.colorDark,
      width: "1",
      height: "1",
      id: "template",
    }));
    
    // モジュール描画
    for (var row = 0; row < nCount; row++) {
      for (var col = 0; col < nCount; col++) {
        if (oQRCode.isDark(row, col)) {
          var child = makeSVG("use", { x: String(col), y: String(row) });
          child.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#template");
          svg.appendChild(child);
        }
      }
    }
    
    this._el.appendChild(svg);
  };
})();
```

#### Canvas描画器 (1100-1228行目)
```javascript
var Drawing = function (el, htOption) {
  this._elCanvas = document.createElement("canvas");
  this._elCanvas.width = htOption.width;
  this._elCanvas.height = htOption.height;
  this._oContext = this._elCanvas.getContext("2d");
  this._elImage = document.createElement("img");
  // 初期化処理...
};

Drawing.prototype.draw = function (oQRCode) {
  var nCount = oQRCode.getModuleCount();
  var nWidth = this._htOption.width / nCount;
  var nHeight = this._htOption.height / nCount;
  
  // ピクセル単位でQRコード描画
  for (var row = 0; row < nCount; row++) {
    for (var col = 0; col < nCount; col++) {
      var bIsDark = oQRCode.isDark(row, col);
      var nLeft = col * nWidth;
      var nTop = row * nHeight;
      
      this._oContext.fillStyle = bIsDark ? 
        this._htOption.colorDark : this._htOption.colorLight;
      this._oContext.fillRect(nLeft, nTop, nWidth, nHeight);
    }
  }
};
```

### 12. ユーティリティ関数

#### 自動バージョン選択 (1238-1272行目)
```javascript
function _getTypeNumber(sText, nCorrectLevel) {
  var nType = 1;
  var length = _getUTF8Length(sText);  // UTF-8バイト長計算
  
  // 容量テーブルから最適バージョン検索
  for (var i = 0, len = QRCodeLimitLength.length; i <= len; i++) {
    var nLimit = 0;
    switch (nCorrectLevel) {
      case QRErrorCorrectLevel.L: nLimit = QRCodeLimitLength[i][0]; break;
      case QRErrorCorrectLevel.M: nLimit = QRCodeLimitLength[i][1]; break;
      case QRErrorCorrectLevel.Q: nLimit = QRCodeLimitLength[i][2]; break;
      case QRErrorCorrectLevel.H: nLimit = QRCodeLimitLength[i][3]; break;
    }
    
    if (length <= nLimit) break;
    else nType++;
  }
  
  if (nType > QRCodeLimitLength.length) {
    throw new Error("Too long data");
  }
  return nType;
}
```

#### UTF-8文字長計算 (1274-1279行目)
```javascript
function _getUTF8Length(sText) {
  var replacedText = encodeURI(sText)
    .toString()
    .replace(/\%[0-9a-fA-F]{2}/g, "a");  // URI エンコード文字を1文字として計算
  return replacedText.length + (replacedText.length != sText ? 3 : 0);
}
```

### 13. QRCodeクラス - 公開API

#### コンストラクタ (1307-1351行目)
```javascript
QRCode = function (el, vOption) {
  // デフォルト設定
  this._htOption = {
    width: 256,                           // 描画幅
    height: 256,                          // 描画高さ
    typeNumber: 4,                        // QRバージョン
    colorDark: "#000000",                // 黒色
    colorLight: "#ffffff",               // 白色
    correctLevel: QRErrorCorrectLevel.H, // 最高エラー訂正
  };
  
  // オプション文字列処理
  if (typeof vOption === "string") {
    vOption = { text: vOption };
  }
  
  // オプション上書き
  if (vOption) {
    for (var i in vOption) {
      this._htOption[i] = vOption[i];
    }
  }
  
  // DOM要素取得
  if (typeof el == "string") {
    el = document.getElementById(el);
  }
  
  // 描画器選択
  if (this._htOption.useSVG) {
    Drawing = svgDrawer;
  }
  
  // インスタンス初期化
  this._el = el;
  this._oQRCode = null;
  this._oDrawing = new Drawing(this._el, this._htOption);
  
  // 初期QRコード生成
  if (this._htOption.text) {
    this.makeCode(this._htOption.text);
  }
};
```

#### 公開メソッド (1358-1398行目)
```javascript
// QRコード生成
QRCode.prototype.makeCode = function (sText) {
  this._oQRCode = new QRCodeModel(
    _getTypeNumber(sText, this._htOption.correctLevel),
    this._htOption.correctLevel
  );
  this._oQRCode.addData(sText);
  this._oQRCode.make();
  this._el.title = sText;
  this._oDrawing.draw(this._oQRCode);
  this.makeImage();
};

// Canvas→画像変換
QRCode.prototype.makeImage = function () {
  if (typeof this._oDrawing.makeImage == "function") {
    this._oDrawing.makeImage();
  }
};

// QRコードクリア
QRCode.prototype.clear = function () {
  this._oDrawing.clear();
};

// エラー訂正レベル定数公開
QRCode.CorrectLevel = QRErrorCorrectLevel;
```

## 特徴と技術的考慮事項

### パフォーマンス最適化
- **ビット演算活用**: マスクパターン計算、ガロア体演算での高速化
- **メモリ効率**: 2次元配列での直接モジュール管理
- **キャッシュ戦略**: データエンコード結果のキャッシュ

### 国際化対応
- **完全UTF-8サポート**: 4バイトUnicode文字対応
- **自動BOM挿入**: マルチバイト文字検出時の自動処理

### QR仕様準拠
- **ISO/IEC 18004準拠**: 標準仕様完全実装
- **全エラー訂正レベル対応**: L/M/Q/H レベル
- **自動バージョン選択**: データ長に応じた最適サイズ選択

### ブラウザ互換性
- **SVG/Canvas両対応**: ブラウザ能力に応じた自動選択
- **レガシーブラウザ配慮**: ES5互換コード

この実装は、QRコード生成に必要な全ての要素を包括的にカバーし、実用性と性能を両立した設計となっています。