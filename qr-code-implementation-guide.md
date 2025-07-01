# QRコード生成処理の詳細解説

## 概要
このドキュメントは、`index.js`で実装されているQRコード生成処理の重要な技術的詳細について解説します。

## 1. 文字エンコーディング処理（UTF-8対応）

### QR8bitByteクラス（7-69行）
QRコードでは、日本語やUnicodeテキストを適切に処理するためのUTF-8エンコーディングが重要です。

```javascript
// UTF-8文字をサポートするための処理
for (var i = 0, l = this.data.length; i < l; i++) {
  var code = this.data.charCodeAt(i);
  
  // 4バイト文字（0x10000以上）の場合
  if (code > 0x10000) {
    byteArray[0] = 0xf0 | ((code & 0x1c0000) >>> 18);
    byteArray[1] = 0x80 | ((code & 0x3f000) >>> 12);
    byteArray[2] = 0x80 | ((code & 0xfc0) >>> 6);
    byteArray[3] = 0x80 | (code & 0x3f);
  }
  // その他のバイト数に応じた処理...
}
```

**重要ポイント：**
- 各文字のUnicodeコードポイントを取得
- 文字のバイト数に応じて適切なUTF-8エンコーディングを実行
- BOM（Byte Order Mark）を必要に応じて追加（49-53行）

## 2. QRコードの構造生成

### QRCodeModelクラス（72-399行）
QRコードの二次元パターンを生成する核となるクラスです。

#### 重要な構造パターン：

**位置検出パターン（154-172行）**
```javascript
setupPositionProbePattern: function (row, col) {
  for (var r = -1; r <= 7; r++) {
    for (var c = -1; c <= 7; c++) {
      // 位置検出パターンの形状を定義
      if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
          (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
        this.modules[row + r][col + c] = true;
      }
    }
  }
}
```

**タイミングパターン（188-206行）**
```javascript
setupTimingPattern: function () {
  // 縦のタイミングパターン（6列目）
  for (var r = 8; r < this.moduleCount - 8; r++) {
    this.modules[r][6] = r % 2 == 0; // 偶数行は黒
  }
  // 横のタイミングパターン（6行目）
  for (var c = 8; c < this.moduleCount - 8; c++) {
    this.modules[6][c] = c % 2 == 0; // 偶数列は黒
  }
}
```

## 3. マスクパターンの最適化

### マスクパターン選択（173-187行）
QRコードの読み取り精度を向上させるため、8種類のマスクパターンから最適なものを選択します。

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

**マスクパターンの種類（409-419行）：**
- PATTERN000: `(i + j) % 2 == 0`
- PATTERN001: `i % 2 == 0`
- PATTERN010: `j % 3 == 0`
- PATTERN011: `(i + j) % 3 == 0`
- など8種類

## 4. エラー訂正処理

### Reed-Solomon符号化（310-399行）
QRコードの誤り訂正能力を実現するための数学的処理です。

```javascript
QRCodeModel.createData = function (typeNumber, errorCorrectLevel, dataList) {
  var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
  var buffer = new QRBitBuffer();
  
  // データをバッファに格納
  for (var i = 0; i < dataList.length; i++) {
    var data = dataList[i];
    buffer.put(data.mode, 4); // モード指示子
    buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
    data.write(buffer);
  }
  
  // パディングビットの追加
  if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
    buffer.put(0, 4);
  }
  
  return QRCodeModel.createBytes(buffer, rsBlocks);
}
```

**エラー訂正レベル（407-408行）：**
- L: 約7%の誤り訂正能力
- M: 約15%の誤り訂正能力
- Q: 約25%の誤り訂正能力
- H: 約30%の誤り訂正能力

## 5. 描画処理

### SVG描画（1021-1093行）
```javascript
Drawing.prototype.draw = function (oQRCode) {
  var nCount = oQRCode.getModuleCount();
  
  // SVG要素を作成
  var svg = makeSVG("svg", {
    viewBox: "0 0 " + String(nCount) + " " + String(nCount),
    width: "100%",
    height: "100%",
    fill: _htOption.colorLight,
  });
  
  // 各モジュールを描画
  for (var row = 0; row < nCount; row++) {
    for (var col = 0; col < nCount; col++) {
      if (oQRCode.isDark(row, col)) {
        var child = makeSVG("use", { x: String(col), y: String(row) });
        svg.appendChild(child);
      }
    }
  }
}
```

### Canvas描画（1115-1228行）
Canvas APIを使用した描画では、より詳細なピクセル制御が可能です。

## 6. バージョン自動選択

### 最適バージョン計算（1238-1272行）
```javascript
function _getTypeNumber(sText, nCorrectLevel) {
  var nType = 1;
  var length = _getUTF8Length(sText);
  
  for (var i = 0, len = QRCodeLimitLength.length; i <= len; i++) {
    var nLimit = 0;
    
    switch (nCorrectLevel) {
      case QRErrorCorrectLevel.L:
        nLimit = QRCodeLimitLength[i][0];
        break;
      // 他のレベルも同様
    }
    
    if (length <= nLimit) {
      break;
    } else {
      nType++;
    }
  }
  
  return nType;
}
```

**バージョン容量テーブル（977-1018行）：**
各バージョン（サイズ）と各エラー訂正レベルでの最大データ容量が定義されています。

## 7. メインAPIクラス

### QRCodeクラス（1307-1399行）
```javascript
QRCode = function (el, vOption) {
  // デフォルトオプション設定
  this._htOption = {
    width: 256,
    height: 256,
    typeNumber: 4,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRErrorCorrectLevel.H,
  };
  
  // QRコード生成
  if (this._htOption.text) {
    this.makeCode(this._htOption.text);
  }
};
```

**主要メソッド：**
- `makeCode(sText)`: QRコードを生成
- `clear()`: QRコードをクリア
- `makeImage()`: Canvas画像化

## まとめ

この実装は以下の重要な技術を組み合わせています：

1. **UTF-8エンコーディング**: 国際化対応
2. **Reed-Solomon誤り訂正**: データ復元能力
3. **マスクパターン最適化**: 読み取り性能向上
4. **自動バージョン選択**: データ量に応じた最適化
5. **SVG/Canvas描画**: 柔軟な出力形式

これらの技術により、高品質で読み取りやすいQRコードが生成されます。