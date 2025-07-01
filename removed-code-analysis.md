# 削除されたコードの分析

## 2025年のブラウザ環境では不要になった部分

### 1. Android 2.x 検出機能 (`_getAndroid()`)

**削除されたコード:**
```javascript
function _getAndroid() {
  var android = false;
  var sAgent = navigator.userAgent;

  if (/android/i.test(sAgent)) {
    android = true;
    var aMat = sAgent.toString().match(/android ([0-9]\.[0-9])/i);

    if (aMat && aMat[1]) {
      android = parseFloat(aMat[1]);
    }
  }

  return android;
}
```

**削除理由:**
- Android 2.x は2012年にサポート終了
- 現在のAndroidバージョンは14.x台で、2.x系は完全に廃止済み
- Data URI仕様は現在全てのモダンブラウザでサポート済み

### 2. Android 2.1 描画バグ対応コード

**削除されたコード:**
```javascript
// Android 2.1 bug workaround
// http://code.google.com/p/android/issues/detail?id=5141
if (this._android && this._android <= 2.1) {
  var factor = 1 / window.devicePixelRatio;
  var drawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (
    image, sx, sy, sw, sh, dx, dy, dw, dh
  ) {
    if ("nodeName" in image && /img/i.test(image.nodeName)) {
      for (var i = arguments.length - 1; i >= 1; i--) {
        arguments[i] = arguments[i] * factor;
      }
    } else if (typeof dw == "undefined") {
      arguments[1] *= factor;
      arguments[2] *= factor;
      arguments[3] *= factor;
      arguments[4] *= factor;
    }

    drawImage.apply(this, arguments);
  };
}
```

**削除理由:**
- Android 2.1特有のCanvas描画バグへの対応コード
- 該当バージョンは既に廃止済みで対応不要
- devicePixelRatioの処理も現在は標準化済み

### 3. Data URI サポート検証機能 (`_safeSetDataURI()`)

**削除されたコード:**
```javascript
function _safeSetDataURI(fSuccess, fFail) {
  var self = this;
  self._fFail = fFail;
  self._fSuccess = fSuccess;

  // Check it just once
  if (self._bSupportDataURI === null) {
    var el = document.createElement("img");
    var fOnError = function () {
      self._bSupportDataURI = false;
      if (self._fFail) {
        self._fFail.call(self);
      }
    };
    var fOnSuccess = function () {
      self._bSupportDataURI = true;
      if (self._fSuccess) {
        self._fSuccess.call(self);
      }
    };

    el.onabort = fOnError;
    el.onerror = fOnError;
    el.onload = fOnSuccess;
    el.src = "data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
    return;
  } else if (self._bSupportDataURI === true && self._fSuccess) {
    self._fSuccess.call(self);
  } else if (self._bSupportDataURI === false && self._fFail) {
    self._fFail.call(self);
  }
}
```

**削除理由:**
- 全てのモダンブラウザでData URIは標準サポート
- IE6-8など古いブラウザは既に廃止済み
- Canvas の `toDataURL()` も全ブラウザで対応済み
- テスト用1×1ピクセル画像も不要

### 4. Flash MovieClip対応機能 (`createMovieClip()`)

**削除されたコード:**
```javascript
createMovieClip: function (target_mc, instance_name, depth) {
  var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
  var cs = 1;
  this.make();
  for (var row = 0; row < this.modules.length; row++) {
    var y = row * cs;
    for (var col = 0; col < this.modules[row].length; col++) {
      var x = col * cs;
      var dark = this.modules[row][col];
      if (dark) {
        qr_mc.beginFill(0, 100);
        qr_mc.moveTo(x, y);
        qr_mc.lineTo(x + cs, y);
        qr_mc.lineTo(x + cs, y + cs);
        qr_mc.lineTo(x, y + cs);
        qr_mc.endFill();
      }
    }
  }
  return qr_mc;
}
```

**削除理由:**
- Adobe Flash Player は2020年12月31日にサポート終了
- 全てのモダンブラウザでFlashサポートを廃止
- HTML5 Canvas、SVGが標準の描画方法

### 5. Android依存の条件分岐

**変更されたコード:**
```javascript
// 変更前
QRCode.prototype.makeImage = function () {
  if (
    typeof this._oDrawing.makeImage == "function" &&
    (!this._android || this._android >= 3)
  ) {
    this._oDrawing.makeImage();
  }
};

// 変更後
QRCode.prototype.makeImage = function () {
  if (typeof this._oDrawing.makeImage == "function") {
    this._oDrawing.makeImage();
  }
};
```

**削除理由:**
- Android 3未満の条件チェックが不要
- Data URI対応は現在全てのブラウザで標準

### 6. 関連するプロパティ削除

**削除されたプロパティ:**
- `this._android` プロパティの初期化コード
- `this._bSupportDataURI` プロパティ

**削除理由:**
- Android バージョン検出が不要になったため
- Data URI検証機能も不要になったため
- 関連する条件分岐も全て削除済み

## 影響

これらの削除により：
- コードサイズが約100行削減
- 古いブラウザ・プラットフォーム対応のオーバーヘッドを除去
- メンテナンス性が向上
- 2025年時点のモダンブラウザ環境に最適化
- Flash依存を完全排除
- Data URI検証の不要な処理を削除