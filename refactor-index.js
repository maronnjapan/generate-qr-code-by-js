/**
 * Modern QR Code Generator - ES6+ Implementation
 * Web標準対応、Smarty実行可能、劇的リファクタリング版
 */

(() => {
  'use strict';

  // QRコード設定定数
  const QR_CONFIG = {
    MODES: { NUMBER: 1, ALPHA_NUM: 2, BYTE: 4, KANJI: 8 },
    ERROR_LEVELS: { L: 1, M: 0, Q: 3, H: 2 },
    MASK_PATTERNS: Array.from({ length: 8 }, (_, i) => i),
    
    // QRコードサイズ限界テーブル（簡略化）
    SIZE_LIMITS: [
      [17, 14, 11, 7], [32, 26, 20, 14], [53, 42, 32, 24], [78, 62, 46, 34],
      [106, 84, 60, 44], [134, 106, 74, 58], [154, 122, 86, 64], [192, 152, 108, 84],
      [230, 180, 130, 98], [271, 213, 151, 119], [321, 251, 177, 137], [367, 287, 203, 155],
      [425, 331, 241, 177], [458, 362, 258, 194], [520, 412, 292, 220], [586, 450, 322, 250]
    ],

    // RS Block テーブル（大幅簡略化）
    RS_BLOCKS: {
      1: [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
      2: [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
      3: [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
      4: [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]]
    }
  };

  // ユーティリティ関数群
  const Utils = {
    // UTF-8バイト長計算（web標準対応）
    getUTF8Length: (text) => {
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(text).length;
      }
      // フォールバック実装
      return [...text].reduce((len, char) => {
        const code = char.codePointAt(0);
        return len + (code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4);
      }, 0);
    },

    // 最適なQRコードタイプを計算
    getOptimalType: (text, errorLevel) => {
      const length = Utils.getUTF8Length(text);
      const levelIndex = [1, 0, 3, 2][errorLevel]; // L,M,Q,H → 0,1,2,3
      
      return QR_CONFIG.SIZE_LIMITS.findIndex(limits => length <= limits[levelIndex]) + 1 || 
             (() => { throw new Error('Text too long for QR code'); })();
    },

    // マスクパターン計算
    getMask: (pattern, row, col) => {
      const masks = [
        (i, j) => (i + j) % 2 === 0,
        (i, j) => i % 2 === 0,
        (i, j) => j % 3 === 0,
        (i, j) => (i + j) % 3 === 0,
        (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
        (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
        (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
        (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
      ];
      return masks[pattern](row, col);
    }
  };

  // QRコード生成クラス（ES6クラス構文）
  class QRCodeGenerator {
    constructor(type, errorLevel) {
      this.type = type;
      this.errorLevel = errorLevel;
      this.size = type * 4 + 17;
      this.modules = Array(this.size).fill().map(() => Array(this.size).fill(null));
    }

    // データ追加（簡略化）
    addData(text) {
      this.data = [...new TextEncoder().encode(text)];
      return this;
    }

    // QRコード生成
    generate() {
      this.setupPatterns();
      this.addData();
      this.applyMask(this.findBestMask());
      return this;
    }

    // パターン設定（大幅簡略化）
    setupPatterns() {
      // ファインダーパターン
      [[0, 0], [this.size - 7, 0], [0, this.size - 7]]
        .forEach(([x, y]) => this.drawFinderPattern(x, y));
      
      // タイミングパターン
      for (let i = 8; i < this.size - 8; i++) {
        this.modules[6][i] = this.modules[i][6] = i % 2 === 0;
      }
    }

    // ファインダーパターン描画
    drawFinderPattern(startX, startY) {
      for (let dy = -1; dy <= 7; dy++) {
        for (let dx = -1; dx <= 7; dx++) {
          const x = startX + dx, y = startY + dy;
          if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            const isDark = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
                          (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
                          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
            this.modules[y][x] = isDark;
          }
        }
      }
    }

    // ベストマスク検索
    findBestMask() {
      return QR_CONFIG.MASK_PATTERNS
        .map(pattern => ({ pattern, penalty: this.calculatePenalty(pattern) }))
        .reduce((best, current) => current.penalty < best.penalty ? current : best)
        .pattern;
    }

    // ペナルティ計算（簡略化）
    calculatePenalty(maskPattern) {
      const testModules = this.modules.map(row => [...row]);
      this.applyMaskToModules(testModules, maskPattern);
      
      let penalty = 0;
      // 連続する同色モジュールのペナルティ
      for (let i = 0; i < this.size; i++) {
        penalty += this.calculateLinePenalty(testModules[i]);
        penalty += this.calculateLinePenalty(testModules.map(row => row[i]));
      }
      return penalty;
    }

    // 線のペナルティ計算
    calculateLinePenalty(line) {
      let penalty = 0, count = 1;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]) {
          count++;
        } else {
          if (count >= 5) penalty += count - 2;
          count = 1;
        }
      }
      return penalty;
    }

    // マスク適用
    applyMask(pattern) {
      this.applyMaskToModules(this.modules, pattern);
    }

    applyMaskToModules(modules, pattern) {
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          if (modules[row][col] !== null && Utils.getMask(pattern, row, col)) {
            modules[row][col] = !modules[row][col];
          }
        }
      }
    }

    // モジュール状態取得
    isDark(row, col) {
      return this.modules[row] && this.modules[row][col] === true;
    }

    getSize() {
      return this.size;
    }
  }

  // レンダラークラス（関数型アプローチ）
  class QRRenderer {
    static createSVG(qr, options = {}) {
      if (typeof document === 'undefined') {
        throw new Error('SVG rendering requires DOM');
      }

      const { width = 256, height = 256, dark = '#000', light = '#fff' } = options;
      const size = qr.getSize();
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      Object.assign(svg, {
        setAttribute: (k, v) => svg.setAttributeNS(null, k, v)
      });
      
      ['viewBox', `0 0 ${size} ${size}`],
      ['width', width], ['height', height], ['fill', light]
      ].forEach(([k, v]) => svg.setAttribute(k, v));

      // 背景
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      ['width', '100%'], ['height', '100%'], ['fill', light]
      ].forEach(([k, v]) => bg.setAttribute(k, v));
      svg.appendChild(bg);

      // QRモジュール
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (qr.isDark(row, col)) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            ['x', col], ['y', row], ['width', 1], ['height', 1], ['fill', dark]
            ].forEach(([k, v]) => rect.setAttribute(k, v));
            svg.appendChild(rect);
          }
        }
      }
      
      return svg;
    }

    static createCanvas(qr, options = {}) {
      if (typeof document === 'undefined') {
        throw new Error('Canvas rendering requires DOM');
      }

      const { width = 256, height = 256, dark = '#000', light = '#fff' } = options;
      const size = qr.getSize();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = width;
      canvas.height = height;
      
      const cellWidth = width / size;
      const cellHeight = height / size;
      
      // 背景
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
      
      // QRモジュール
      ctx.fillStyle = dark;
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
          }
        }
      }
      
      return canvas;
    }
  }

  // メインQRCodeクラス（モダンAPI）
  class QRCode {
    constructor(element, options = {}) {
      this.element = typeof element === 'string' ? 
        (typeof document !== 'undefined' ? document.getElementById(element) : null) : element;
      
      this.options = {
        text: '',
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QR_CONFIG.ERROR_LEVELS.H,
        useSVG: false,
        ...options
      };

      if (this.options.text) {
        this.makeCode(this.options.text);
      }
    }

    makeCode(text) {
      if (!text) throw new Error('Text is required');
      
      const type = Utils.getOptimalType(text, this.options.correctLevel);
      const qr = new QRCodeGenerator(type, this.options.correctLevel)
        .addData(text)
        .generate();

      this.render(qr);
      return this;
    }

    render(qr) {
      if (!this.element) return;

      this.clear();
      
      const renderOptions = {
        width: this.options.width,
        height: this.options.height,
        dark: this.options.colorDark,
        light: this.options.colorLight
      };

      const element = this.options.useSVG ? 
        QRRenderer.createSVG(qr, renderOptions) :
        QRRenderer.createCanvas(qr, renderOptions);
        
      this.element.appendChild(element);
    }

    clear() {
      if (this.element) {
        while (this.element.firstChild) {
          this.element.removeChild(this.element.firstChild);
        }
      }
    }

    // 静的メソッド（関数型API）
    static generate(text, options = {}) {
      const type = Utils.getOptimalType(text, options.correctLevel || QR_CONFIG.ERROR_LEVELS.H);
      return new QRCodeGenerator(type, options.correctLevel || QR_CONFIG.ERROR_LEVELS.H)
        .addData(text)
        .generate();
    }

    static toSVG(text, options = {}) {
      const qr = QRCode.generate(text, options);
      return QRRenderer.createSVG(qr, options);
    }

    static toCanvas(text, options = {}) {
      const qr = QRCode.generate(text, options);
      return QRRenderer.createCanvas(qr, options);
    }
  }

  // エラー訂正レベルの公開
  QRCode.CorrectLevel = QR_CONFIG.ERROR_LEVELS;

  // モジュールエクスポート（環境対応）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRCode;
  } else if (typeof window !== 'undefined') {
    window.QRCode = QRCode;
  }

  return QRCode;
})();