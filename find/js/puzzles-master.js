/*
 * 한칸 찾기 · puzzles-master.js — 마스터: 세 규칙을 한 판에 섞기 (v0.12, 모든 스토어 공통)
 *
 * 방법: 규칙 B로 후보가 3~4개인 판을 만들고(후보 CB), 정답 T와 다른 후보 O1·O2를 고른다.
 *   규칙 A 단서: T·O1은 후보에 넣고 나머지 CB는 뺀다.
 *   규칙 C 단서: T·O2는 후보에 넣고 나머지 CB는 뺀다.
 *   → 세 규칙을 모두 지키는 칸은 T 하나. 두 규칙만 보면 후보가 2개 이상(세 규칙이 모두 필요).
 * 만든 뒤 verify()가 화면에 보이는 정보만으로 세 규칙의 후보를 처음부터 다시 계산해 확인한다.
 * 한 판에 둘 수 없는 조합(짝 없는 칸+틀린 숫자 · 줄 숫자+거울 칸 등)은 TRIPLES 목록에 넣지 않는다.
 */
(function (root) {
  'use strict';
  var Z = root.Puzzles, H = Z._h, C = Z._combo;
  var pick = H.pick, shuffled = H.shuffled, range = H.range, nb4 = H.nb4, dirNb = H.dirNb, manh = H.manh;
  function has(a, x) { return a.indexOf(x) >= 0; }
  function colorOf(pz, i) { var t = pz.tiles[i]; return t && t.kind === 'color' ? t.color : null; }
  function inter(a, b) { return a.filter(function (x) { return has(b, x); }); }

  // 덧입힐 수 있는 규칙(단서를 판 위에 얹음)과 판을 만들어야 하는 규칙
  var CAN_FILTER = { dist: 1, arrow: 1, twin: 1, count: 1, lonely: 1, rule: 1 };

  // ---------- 독립 검증: 보이는 정보만으로 규칙별 후보 ----------
  // 판단할 수 없는 칸(빈칸 이웃 등)이 있으면 null → 그 판은 버린다
  function candVisible(rule, pz) {
    var n = pz.n, N = n * n, dom = range(N).filter(function (i) { return pz.tiles[i].tap; });
    var col = function (i) { return colorOf(pz, i); };
    var blankAt = function (i) { var t = pz.tiles[i]; return t.kind === 'blank'; };
    switch (rule) {
      case 'dist': {
        var mk = [];
        pz.tiles.forEach(function (t, i) { if (t.dmark != null) mk.push([i, t.dmark]); else if (t.dist && t.marker != null) mk.push([i, t.marker]); });
        if (!mk.length) return null;
        return dom.filter(function (c) { return mk.every(function (m) { return c !== m[0] && manh(c, m[0], n) === m[1]; }); });
      }
      case 'arrow': {
        var D = { up: -n, down: n, left: -1, right: 1 }, deg = range(N).map(function () { return 0; }), bad = false;
        pz.tiles.forEach(function (t, i) {
          if (!t.dir) { bad = true; return; }
          var j = i + D[t.dir], r = Math.floor(i / n), c = i % n;
          if (j < 0 || j >= N || (t.dir === 'left' && c === 0) || (t.dir === 'right' && c === n - 1)) { bad = true; return; }
          deg[j]++;
        });
        if (bad) return null;
        return dom.filter(function (i) { return deg[i] === 0; });
      }
      case 'twin': {
        var cnt = {};
        pz.tiles.forEach(function (t) { if (t.kind === 'color' && t.num != null) { var k = t.color + t.num; cnt[k] = (cnt[k] || 0) + 1; } });
        return dom.filter(function (i) { var t = pz.tiles[i]; return t.kind === 'color' && t.num != null && cnt[t.color + t.num] === 1; });
      }
      case 'count': {
        var amb = false;
        var out = dom.filter(function (i) {
          var t = pz.tiles[i]; if (t.kind !== 'color' || t.num == null) return false;
          var nb = nb4(i, n);
          if (nb.some(function (j) { return !col(j); })) { amb = true; return false; }
          return nb.filter(function (j) { return col(j) !== t.color; }).length !== t.num;
        });
        return amb ? null : out;
      }
      case 'lonely': {
        var X = pz.lonelyX; if (!X) return null;
        var amb2 = false;
        var o2 = dom.filter(function (i) {
          if (col(i) !== X) return false;
          var nb = nb4(i, n);
          if (nb.some(function (j) { return col(j) === X; })) return false;
          if (nb.some(blankAt)) { amb2 = true; return false; }
          return true;
        });
        return amb2 ? null : o2;
      }
      case 'rule': {
        var R = pz.cr2 || pz.cr; if (!R) return null;
        var amb3 = false;
        var o3 = dom.filter(function (i) {
          if (col(i) !== R.x) return false;
          var nb = dirNb(i, n, R.dirs);
          if (nb.some(function (j) { return col(j) && col(j) !== R.y; })) return true;
          if (nb.some(blankAt)) { amb3 = true; return false; }
          return false;
        });
        return amb3 ? null : o3;
      }
      case 'mirror': {
        if (!pz.mirror) return null;
        var horiz = pz.mirror === 'h';
        var mo = function (i) { var r = Math.floor(i / n), c = i % n; return horiz ? (n - 1 - r) * n + c : r * n + (n - 1 - c); };
        return dom.filter(function (i) { return !pz.tiles[i].ref && col(i) !== col(mo(i)); });
      }
      case 'lines': {
        var e = pz.edges; if (!e) return null;
        var X2 = e.color, blanks = range(N).filter(blankAt);
        if (blanks.length > 16) return null;
        var baseR = range(n).map(function (r) { return range(n).filter(function (c) { return col(r * n + c) === X2; }).length; });
        var baseC = range(n).map(function (c) { return range(n).filter(function (r) { return col(r * n + c) === X2; }).length; });
        var sols = [];
        for (var m = 0; m < (1 << blanks.length) && sols.length < 2; m++) {
          var Rr = baseR.slice(), Cc = baseC.slice();
          for (var b = 0; b < blanks.length; b++) if (m & (1 << b)) { Rr[Math.floor(blanks[b] / n)]++; Cc[blanks[b] % n]++; }
          var ok = true;
          for (var q = 0; q < n && ok; q++) if (Rr[q] !== e.left[q] || Cc[q] !== e.top[q]) ok = false;
          if (ok) sols.push(m);
        }
        if (sols.length !== 1) return null;
        return blanks.filter(function (x, b) { return sols[0] & (1 << b); }).filter(function (i) { return has(dom, i); });
      }
    }
    return null;
  }
  // 세 규칙 판 확인: 모두 지키는 칸이 정답 하나 + (strict면) 어느 한 규칙을 빼도 후보가 2개 이상
  function verify(pz, strict) {
    var sets = pz.rules.map(function (r) { return candVisible(r, pz); });
    if (sets.some(function (s) { return !s; })) return false;
    var all = inter(inter(sets[0], sets[1]), sets[2]);
    if (all.length !== 1 || all[0] !== pz.answer) return false;
    if (strict) {
      if (inter(sets[0], sets[1]).length < 2 || inter(sets[0], sets[2]).length < 2 || inter(sets[1], sets[2]).length < 2) return false;
    }
    return true;
  }

  // ---------- 만들기 ----------
  function tryOnce(base, fa, fc, lv, n, strict) {
    var gen = Z._multi[base]; if (!gen) return null;
    var pz = gen(lv, n, Math.random() < 0.5 ? 3 : 4);
    if (!pz || pz.rule !== base || !pz.answers || pz.answers.length < 3) return null;
    var CB = pz.answers.slice();
    if (base === 'lonely') pz.lonelyX = colorOf(pz, CB[0]);
    var dom = range(n * n).filter(function (i) { return pz.tiles[i].tap; });
    var order = shuffled(CB), pz0 = JSON.stringify(pz);
    for (var k = 0; k < order.length; k++) {
      pz = JSON.parse(pz0);
      var T = order[k], rest = shuffled(CB.filter(function (x) { return x !== T; }));
      var O1 = rest[0], O2 = rest[1];
      var ex1 = CB.filter(function (x) { return x !== T && x !== O1; }), ex2 = CB.filter(function (x) { return x !== T && x !== O2; });
      // 세 규칙이 모두 필요하게: 판 규칙 후보가 아닌 칸 E를 두 단서의 후보에 함께 넣는다
      // (첫 단서 후보에 이미 그런 칸이 있으면 그 칸, 없으면 미리 골라 두 단서 모두에 넣음)
      var preE = strict && Math.random() < 0.5 ? shuffled(dom.filter(function (x) { return !has(CB, x); }))[0] : null;
      var f1 = C.FILTER[fa](pz, T, ex1, dom, preE != null ? [O1, preE] : [O1]); if (!f1) continue;
      C.applyFilter(pz, fa, f1);
      var need2 = [O2];
      if (strict) {
        var C1 = candVisible(fa, pz) || [];
        var E = preE != null ? preE : shuffled(C1.filter(function (x) { return !has(CB, x); }))[0];
        if (E == null || !has(C1, E)) continue;
        need2.push(E);
      }
      var f2 = C.FILTER[fc](pz, T, ex2, dom, need2); if (!f2) continue;
      C.applyFilter(pz, fc, f2);
      var p1 = C.partOf(fa, pz, f1), p2 = C.partOf(fc, pz, f2), pb = C.partOf(base, pz, null);
      pz.rules = [base, fa, fc];
      pz.answer = T; pz.answers = null; pz.multi = false;
      if (!verify(pz, strict)) continue;
      pz.combo = 'one3'; pz.rule = base;
      pz.clue = {
        title: ['세 규칙을 모두 지키는 한 칸'],
        steps: [{ rl: base, parts: pb }, { rl: fa, parts: p1 }, { rl: fc, parts: p2 }],
        hint: ''
      };
      return pz;
    }
    return null;
  }
  // 세 규칙 중 판을 만들 규칙과 얹을 규칙 두 개를 정하는 방법들
  function arrangements(tr) {
    var o = [];
    tr.forEach(function (b) {
      var f = tr.filter(function (x) { return x !== b; });
      if (!CAN_FILTER[f[0]] || !CAN_FILTER[f[1]]) return;
      o.push([b, f[0], f[1]], [b, f[1], f[0]]);
    });
    return o;
  }
  function makeTriple(tr, lv, n, tries, strict) {
    var arr = arrangements(tr); if (!arr.length) return null;
    tries = tries || 120;
    for (var t = 0; t < tries; t++) {
      var a = arr[t % arr.length];
      var pz = tryOnce(a[0], a[1], a[2], lv, n, strict);
      if (pz) return pz;
    }
    return null;
  }

  // 한 판에 섞을 수 있는 세 규칙 조합 (56개 중 30개)
  // 빠지는 것: 줄 숫자(빈칸 정답이라 색·숫자 규칙을 못 얹음, 보물+화살표만 됨) · 짝 없는 칸+틀린 숫자(둘 다 칸 숫자)
  //           · 외톨이+거울+규칙 어긴 칸(거의 만들어지지 않음)
  var ORDER = ['twin', 'lines', 'lonely', 'count', 'mirror', 'rule', 'dist', 'arrow'];
  function key(tr) { return tr.slice().sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).join('+'); }
  var TRIPLES = [];
  for (var a = 0; a < 8; a++) for (var b = a + 1; b < 8; b++) for (var c = b + 1; c < 8; c++) {
    var tr = [ORDER[a], ORDER[b], ORDER[c]];
    if (has(tr, 'lines') && key(tr) !== 'lines+dist+arrow') continue;
    if (has(tr, 'twin') && has(tr, 'count')) continue;
    if (key(tr) === 'lonely+mirror+rule') continue;
    TRIPLES.push(key(tr));
  }
  // 거의 실패하지 않지만, 혹시 못 만들면 시도를 늘려 다시
  function makeTripleSafe(tr, lv, n) {
    var pz = makeTriple(tr, lv, n, 900, true); // 세 규칙이 모두 필요한 판
    for (var t = 0; !pz && t < 6; t++) pz = makeTriple(tr, lv, n, 200, false); // 아주 드물게: 정답 하나만 보장
    return pz;
  }
  Z.makeTriple = makeTripleSafe;
  Z.TRIPLES = TRIPLES;
  Z.tripleKey = key;
  Z._master = { verify: verify, candVisible: candVisible, arrangements: arrangements, tryOnce: tryOnce, makeTriple: makeTriple };
})(typeof window !== 'undefined' ? window : globalThis);
