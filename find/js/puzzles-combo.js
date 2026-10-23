/*
 * 한칸 찾기 · puzzles-combo.js — 익스퍼트: 두 규칙을 한 판에 섞기 (v0.7, 모든 스토어 공통)
 *
 * 방법: 규칙 B로 '정답 후보가 여러 개'인 판을 만들고(answers = 후보 B),
 *       그 위에 규칙 A의 단서를 덧입힌다(숫자·화살표·거리 숫자는 판을 바꾸지 않고 얹을 수 있음).
 *  - 'one'  : 두 규칙을 모두 만족하는 칸이 딱 하나 → 한 칸 찾기
 *  - 'union': 한 칸으로 겹치기 어려운 조합 → 같은 판에서 두 규칙의 칸을 모두(각 2칸 이상) 골라 확정
 *  - 'split': 같은 판에 둘 수 없는 조합(줄 숫자+거울, 짝 없는 칸+틀린 숫자) → 두 판을 이어서, 판마다 2칸 이상
 * 만든 뒤 각 규칙의 후보를 다시 계산해서 정답이 맞는지 확인한다.
 */
(function (root) {
  'use strict';
  var Z = root.Puzzles, H = Z._h;
  var ri = H.ri, pick = H.pick, shuffled = H.shuffled, range = H.range, nb4 = H.nb4, dirNb = H.dirNb, manh = H.manh;
  function has(a, x) { return a.indexOf(x) >= 0; }
  function colorOf(pz, i) { var t = pz.tiles[i]; return t && t.kind === 'color' ? t.color : null; }

  // 어떤 방식으로 섞을지
  var NUM = ['twin', 'count'];
  function plan(a, b) {
    if (a === 'dist' || b === 'dist') return { mode: 'one', filter: 'dist', base: a === 'dist' ? b : a };
    if (a === 'arrow' || b === 'arrow') return { mode: 'one', filter: 'arrow', base: a === 'arrow' ? b : a };
    if (has(NUM, a) && has(NUM, b)) return { mode: 'split' };
    if (a === 'lines' || b === 'lines') {
      var o = a === 'lines' ? b : a;
      return o === 'mirror' ? { mode: 'split' } : { mode: 'union', base: 'lines', filter: o };
    }
    if (has(NUM, a) || has(NUM, b)) return { mode: 'one', filter: has(NUM, a) ? a : b, base: has(NUM, a) ? b : a };
    if (a === 'mirror' || b === 'mirror') return { mode: 'one', base: 'mirror', filter: a === 'mirror' ? b : a };
    return { mode: 'union', base: 'rule', filter: 'lonely' }; // 외톨이 + 규칙 어긴 칸
  }

  // ---------- 규칙별 후보 계산 (확인용) ----------
  function candDist(pz, dom) {
    var mk = [];
    pz.tiles.forEach(function (t, i) { if (t.dmark != null) mk.push([i, t.dmark]); });
    return dom.filter(function (c) { return mk.every(function (m) { return c !== m[0] && manh(c, m[0], pz.n) === m[1]; }); });
  }
  function candArrow(pz, dom) {
    var n = pz.n, D = { up: -n, down: n, left: -1, right: 1 }, deg = range(n * n).map(function () { return 0; });
    pz.tiles.forEach(function (t, i) { if (t.dir) deg[i + D[t.dir]]++; });
    return dom.filter(function (i) { return deg[i] === 0; });
  }
  function candTwin(pz, dom) {
    var cnt = {};
    pz.tiles.forEach(function (t) { if (t.kind === 'color' && t.num != null) { var k = t.color + t.num; cnt[k] = (cnt[k] || 0) + 1; } });
    return dom.filter(function (i) { var t = pz.tiles[i]; return t.kind === 'color' && t.num != null && cnt[t.color + t.num] === 1; });
  }
  function candCount(pz, dom) {
    return dom.filter(function (i) {
      var t = pz.tiles[i]; if (t.kind !== 'color' || t.num == null) return false;
      return nb4(i, pz.n).filter(function (j) { return colorOf(pz, j) !== t.color; }).length !== t.num;
    });
  }
  function candLonely(pz, dom, X) {
    return dom.filter(function (i) { return colorOf(pz, i) === X && nb4(i, pz.n).every(function (j) { return colorOf(pz, j) !== X; }); });
  }
  function candRule(pz, dom, R) {
    return dom.filter(function (i) { return colorOf(pz, i) === R.x && dirNb(i, pz.n, R.dirs).some(function (j) { return colorOf(pz, j) !== R.y; }); });
  }

  // ---------- 덧입히는 단서 (T: 정답으로 만들 칸, 없으면 union용) ----------
  // 각 함수는 { apply(pz), title, info } 또는 null
  // v0.12: need = 정답 칸 말고도 꼭 후보에 들어가야 하는 칸(마스터 세 규칙 섞기용)
  function fDist(pz, T, others, dom, need) {
    var n = pz.n; need = need || [];
    function ok(CA) { return CA.length >= 2 && has(CA, T) && need.every(function (x) { return has(CA, x); }) && !others.some(function (o) { return has(CA, o); }); }
    for (var t = 0; t < 300; t++) {
      var M = ri(0, n * n - 1); if (M === T) continue;
      var d = manh(M, T, n); if (d < 2) continue;
      var CA = dom.filter(function (c) { return c !== M && manh(c, M, n) === d; });
      if (ok(CA)) return { marks: [[M, d]] };
    }
    for (t = 0; t < 600; t++) {
      var A = ri(0, n * n - 1), B = ri(0, n * n - 1); if (A === T || B === T || A === B) continue;
      var da = manh(A, T, n), db = manh(B, T, n); if (da < 2 || db < 2) continue;
      var C2 = dom.filter(function (c) { return c !== A && c !== B && manh(c, A, n) === da && manh(c, B, n) === db; });
      if (ok(C2)) return { marks: [[A, da], [B, db]] };
    }
    return null;
  }
  function fArrow(pz, T, others, dom, need) {
    var n = pz.n; need = need || [];
    for (var tries = 0; tries < 60; tries++) {
      var to = H.tileDominoes(n); if (!to) continue;
      var hole = to.indexOf(-1); if (hole >= 0) to[hole] = pick(nb4(hole, n));
      var extra = need.length ? null : shuffled(dom.filter(function (i) { return i !== T && !has(others, i); }))[0];
      if (!need.length && extra == null) return null;
      var want = need.length ? [T].concat(need) : [T, extra], fail = false;
      want.forEach(function (w) {
        range(n * n).forEach(function (p) {
          if (to[p] !== w) return;
          var alt = nb4(p, n).filter(function (x) { return x !== w && !has(want, x); });
          if (!alt.length) { fail = true; return; }
          to[p] = pick(alt);
        });
      });
      if (fail) continue;
      var tmp = { n: n, tiles: to.map(function (t, i) { return { dir: t === i - n ? 'up' : t === i + n ? 'down' : t === i - 1 ? 'left' : 'right' }; }) };
      var CA = candArrow(tmp, dom);
      if (CA.length >= 2 && has(CA, T) && need.every(function (x) { return has(CA, x); }) && !others.some(function (o) { return has(CA, o); })) return { dirs: tmp.tiles.map(function (t) { return t.dir; }) };
    }
    return null;
  }
  function fTwin(pz, T, others, dom, need) {
    need = need || [];
    if (need.some(function (x) { return !colorOf(pz, x); })) return null;
    var colored = range(pz.n * pz.n).filter(function (i) { return colorOf(pz, i); });
    if (T != null && !colorOf(pz, T)) return null;
    var free = shuffled(dom.filter(function (i) { return colorOf(pz, i) && i !== T && !has(others, i) && !has(need, i); }));
    var singles = (T != null ? [T] : []).concat(need);
    while (singles.length < 2 && free.length) singles.push(free.shift());
    if (singles.length < 2) return null;
    var nums = {}, ok = true;
    ['g', 'r', 'b', 'y'].forEach(function (c) {
      var G = colored.filter(function (i) { return colorOf(pz, i) === c; });
      var S = G.filter(function (i) { return has(singles, i); }), R = shuffled(G.filter(function (i) { return !has(singles, i); }));
      if (R.length % 2) {
        var k = R.findIndex(function (i) { return !has(others, i) && has(dom, i); });
        if (k < 0) k = R.findIndex(function (i) { return !has(others, i); });
        if (k < 0) { ok = false; return; }
        S.push(R.splice(k, 1)[0]); singles.push(S[S.length - 1]);
      }
      var ids = shuffled(range(R.length / 2 + S.length).map(function (x) { return x + 1; })), q = 0;
      for (var p = 0; p < R.length; p += 2) { nums[R[p]] = nums[R[p + 1]] = ids[q++]; }
      S.forEach(function (i) { nums[i] = ids[q++]; });
    });
    if (!ok) return null;
    return { nums: nums };
  }
  // v0.9.1: 숫자 칸 상하좌우에 빈칸·빈자리가 있으면 '색이 다른 칸'인지 알 수 없다 → 모두 색 칸인 곳에만 숫자
  function allColoredNb(pz, i) { return nb4(i, pz.n).every(function (j) { return colorOf(pz, j); }); }
  function fCount(pz, T, others, dom, need) {
    need = need || [];
    if (T != null && (!colorOf(pz, T) || !allColoredNb(pz, T))) return null;
    if (need.some(function (x) { return !colorOf(pz, x) || !allColoredNb(pz, x); })) return null;
    dom = dom.filter(function (i) { return allColoredNb(pz, i); });
    var free = shuffled(dom.filter(function (i) { return colorOf(pz, i) && i !== T && !has(others, i) && !has(need, i); }));
    var W = (T != null ? [T] : []).concat(need);
    while (W.length < 2 && free.length) W.push(free.shift());
    if (W.length < 2) return null;
    var nums = {}, n = pz.n;
    var numbered = W.concat(shuffled(dom.filter(function (i) { return colorOf(pz, i) && !has(W, i); })).slice(0, Math.max(3, Math.round(dom.length * 0.35))));
    numbered.forEach(function (i) {
      var v = nb4(i, n).filter(function (j) { return colorOf(pz, j) !== colorOf(pz, i); }).length;
      if (has(W, i)) { var max = nb4(i, n).length; v = v === 0 ? 1 : v === max ? v - 1 : v + pick([-1, 1]); }
      nums[i] = v;
    });
    return { nums: nums };
  }
  function fLonely(pz, T, others, dom, need) {
    need = need || [];
    var cols = T != null ? [colorOf(pz, T)] : shuffled(['g', 'r', 'b', 'y']);
    var LX = pz.edges ? pz.edges.color : null, n = pz.n;
    for (var k = 0; k < cols.length; k++) {
      var X = cols[k]; if (!X) return null;
      if (pz.cr && T == null && X === pz.cr.x) continue; // union: 규칙 어긴 칸과 다른 색으로
      var colors = null;
      if (LX) {
        // v0.9.1: 줄 숫자 판 — 빈칸 색은 알 수 없다. 줄 숫자 색은 쓰지 않고,
        // 색 칸 X 이웃이 없는데 빈칸 옆인 X칸(외톨이인지 알 수 없음)은 다른 색으로 바꾼다
        if (X === LX) continue;
        var spare = shuffled(['g', 'r', 'b', 'y'].filter(function (c) { return c !== X && c !== LX; }))[0];
        colors = {};
        range(n * n).forEach(function (i) {
          if (colorOf(pz, i) !== X) return;
          var nb = nb4(i, n);
          if (nb.some(function (j) { return colorOf(pz, j) === X; })) return;
          if (nb.some(function (j) { return !colorOf(pz, j); })) colors[i] = spare;
        });
        if (Object.keys(colors).some(function (i) { return has(others, +i) || +i === T; })) continue;
        var saved = {};
        Object.keys(colors).forEach(function (i) { saved[i] = pz.tiles[+i].color; pz.tiles[+i].color = colors[i]; });
        var CL = candLonely(pz, dom, X);
        Object.keys(saved).forEach(function (i) { pz.tiles[+i].color = saved[i]; });
        var CA = CL;
      } else var CA = candLonely(pz, dom, X);
      if (T != null ? (CA.length >= 2 && has(CA, T) && need.every(function (x) { return has(CA, x); }) && !others.some(function (o) { return has(CA, o); })) : (CA.length >= 2 && CA.length <= 4 && !others.some(function (o) { return has(CA, o); })))
        return colors ? { X: X, colors: colors } : { X: X };
    }
    return null;
  }
  function fRule(pz, T, others, dom, need) {
    need = need || [];
    if (T == null) return fRuleOnLines(pz, dom);
    var X = colorOf(pz, T); if (!X) return null;
    var Rs = shuffled(H.COLOR_RULES.filter(function (R) { return R.x === X; }));
    for (var k = 0; k < Rs.length; k++) {
      var CA = candRule(pz, dom, Rs[k]);
      if (CA.length >= 2 && has(CA, T) && need.every(function (x) { return has(CA, x); }) && !others.some(function (o) { return has(CA, o); })) return { R: Rs[k] };
    }
    return null;
  }
  // 줄 숫자 판 위에 '규칙 어긴 칸' 얹기: 줄 숫자 색(LX)은 건드리지 않고 다른 색만 바꿔 위반 칸을 2~4개로 맞춘다
  function fRuleOnLines(pz, dom) {
    var LX = pz.edges ? pz.edges.color : null, n = pz.n;
    var Rs = shuffled(H.COLOR_RULES.filter(function (R) { return R.x !== LX && R.y !== LX; }));
    for (var k = 0; k < Rs.length; k++) {
      var R = Rs[k], col = pz.tiles.map(function (t, i) { return colorOf(pz, i); });
      var spare = ['g', 'r', 'b', 'y'].filter(function (c) { return c !== LX && c !== R.x && c !== R.y; })[0];
      range(n * n).forEach(function (i) {
        if (col[i] !== R.x || Math.random() < 0.25) return;
        var nb = dirNb(i, n, R.dirs);
        if (nb.every(function (j) { return col[j] && col[j] !== LX; })) nb.forEach(function (j) { col[j] = R.y; });
      });
      // v0.9.1: 위·아래(또는 양옆)에 빈칸이 있는 X칸은 빈칸 색을 몰라 판단할 수 없다 → 다른 색으로
      range(n * n).forEach(function (i) {
        if (col[i] === R.x && dirNb(i, n, R.dirs).some(function (j) { return !col[j]; })) col[i] = spare;
      });
      function viol() { return range(n * n).filter(function (i) { return col[i] === R.x && dirNb(i, n, R.dirs).some(function (j) { return col[j] !== R.y; }); }); }
      var v = viol(), guard = 0;
      while (v.length > 4 && guard++ < 200) { col[pick(v)] = spare; v = viol(); }
      if (v.length < 2 || v.length > 4) continue;
      var colors = {};
      col.forEach(function (c, i) { if (c && c !== colorOf(pz, i)) colors[i] = c; });
      return { R: R, colors: colors };
    }
    return null;
  }
  function fMirrorNone() { return null; }
  var FILTER = { dist: fDist, arrow: fArrow, twin: fTwin, count: fCount, lonely: fLonely, rule: fRule, mirror: fMirrorNone };

  // 덧입히기 + 단서 문구
  var WHERE = { ud: ' 위·아래는 ', lr: ' 왼쪽·오른쪽은 ' };
  function applyFilter(pz, rule, f) {
    if (f.colors) Object.keys(f.colors).forEach(function (i) { pz.tiles[+i].color = f.colors[i]; });
    if (f.marks) f.marks.forEach(function (m) { pz.tiles[m[0]].dmark = m[1]; });
    if (f.dirs) f.dirs.forEach(function (d, i) { pz.tiles[i].dir = d; });
    if (f.nums) Object.keys(f.nums).forEach(function (i) { pz.tiles[+i].num = f.nums[i]; });
    if (f.X) pz.lonelyX = f.X;
    if (f.R) pz.cr2 = f.R;
  }
  function partOf(rule, pz, f) {
    switch (rule) {
      case 'dist': return ['거리 숫자에 맞는 칸'];
      case 'arrow': return ['아무 화살표도 가리키지 않는 칸'];
      case 'twin': return ['짝이 없는 칸'];
      case 'count': return ['숫자가 틀린 칸'];
      case 'lonely': return ['외톨이 ', { c: f ? f.X : pz.lonelyX }, ' 칸'];
      case 'mirror': return ['거울 모습과 다른 칸'];
      case 'rule': var R = f && f.R ? f.R : pz.cr; return ['규칙을 어긴 ', { c: R.x }, ' 칸 · ', { c: R.x }, WHERE[R.dirs], { c: R.y }];
      case 'lines': return ['빈칸 중 ', { c: pz.edges.color }, '이 들어갈 칸'];
    }
    return [];
  }

  // 확인: 두 규칙의 후보를 처음부터 다시 계산
  function candOf(rule, pz, dom, f) {
    switch (rule) {
      case 'dist': return candDist(pz, dom);
      case 'arrow': return candArrow(pz, dom);
      case 'twin': return candTwin(pz, dom);
      case 'count': return candCount(pz, dom);
      case 'lonely': return candLonely(pz, dom, pz.lonelyX);
      case 'rule': return candRule(pz, dom, f && f.R ? f.R : pz.cr);
    }
    return null;
  }

  function makeCombo(a, b, lv, n) {
    var P = plan(a, b);
    if (P.mode === 'split') return null;
    for (var tries = 0; tries < 40; tries++) {
      var base = Z.makeMulti(P.base, lv, n, P.mode === 'one' ? ri(2, 3) : 2);
      if (!base || base.rule !== P.base) continue;
      var CB = base.answers.slice();
      if (P.base === 'lonely') base.lonelyX = colorOf(base, CB[0]);
      var basePart = partOf(P.base, base, null);
      var dom = range(n * n).filter(function (i) { return base.tiles[i].tap; });
      if (P.mode === 'one') {
        var order = shuffled(CB), f = null, T = null;
        for (var k = 0; k < order.length && !f; k++) { T = order[k]; f = FILTER[P.filter](base, T, CB.filter(function (x) { return x !== T; }), dom); }
        if (!f) continue;
        applyFilter(base, P.filter, f);
        var CA = candOf(P.filter, base, dom, f);
        var both = CA.filter(function (x) { return has(CB, x); });
        if (both.length !== 1 || both[0] !== T || CA.length < 2) continue;
        base.answer = T; base.answers = null; base.multi = false;
        base.title2 = [partOf(P.filter, base, f), basePart];
      } else {
        // union: 같은 판에서 두 규칙 칸 모두 (줄 숫자 판이면 색 칸도 누를 수 있게)
        var dom2 = range(n * n).filter(function (i) { return base.tiles[i].kind !== 'void'; });
        var fd = dom2.filter(function (i) { return colorOf(base, i); });
        var fu = FILTER[P.filter](base, null, CB, fd);
        if (!fu) continue;
        applyFilter(base, P.filter, fu);
        var CU = candOf(P.filter, base, fd, fu);
        if (!CU || CU.length < 2 || CU.some(function (x) { return has(CB, x); })) continue;
        dom2.forEach(function (i) { base.tiles[i].tap = true; base.tiles[i].ref = false; });
        // 줄 숫자 판의 색 칸도 누를 수 있게 했으니, 줄 숫자 후보는 여전히 빈칸만
        base.answers = CB.concat(CU); base.multi = true; base.answer = -1;
        base.title2 = [basePart, partOf(P.filter, base, fu)];
      }
      base.combo = P.mode;
      base.rules = [P.base, P.filter];
      base.rule = P.base;
      base.clue = {
        title: [P.mode === 'one' ? '두 규칙을 모두 지키는 한 칸' : '두 규칙에 맞는 칸 모두'],
        steps: [{ rl: P.base, parts: base.title2[P.mode === 'one' ? 1 : 0] }, { rl: P.filter, parts: base.title2[P.mode === 'one' ? 0 : 1] }],
        hint: ''
      };
      return base;
    }
    return null;
  }
  Z.comboPlan = plan;
  Z.makeCombo = makeCombo;
  Z._combo = { FILTER: FILTER, applyFilter: applyFilter, partOf: partOf, colorOf: colorOf, candOf: candOf, candDist: candDist, candArrow: candArrow, candTwin: candTwin, candCount: candCount, candLonely: candLonely, candRule: candRule };
})(typeof window !== 'undefined' ? window : globalThis);
