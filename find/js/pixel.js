/*
 * 한칸 찾기 · pixel.js — 도트 그림 (v0.10, 모든 스토어 공통)
 * 칸 친구 8 · 한칸 방 가구 24 · 퍼즐 장면 2 · 수집 화면 배경을 모두 코드로 한 칸씩 칠한다(그림 파일 없음).
 * - 그림은 글자 칸(rows)으로 그리고, 바깥 테두리(#)는 자동으로 두른다. 안쪽 선은 'k'로 직접 칠한다.
 * - 등급(tier)에 따라 색을 바꾼다.
 *     가구 1 낡은(바랜 색·얼룩) · 2 일반 · 3 고급(금빛 테두리) · 4 반짝(밝은 금빛 테두리, 화면에서 반짝임)
 *     친구 1 새내기 · 2 단짝(볼터치) · 3 멋쟁이(금빛 테두리) · 4 반짝
 * Pixel.url(id, tier) → 그림 주소(data URL, 8배로 키운 PNG) · Pixel.dims(id) → {w, h} (테두리 포함 칸 수)
 */
(function (root) {
  'use strict';
  var PAL = {
    k: '#1b1d3a', e: '#1b1d3a', '#': '#1b1d3a', w: '#ffffff', W: '#e3e7f6', n: '#272c69', j: '#7a1c3a',
    o: '#d08f4e', O: '#efbd82', d: '#93592c', D: '#6b3d1c',
    b: '#4f8fe6', B: '#2f62b8', c: '#a9cbff',
    g: '#5cc45a', G: '#2f8f3a', h: '#aee89f',
    r: '#e8474c', R: '#a82a30', s: '#ff9aa0',
    y: '#f6c83a', Y: '#fff0a0', z: '#c9951a',
    t: '#6fc2bb', T: '#3f948d', u: '#c8eeea',
    m: '#b9bdd6', M: '#7f86ad', l: '#e6e8f4',
    p: '#ff9bb0', P: '#e2668a',
    x: '#d6966a', X: '#9c6040',
    v: '#a78bfa', V: '#6d4fd1',
    a: '#ffa957', A: '#e0761e', i: '#ffd6a8',
    q: '#5fc8f2', Q: '#2f86c0',
    f: '#fff7e0', F: '#ead3a2'
  };

  // ===================== 칸 그리기 도구 =====================
  function Grid(w, h) { this.w = w; this.h = h; this.c = []; for (var y = 0; y < h; y++) { var row = []; for (var x = 0; x < w; x++) row.push('.'); this.c.push(row); } }
  Grid.prototype.p = function (x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch; return this; };
  Grid.prototype.g = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y][x] : '.'; };
  Grid.prototype.r = function (x, y, w, h, ch) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.p(x + i, y + j, ch); return this; };
  Grid.prototype.hl = function (x, y, n, ch) { return this.r(x, y, n, 1, ch); };
  Grid.prototype.vl = function (x, y, n, ch) { return this.r(x, y, 1, n, ch); };
  Grid.prototype.o = function (cx, cy, rx, ry, ch) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry;
      if (a * a + b * b <= 1) this.p(x, y, ch);
    }
    return this;
  };
  Grid.prototype.s = function (x, y, rows) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var ch = rows[j][i]; if (ch !== '.') this.p(x + i, y + j, ch); }
    return this;
  };
  // 같은 글자 덩어리의 위쪽 가장자리는 밝게, 아래쪽 가장자리는 어둡게
  Grid.prototype.sh = function (ch, lite, dark, side) {
    var me = this, snap = this.c.map(function (r) { return r.slice(); });
    function at(x, y) { return x >= 0 && y >= 0 && x < me.w && y < me.h ? snap[y][x] : '.'; }
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      if (snap[y][x] !== ch) continue;
      if (dark && (at(x, y + 1) !== ch || (side && at(x + 1, y) !== ch))) this.c[y][x] = dark;
      else if (lite && at(x, y - 1) !== ch) this.c[y][x] = lite;
    }
    return this;
  };
  Grid.prototype.rep = function (map) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (map[this.c[y][x]]) this.c[y][x] = map[this.c[y][x]];
    return this;
  };
  function fromRows(rows) { var g = new Grid(rows[0].length, rows.length); g.s(0, 0, rows); return g; }
  function rep(ch, n) { var s = ''; for (var i = 0; i < n; i++) s += ch; return s; }

  // 바깥 테두리 '#': 그림(k 제외) 바로 옆(위·아래·양옆)의 빈 칸
  function outline(g) {
    var o = new Grid(g.w + 2, g.h + 2);
    for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) o.c[y + 1][x + 1] = g.c[y][x];
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (y = 0; y < o.h; y++) for (x = 0; x < o.w; x++) {
      if (o.c[y][x] !== '.') continue;
      for (var k = 0; k < 4; k++) {
        var ch = g.g(x - 1 + D[k][0], y - 1 + D[k][1]);
        if (ch !== '.' && ch !== 'k' && ch !== '#') { o.c[y][x] = '#'; break; }
      }
    }
    return o;
  }

  // ===================== 칸 친구들 (18×20 + 테두리) =====================
  var FR = {
    f1: { shape: 'circle', c: '#2cc271', mouth: 'smile', acc: 'sprout' },
    f2: { shape: 'tri', c: '#f1535b', mouth: 'open' },
    f3: { shape: 'square', c: '#4181f6', mouth: 'flat', eyes: 'happy', acc: 'antenna' },
    f4: { shape: 'diamond', c: '#f8c632', mouth: 'o' },
    f5: { shape: 'star', c: '#ff9a3c', mouth: 'grin' },
    f6: { shape: 'cloud', c: '#7fd0fb', mouth: 'smile', eyes: 'happy', acc: 'drops' },
    f7: { shape: 'heart', c: '#ff7eb6', mouth: 'open', acc: 'bow' },
    f8: { shape: 'hex', c: '#a78bfa', mouth: 'grin', eyes: 'wink', acc: 'sparkle' }
  };
  var STAR = (function () {
    var o = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3.9 : 8.4; o.push([8 + Math.cos(a) * rr, 8.7 + Math.sin(a) * rr]); }
    return o;
  })();
  function inPoly(px, py, P) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > py) !== (P[j][1] > py) && px < (P[j][0] - P[i][0]) * (py - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    }
    return c;
  }
  function circ(x, y, cx, cy, r) { return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r; }
  var MASK = {
    circle: function (x, y) { return circ(x, y, 8, 8, 7.6); },
    tri: function (x, y) { if (y < 1.5 || y > 15.5) return false; var t = (y - 1.5) / 14, hw = 1.1 + t * 7.0; return Math.abs(x - 8) <= hw; },
    square: function (x, y) {
      if (x < 1 || x > 15 || y < 1 || y > 15) return false;
      var cx = Math.max(4, Math.min(12, x)), cy = Math.max(4, Math.min(12, y));
      return circ(x, y, cx, cy, 3.2);
    },
    diamond: function (x, y) { return Math.abs(x - 8) + Math.abs(y - 8) <= 7.9; },
    star: function (x, y) { return inPoly(x, y, STAR); },
    cloud: function (x, y) { return circ(x, y, 5, 9.6, 3.9) || circ(x, y, 8.8, 6.4, 4.7) || circ(x, y, 12.3, 9.6, 3.6) || (Math.pow((x - 8.2) / 7.4, 2) + Math.pow((y - 11.6) / 3.3, 2) <= 1); },
    heart: function (x, y) { var X = (x - 8) / 6.8, Y = (9.3 - y) / 6.6, a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; },
    hex: function (x, y) { var dx = Math.abs(x - 8), dy = Math.abs(y - 8); return dy <= 6.9 && dx <= 8 - dy * 0.58; }
  };
  var EYE_Y = { circle: 7, tri: 9, square: 7, diamond: 7, star: 8, cloud: 8, heart: 6, hex: 7 };
  function buildFriend(id) {
    var F = FR[id], g = new Grid(18, 20), OX = 1, OY = 3, m = MASK[F.shape], x, y;
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) if (m(x + 0.5, y + 0.5)) g.p(OX + x, OY + y, 'M');
    g.sh('M', 'L', 'S', true);
    // 광택
    var top = -1;
    for (y = 0; y < 16 && top < 0; y++) for (x = 0; x < 16; x++) if (g.g(OX + x, OY + y) !== '.') { top = y; break; }
    if (F.shape !== 'tri' && F.shape !== 'star') { g.p(OX + 4, OY + top + 2, 'L'); g.p(OX + 3, OY + top + 3, 'L'); }
    var ey = EYE_Y[F.shape], P = function (lx, ly, ch) { g.p(OX + lx, OY + ly, ch); };
    function eyeN(lx) { P(lx, ey, 'w'); P(lx + 1, ey, 'e'); P(lx, ey + 1, 'e'); P(lx + 1, ey + 1, 'e'); }
    function eyeH(lx) { P(lx, ey + 1, 'e'); P(lx + 1, ey, 'e'); P(lx + 2, ey + 1, 'e'); }
    if (F.eyes === 'happy') { eyeH(4); eyeH(9); }
    else if (F.eyes === 'wink') { eyeN(5); eyeH(9); }
    else { eyeN(5); eyeN(9); }
    var my = ey + 3;
    ['q'].forEach(function () {
      [[3, my - 1], [4, my - 1], [11, my - 1], [12, my - 1]].forEach(function (c) { if (m(c[0] + 0.5, c[1] + 0.5) && m(c[0] + 0.5, c[1] + 1.5)) P(c[0], c[1], 'q'); });
    });
    switch (F.mouth) {
      case 'open': P(6, my, 'e'); P(7, my, 'e'); P(8, my, 'e'); P(9, my, 'e'); P(6, my + 1, 'e'); P(7, my + 1, 'j'); P(8, my + 1, 'j'); P(9, my + 1, 'e'); P(7, my + 2, 'e'); P(8, my + 2, 'e'); break;
      case 'flat': P(7, my + 1, 'e'); P(8, my + 1, 'e'); break;
      case 'o': P(7, my, 'e'); P(8, my, 'e'); P(7, my + 1, 'j'); P(8, my + 1, 'j'); P(7, my + 2, 'e'); P(8, my + 2, 'e'); break;
      case 'grin': P(6, my, 'e'); P(7, my, 'w'); P(8, my, 'w'); P(9, my, 'e'); P(7, my + 1, 'e'); P(8, my + 1, 'e'); break;
      default: P(6, my, 'e'); P(9, my, 'e'); P(7, my + 1, 'e'); P(8, my + 1, 'e');
    }
    switch (F.acc) {
      case 'sprout': g.s(3, 0, ['..hh....hh..', '.hhhhGGhhhh.', '...ggGGgg...']); break;
      case 'antenna': g.s(8, 0, ['Yy', 'yy', 'k.', 'k.']); break;
      case 'drops': g.s(0, 15, ['q..', 'q..']); g.s(16, 16, ['.q', '.q']); break;
      case 'bow': g.s(1, 0, ['PP..PP', 'PPssPP', 'PP..PP']); break;
      case 'sparkle': g.s(15, 0, ['.Y.', 'YYY', '.Y.']); g.p(1, 1, 'Y'); break;
    }
    var o = outline(g);
    o.pal = { M: F.c, L: mix(F.c, '#ffffff', 0.45), S: mix(F.c, '#1b1d3a', 0.32), q: F.c };
    o.cheek = mix(F.c, '#ff6f9a', 0.6);
    return o;
  }

  // ===================== 한칸 방 가구 (안쪽만 그리고 테두리는 자동) =====================
  var FU = {};
  FU.r1 = function () { // 파란 소파 29×16
    var L12 = 'bccccccccccb', L12b = 'bcbbbbbbbbbb', F12 = rep('b', 12), S12 = rep('B', 12);
    return fromRows([
      '..' + rep('b', 25) + '..',
      '..' + L12 + 'k' + L12 + '..',
      '..' + L12b + 'k' + L12b + '..',
      '..' + F12 + 'k' + F12 + '..',
      '..' + F12 + 'k' + F12 + '..',
      '..' + S12 + 'k' + S12 + '..',
      'cccc' + rep('k', 21) + 'cccc',
      'bccb' + rep('c', 10) + 'k' + rep('c', 10) + 'bccb',
      'bbbb' + rep('b', 10) + 'k' + rep('b', 10) + 'bbbb',
      'bbbb' + rep('b', 10) + 'k' + rep('b', 10) + 'bbbb',
      'bbbB' + rep('B', 10) + 'k' + rep('B', 10) + 'Bbbb',
      'bbbk' + rep('k', 21) + 'kbbb',
      'bbbb' + rep('b', 21) + 'bbbb',
      'BBBB' + rep('B', 21) + 'BBBB',
      '.dd.' + rep('.', 21) + '.dd.',
      '.dd.' + rep('.', 21) + '.dd.'
    ]);
  };
  FU.r2 = function () { return FU.r1().rep({ b: 'g', c: 'h', B: 'G' }); }; // 초록 소파
  FU.r3 = function () { // 빨간 빈백 15×12
    var g = new Grid(15, 12);
    g.o(7.5, 7.4, 7.5, 4.8, 'r').o(7.5, 4.2, 5.4, 4.2, 'r');
    g.sh('r', null, 'R');
    g.s(3, 1, ['.ss', 'ss.', 's..']);
    g.s(4, 6, ['R.....R', '.RRRRR.']);
    return g;
  };
  FU.r4 = function () { // 노란 의자 10×13
    return fromRows([
      '.yyyyyyyy.',
      'yYYYYYYYYy',
      'yyyyyyyyyy',
      'yyyyyyyyyy',
      'zzzzzzzzzz',
      '.y......y.',
      '.y......y.',
      'YYYYYYYYYY',
      'yyyyyyyyyy',
      'zzzzzzzzzz',
      '.z......z.',
      '.z......z.',
      '.z......z.'
    ]);
  };
  FU.r5 = function () { // 포근한 침대 25×14
    return fromRows([
      '..' + rep('o', 21) + '..',
      '.o' + rep('O', 21) + 'o.',
      '.' + rep('o', 23) + '.',
      '.ooo' + 'fffffff' + 'ooo' + 'fffffff' + 'ooo.',
      '.oo' + 'fffffffff' + 'o' + 'fffffffff' + 'oo.',
      '.oo' + 'fFfffffff' + 'o' + 'fFfffffff' + 'oo.',
      rep('i', 25),
      rep('a', 25),
      'aaaiaaaaaiaaaaaiaaaaaiaaa',
      rep('a', 25),
      rep('A', 25),
      rep('d', 25),
      'dd' + rep('.', 21) + 'dd',
      'dd' + rep('.', 21) + 'dd'
    ]);
  };
  FU.r6 = function () { // 둥근 탁자 13×13 (위에 머그컵)
    return fromRows([
      '.....rr......',
      '....wrrr.....',
      '.....rr......',
      '..ooooooooo..',
      '.oOOOOOOOOOo.',
      'ooooooooooooo',
      '.ddddddddddd.',
      '.....ddd.....',
      '.....ddd.....',
      '.....ddd.....',
      '.....ddd.....',
      '....ddddd....',
      '..ddddddddd..'
    ]);
  };
  FU.r7 = function () { // 작은 책상 13×13 (위에 책)
    return fromRows([
      '..rrrr...q...',
      '..bbbb..qqq..',
      'OOOOOOOOOOOOO',
      'ooooooooooooo',
      'ddddddddddddd',
      'dd.....oooooo',
      'dd.....ookkoo',
      'dd.....oooooo',
      'dd.....dddddd',
      'dd.....oooooo',
      'dd.....ookkoo',
      'dd.....oooooo',
      'dd.....dddddd'
    ]);
  };
  FU.r8 = function () { // 협탁 스탠드 9×16
    return fromRows([
      '..yyyyy..',
      '.yYYYYYy.',
      '.yyyyyyy.',
      'zzzzzzzzz',
      '....M....',
      '...MMM...',
      'OOOOOOOOO',
      'ooooooooo',
      'oookkkooo',
      'ooooooooo',
      'ddddddddd',
      'ooooooooo',
      'oookkkooo',
      'ooooooooo',
      'dd.....dd',
      'dd.....dd'
    ]);
  };
  FU.r9 = function () { // 책장 14×19
    var g = new Grid(14, 19);
    g.r(0, 0, 14, 19, 'o').hl(0, 0, 14, 'O');
    var books = [['r', 4], ['b', 3], ['y', 4], ['g', 3], ['v', 4], ['a', 2], ['q', 4], ['p', 3], ['t', 4], ['r', 3], ['y', 2], ['b', 4]];
    [1, 7, 13].forEach(function (top, s) {
      g.r(1, top, 12, 5, 'd');
      var x = 1, k = s * 3;
      while (x < 13) {
        var bk = books[(k++) % books.length], wdt = (k % 3 === 0) ? 2 : 1, ht = bk[1];
        if (x + wdt > 13) wdt = 13 - x;
        if (k % 5 === 4) { x++; continue; }
        g.r(x, top + 5 - ht, wdt, ht, bk[0]);
        g.p(x, top + 5 - ht, PAL[bk[0]] ? bk[0] : bk[0]);
        x += wdt;
      }
      g.hl(0, top + 5, 14, 'O');
    });
    g.hl(1, 18, 12, 'd');
    return g;
  };
  FU.r10 = function () { // 서랍장 13×16
    var g = new Grid(13, 16);
    g.r(0, 0, 13, 2, 'O').hl(0, 1, 13, 'o');
    [2, 6, 10].forEach(function (y) { g.r(0, y, 13, 4, 'o').hl(0, y + 3, 13, 'd').p(5, y + 1, 'k').p(6, y + 1, 'y').p(7, y + 1, 'k'); g.hl(1, y, 11, 'O'); });
    g.r(0, 14, 2, 2, 'd').r(11, 14, 2, 2, 'd');
    return g;
  };
  FU.r11 = function () { // 수납장 14×16 (위에 작은 화분)
    var g = new Grid(14, 16);
    g.s(9, 0, ['.gg.', 'gGgg', '.xx.']);
    g.r(0, 3, 14, 11, 'o').hl(0, 3, 14, 'O').vl(7, 4, 9, 'k').hl(0, 13, 14, 'd');
    g.r(1, 5, 5, 6, 'O').r(8, 5, 5, 6, 'O').r(2, 6, 3, 4, 'o').r(9, 6, 3, 4, 'o');
    g.p(6, 8, 'y').p(8, 8, 'y');
    g.r(0, 14, 2, 2, 'd').r(12, 14, 2, 2, 'd');
    return g;
  };
  FU.r12 = function () { // 동그란 스탠드 8×19
    var g = new Grid(8, 19);
    g.o(4, 3.5, 4, 3.5, 'y').sh('y', 'Y', 'z');
    g.p(2, 2, 'Y').p(2, 3, 'w');
    g.vl(3, 7, 10, 'M').vl(4, 7, 10, 'm');
    g.r(1, 17, 6, 1, 'M').r(0, 18, 8, 1, 'M');
    return g;
  };
  FU.r13 = function () { // 빨간 전등 (천장) 10×14
    var g = new Grid(10, 14);
    g.vl(4, 0, 6, 'k').vl(5, 0, 6, 'k');
    g.r(3, 5, 4, 1, 'M');
    g.o(5, 10.6, 5, 4.6, 'r').r(0, 11, 10, 3, '.');
    g.sh('r', 's', null).hl(0, 10, 10, 'R');
    g.r(3, 11, 4, 2, 'Y').p(4, 11, 'w');
    return g;
  };
  FU.r14 = function () { // 큰 화분 15×17
    var g = new Grid(15, 17);
    g.o(4, 5.5, 4, 3.4, 'g').o(10.8, 5, 4.2, 3.6, 'g').o(7.5, 2.8, 3.6, 2.8, 'g').o(7.5, 8.2, 6.2, 2.8, 'g');
    g.sh('g', 'h', 'G');
    g.vl(7, 7, 3, 'G');
    g.s(2, 10, ['xxxxxxxxxxx', '.XXXXXXXXX.', '.xxxxxxxxx.', '.xxxxxxxxx.', '..xxxxxxx..', '..xxxxxxx..', '..XXXXXXX..']);
    return g;
  };
  FU.r15 = function () { // 선인장 10×15 (파란 화분)
    return fromRows([
      '....pp....',
      '...gpgg...',
      '...ghgg...',
      '.g.gggg...',
      '.g.ghgg.g.',
      '.gggggg.g.',
      '...ghggggg',
      '...gggg...',
      '...ghgg...',
      '...gggg...',
      'bbbbbbbbbb',
      'cBBBBBBBBB',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '..BBBBBB..'
    ]).sh('g', null, 'G');
  };
  FU.r16 = function () { // 걸이 화분 (천장) 14×17
    return fromRows([
      '......kk......',
      '......kk......',
      '.....k..k.....',
      '....k....k....',
      '...k......k...',
      '..k........k..',
      '..gghggghhgg..',
      '.gGgggGgggGgg.',
      '.xxxxxxxxxxxx.',
      '.XXXXXXXXXXXX.',
      '..xxxxxxxxxx..',
      'gg.xxxxxxxx.gg',
      '.g..XXXXXX..g.',
      '.gh...g....hg.',
      '..g...gh...g..',
      '.gg....g..gg..',
      '.g.....g...g..'
    ]);
  };
  FU.r17 = function () { // 벽시계 12×12
    var g = new Grid(12, 12);
    g.o(6, 6, 6, 6, 'y').o(6, 6, 4.6, 4.6, 'w');
    g.p(6, 2, 'k').p(6, 9, 'k').p(2, 6, 'k').p(9, 6, 'k');
    g.vl(6, 3, 3, 'k').hl(6, 6, 3, 'k').p(6, 6, 'r');
    g.sh('y', 'Y', 'z');
    return g;
  };
  FU.r18 = function () { // 구름 창문 22×20
    var g = new Grid(22, 20);
    g.r(2, 0, 18, 17, 'W').r(3, 1, 16, 15, 'q');
    g.r(3, 1, 16, 5, 'c');
    g.o(7.5, 6.5, 3.2, 1.8, 'w').o(9.5, 5.6, 2.4, 1.8, 'w').o(14.5, 11.2, 3, 1.6, 'w').o(16, 10.4, 2, 1.5, 'w');
    g.vl(10, 1, 15, 'W').hl(3, 8, 16, 'W');
    g.r(0, 0, 3, 19, 'p').r(19, 0, 3, 19, 'p');
    g.vl(1, 0, 19, 'P').vl(20, 0, 19, 'P');
    g.r(1, 17, 20, 2, 'O').hl(1, 18, 20, 'o');
    g.hl(0, 0, 22, 'P');
    return g;
  };
  FU.r19 = function () { // 벽 선반 13×11 (위에 화분·책·별)
    return fromRows([
      '.gg..........',
      'gGgg...r.....',
      '.gg..b.r..y..',
      '.xx..b.r.yyy.',
      '.xx..bvr..y..',
      '.XX..bvr.....',
      'OOOOOOOOOOOOO',
      'ooooooooooooo',
      '.d.........d.',
      '.dd.......dd.',
      '..d.......d..'
    ]);
  };
  FU.r20 = function () { // 게임기 TV 15×15
    var g = new Grid(15, 15);
    g.p(4, 0, 'k').p(5, 1, 'k').p(10, 0, 'k').p(9, 1, 'k');
    g.r(0, 2, 15, 10, 't').hl(0, 2, 15, 'u').hl(0, 11, 15, 'T');
    g.r(1, 3, 10, 8, 'n');
    g.r(3, 5, 2, 2, 'g').r(5, 5, 2, 2, 'r').r(3, 7, 2, 2, 'b').r(5, 7, 2, 2, 'y').r(7, 7, 2, 2, 'g').r(7, 5, 2, 2, 'b');
    g.p(4, 5, 'h').p(8, 7, 'Y');
    g.p(12, 4, 'r').p(12, 6, 'y').hl(12, 8, 2, 'T').hl(12, 9, 2, 'T');
    g.r(4, 12, 7, 1, 'd').r(2, 13, 11, 2, 'o').hl(2, 13, 11, 'O');
    return g;
  };
  FU.r21 = function () { // 작은 피아노 15×15
    var g = new Grid(15, 15);
    g.r(0, 0, 15, 15, 't').hl(0, 0, 15, 'u');
    g.r(4, 1, 7, 4, 'f').hl(5, 2, 5, 'k').hl(5, 3, 2, 'k').p(9, 3, 'k');
    g.hl(0, 6, 15, 'T');
    g.r(0, 7, 15, 3, 'w');
    for (var x = 1; x < 15; x += 2) g.vl(x, 7, 3, x % 4 === 1 ? 'k' : 'm');
    [1, 3, 7, 9, 11].forEach(function (xx) { g.vl(xx, 7, 2, 'k'); });
    g.hl(0, 10, 15, 'T');
    g.r(1, 11, 2, 4, 'T').r(12, 11, 2, 4, 'T').r(3, 11, 9, 2, 'T');
    g.r(3, 13, 9, 2, '.');
    return g;
  };
  FU.r22 = function () { // 어항 13×15
    var g = new Grid(13, 15);
    g.r(0, 0, 13, 10, 'c').r(1, 2, 11, 8, 'q').hl(1, 1, 11, 'u');
    g.r(1, 8, 11, 2, 'F').hl(1, 8, 11, 'f');
    g.vl(2, 4, 4, 'g').vl(3, 5, 3, 'G').vl(10, 5, 3, 'g');
    g.s(5, 4, ['.aa.a', 'aakaa', '.aa.a']);
    g.p(8, 2, 'w').p(9, 3, 'w').p(4, 3, 'w');
    g.hl(0, 10, 13, 'M');
    g.r(1, 11, 11, 4, 'o').hl(1, 11, 11, 'O').vl(6, 12, 3, 'k').p(4, 13, 'y').p(8, 13, 'y');
    return g;
  };
  FU.r23 = function () { // 장난감 상자 13×14
    var g = new Grid(13, 14);
    g.o(4, 3, 3, 3, 'r').s(2, 1, ['w.', 'ww']);
    g.hl(1, 3, 6, 'w');
    g.s(8, 0, ['..y..', '.yyy.', 'yyYyy', '.yyy.', '.y.y.']);
    g.r(6, 3, 3, 3, 'b').p(6, 3, 'c');
    g.r(0, 5, 13, 9, 't').hl(0, 5, 13, 'u').hl(0, 6, 13, 'T');
    g.vl(3, 7, 7, 'T').vl(9, 7, 7, 'T');
    g.r(4, 8, 5, 3, 'y').hl(4, 8, 5, 'Y');
    g.hl(0, 13, 13, 'T');
    return g;
  };
  FU.r24 = function () { // 네 색 러그 30×24
    var g = new Grid(30, 24);
    g.r(2, 0, 26, 24, 'f').r(3, 1, 24, 22, 'F').r(4, 2, 22, 20, 'f');
    g.r(5, 3, 10, 9, 'g').r(15, 3, 10, 9, 'r').r(5, 12, 10, 9, 'b').r(15, 12, 10, 9, 'y');
    g.r(8, 6, 4, 3, 'h').r(18, 6, 4, 3, 's').r(8, 15, 4, 3, 'c').r(18, 15, 4, 3, 'Y');
    for (var y = 1; y < 24; y += 2) { g.p(0, y, 'F').p(1, y, 'F'); g.p(28, y, 'F').p(29, y, 'F'); }
    return g;
  };

  // ===================== 퍼즐 장면 (30×30, 퍼즐 칸 10×10 × 9) =====================
  function buildScene(id) {
    var N = 30, px = [], x, y;
    for (y = 0; y < N; y++) { px.push([]); for (x = 0; x < N; x++) px[y].push(null); }
    function P(x, y, c) { if (x >= 0 && y >= 0 && x < N && y < N) px[y][x] = c; }
    function O(cx, cy, rx, ry, c) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var a = (x + .5 - cx) / rx, b = (y + .5 - cy) / ry; if (a * a + b * b <= 1) P(x, y, c); } }
    function S(x0, y0, rows, map) { rows.forEach(function (r, j) { for (var i = 0; i < r.length; i++) if (r[i] !== '.') P(x0 + i, y0 + j, map[r[i]]); }); }
    if (id === 'sunset') {
      var bands = ['#2b1a4a', '#2b1a4a', '#2b1a4a', '#3b1f58', '#3b1f58', '#4f2565', '#4f2565', '#652a6b', '#652a6b', '#7a2f6b', '#7a2f6b', '#93366d',
        '#ab3f6e', '#c4496d', '#d9566a', '#ea6363', '#f27a5e', '#f6905b', '#f9a75b', '#fcbb5d', '#ffc95f'];
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) P(x, y, bands[Math.min(bands.length - 1, y)]);
      [[3, 2], [9, 1], [14, 4], [25, 2], [28, 6], [19, 1], [6, 6], [22, 5]].forEach(function (s) { P(s[0], s[1], '#ffffff'); });
      P(14, 5, '#ffe9a8'); P(13, 4, '#ffe9a8'); P(15, 4, '#ffe9a8'); P(14, 3, '#ffe9a8');
      O(20.5, 18.5, 5.4, 5.4, '#ffd86b'); O(20.5, 18.5, 4.2, 4.2, '#ffe9a0'); P(18, 16, '#fff7d0'); P(19, 15, '#fff7d0');
      O(7, 11, 4.5, 1.1, '#ff9e9a'); O(9.5, 10.2, 2.6, 1.1, '#ff9e9a'); O(25, 9, 3.6, 0.9, '#ff9e9a');
      S(10, 7, ['k.k', '.k.'], { k: '#3a1838' }); S(15, 8, ['k.k'], { k: '#3a1838' });
      for (x = 0; x < N; x++) {
        var h1 = Math.round(19.5 + 2.2 * Math.sin(x / 5 + 0.6)), h2 = Math.round(22.5 + 1.6 * Math.sin(x / 4 + 2.1)), h3 = Math.round(25.5 + 1.2 * Math.cos(x / 3.4));
        for (y = h1; y < N; y++) P(x, y, '#a8456f');
        for (y = h2; y < N; y++) P(x, y, '#6b2a5e');
        for (y = h3; y < N; y++) P(x, y, '#3a1840');
      }
      S(21, 17, ['..k...', '.kkk.k', 'kkkkkk', '.hhhh.', '.hyhh.', '.hhhh.'], { k: '#2a1233', h: '#3c1a44', y: '#ffd36b' });
      S(4, 18, ['.ttt.', 'ttttt', 'ttttt', '.ttt.', '..b..', '..b..'], { t: '#2a1233', b: '#24102a' });
      [[9, 27, '#ffd36b'], [11, 28, '#ff8fb1'], [24, 27, '#ffd36b'], [26, 28, '#ff8fb1'], [3, 28, '#ffd36b'], [17, 28, '#ff8fb1']].forEach(function (f) { P(f[0], f[1], f[2]); });
    } else {
      var sea = ['#7ad9f2', '#6fd2f0', '#62c9ec', '#55bfe7', '#4ab4e1', '#40a8da', '#379dd3', '#3092cb', '#2a87c3', '#257cba', '#2071b0', '#1c67a6',
        '#185d9c', '#155392', '#124a88', '#10427e', '#0e3b75', '#0c356c'];
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) P(x, y, sea[Math.min(sea.length - 1, y)]);
      for (y = 0; y < 22; y++) { [4, 13, 22].forEach(function (s, k) { var xx = s + Math.floor(y / 3) + k; if (px[y][xx]) P(xx, y, mix(px[y][xx], '#ffffff', 0.16)); if (px[y][xx + 1]) P(xx + 1, y, mix(px[y][xx + 1], '#ffffff', 0.08)); }); }
      var fish = ['.ff.f', 'fkfff', '.ff.f'];
      S(5, 9, fish, { f: '#ff9a3c', k: '#13163a' });
      S(19, 14, ['f.ff.', 'fffkf', 'f.ff.'], { f: '#f8c632', k: '#13163a' });
      S(14, 5, ['.ff.f', 'fkfff', '.ff.f'], { f: '#ff7eb6', k: '#13163a' });
      [[4, 6], [5, 4], [22, 9], [23, 7], [24, 5], [12, 16], [3, 18]].forEach(function (b) { P(b[0], b[1], '#dff6ff'); });
      for (x = 0; x < N; x++) {
        var s1 = Math.round(24.5 + 1.2 * Math.sin(x / 4)), s2 = Math.round(27 + 0.8 * Math.sin(x / 3 + 1));
        for (y = s1; y < N; y++) P(x, y, '#e2c58a');
        for (y = s2; y < N; y++) P(x, y, '#c9a76a');
      }
      [[2, 1], [5, -1], [27, 1]].forEach(function (w, k) {
        for (y = 14 + k * 2; y < 26; y++) P(w[0] + ((y + k) % 4 < 2 ? 0 : w[1] || 1), y, k % 2 ? '#1f9a5a' : '#2fbf71');
      });
      S(19, 19, ['k.k.k', 'kkkkk', '.kkk.', '..k..', '..k..'], { k: '#ff7a9c' });
      S(11, 21, ['.bbbbbb.', 'bBBBBBBb', 'bbbyybbb', 'bbbbbbbb'], { b: '#8a4b22', B: '#a65e2d', y: '#f8c632' });
      P(10, 24, '#f8c632'); P(19, 25, '#f8c632'); P(20, 24, '#f8c632');
      S(5, 26, ['..a..', 'aaaaa', '.aaa.', 'a...a'], { a: '#ff9a3c' });
    }
    return px;
  }

  // ===================== 수집 화면 뒤 배경 (밤 언덕, 흰색을 옅게) =====================
  function buildBg() {
    var W = 64, Hh = 144, px = [], x, y;
    for (y = 0; y < Hh; y++) { px.push([]); for (x = 0; x < W; x++) px[y].push(null); }
    function P(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < Hh) px[y][x] = c; }
    var stars = [[4, 6], [12, 13], [21, 5], [29, 18], [40, 24], [55, 10], [8, 29], [17, 37], [37, 42], [3, 47], [60, 33], [47, 54], [25, 60], [58, 66], [10, 70], [34, 8], [50, 3]];
    stars.forEach(function (s, i) { P(s[0], s[1], 'rgba(255,255,255,' + (i % 3 ? .35 : .6) + ')'); });
    [[21, 5], [55, 10]].forEach(function (s) { ['-1,0', '1,0', '0,-1', '0,1'].forEach(function (d) { var p = d.split(','); P(s[0] + +p[0], s[1] + +p[1], 'rgba(255,255,255,.25)'); }); });
    for (y = 0; y < 9; y++) for (x = 0; x < 9; x++) { var a = (x - 4) * (x - 4) + (y - 4) * (y - 4), b = (x - 6) * (x - 6) + (y - 3) * (y - 3); if (a <= 16 && b > 12) P(46 + x, 16 + y, 'rgba(255,255,255,.4)'); }
    for (x = 0; x < W; x++) {
      var h1 = Math.round(112 + 6 * Math.sin(x / 9 + 1)), h2 = Math.round(124 + 5 * Math.sin(x / 7 + 3));
      for (y = h1; y < Hh; y++) P(x, y, 'rgba(255,255,255,.06)');
      for (y = h2; y < Hh; y++) P(x, y, 'rgba(255,255,255,.1)');
    }
    var house = ['..k...', '.kkk..', 'kkkkk.', '.kwk..', '.kkk..'];
    house.forEach(function (r, j) { for (var i = 0; i < r.length; i++) if (r[i] !== '.') P(44 + i, 113 + j, r[i] === 'w' ? 'rgba(255,214,107,.7)' : 'rgba(255,255,255,.14)'); });
    return { w: W, h: Hh, px: px };
  }

  // ===================== 색 · 등급 =====================
  function rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function hex(a) { return '#' + a.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { var A = rgb(a), B = rgb(b); return hex(A.map(function (v, i) { return v + (B[i] - v) * t; })); }
  function gray(a, t) { var A = rgb(a), L = A[0] * .3 + A[1] * .59 + A[2] * .11; return hex(A.map(function (v) { return v + (L - v) * t; })); }
  function hash(x, y) { var h = Math.imul(x * 374761393 + y * 668265263, 1274126177); return ((h ^ (h >>> 13)) >>> 0) % 97; }

  var cache = {}, built = {};
  function sprite(id) {
    if (built[id]) return built[id];
    var sp = null;
    if (FR[id]) sp = buildFriend(id);
    else if (FU[id]) { sp = outline(FU[id]()); sp.pal = {}; }
    return (built[id] = sp);
  }
  // 등급별 색: 칸 하나하나의 색(없으면 null)
  function colors(id, tier) {
    var sp = sprite(id); if (!sp) return null;
    var friend = !!FR[id], t = tier || (friend ? 1 : 2), out = [];
    for (var y = 0; y < sp.h; y++) {
      out.push([]);
      for (var x = 0; x < sp.w; x++) {
        var ch = sp.c[y][x];
        if (ch === '.') { out[y].push(null); continue; }
        var col = sp.pal[ch] || PAL[ch] || '#ff00ff';
        if (friend && ch === 'q') col = t >= 2 ? sp.cheek : sp.pal.q;
        var edge = ch === '#', topEdge = edge && (y === 0 || sp.c[y - 1][x] === '.'), leftEdge = edge && (x === 0 || sp.c[y][x - 1] === '.');
        if (!friend && t === 1) {
          col = edge ? '#4b4038' : mix(gray(col, 0.55), '#6b5a48', 0.18);
          if (!edge && ch !== 'k' && hash(x, y) < 9) col = mix(col, '#3b3028', 0.32);
        }
        if (t >= 3 && edge) col = t === 3 ? (topEdge || leftEdge ? '#f8c632' : '#8a5a12') : (topEdge || leftEdge ? '#fff0a0' : '#d99a14');
        if (t >= 4 && !edge && ch !== 'k' && ch !== 'e') col = mix(col, '#ffffff', 0.1);
        out[y].push(col);
      }
    }
    return out;
  }
  var SCALE = 8;
  function toURL(grid, w, h, scale) {
    if (typeof document === 'undefined') return '';
    var cv = document.createElement('canvas');
    cv.width = w * scale; cv.height = h * scale;
    var ctx = cv.getContext('2d');
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var c = grid[y][x]; if (c) { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); } }
    return cv.toDataURL('image/png');
  }
  function url(id, tier) {
    var key = id + ':' + (tier || 0);
    if (cache[key]) return cache[key];
    var sp = sprite(id); if (!sp) return '';
    return (cache[key] = toURL(colors(id, tier), sp.w, sp.h, SCALE));
  }
  function sceneURL(id) {
    var key = 'scene:' + id;
    if (!cache[key]) cache[key] = toURL(buildScene(id), 30, 30, 10);
    return cache[key];
  }
  function bgURL() {
    if (!cache.bg) { var b = buildBg(); cache.bg = toURL(b.px, b.w, b.h, 6); }
    return cache.bg;
  }
  function dims(id) { var sp = sprite(id); return sp ? { w: sp.w, h: sp.h } : null; }

  root.Pixel = {
    url: url, dims: dims, sceneURL: sceneURL, bgURL: bgURL, colors: colors, buildScene: buildScene, buildBg: buildBg,
    ids: { friends: Object.keys(FR), furni: Object.keys(FU) }, SCALE: SCALE
  };
})(typeof window !== 'undefined' ? window : globalThis);
