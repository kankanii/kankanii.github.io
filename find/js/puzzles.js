/*
 * 한칸 찾기 · puzzles.js — 문제 만들기 (화면과 상관없는 순수 로직, 모든 스토어 공통)
 *
 * 규칙 8가지 (모두 정답이 하나뿐인지 만들 때 보장)
 *  dist   : 보물 찾기    — 숫자(보물까지 걸어가는 칸 수)를 모두 만족하는 칸 (v0.7 첫 규칙)
 *  path   : 길 찾기(v0.7부터 안 씀)      — 번호 칸에서 출발해 위·아래·왼쪽·오른쪽으로 움직여 도착하는 칸
 *  lines  : 줄 숫자      — 바깥 숫자(그 줄의 X색 개수)를 보고 X색이 들어갈 빈칸
 *  count  : 틀린 숫자    — 숫자 = 상하좌우 중 색이 다른 칸 수. 하나만 틀림
 *  rule   : 규칙 어긴 칸 — "X 위·아래는 Y" 같은 규칙을 어긴 X칸
 *  twin   : 짝 없는 칸   — 색+숫자 짝이 없는 칸 (v0.4)
 *  lonely : 외톨이 칸    — 상하좌우에 같은 색이 없는 X칸 (v0.4)
 *  mirror : 거울 칸      — 거울 건너편과 다른 칸 (v0.4)
 *  arrow  : 화살표 칸    — 아무 화살표도 가리키지 않는 칸 (v0.4)
 */
(function (root) {
  'use strict';
  var CID = ['g', 'r', 'b', 'y'];
  var CNAME = { g: '초록', r: '빨강', b: '파랑', y: '노랑' };

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffled(a) {
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function range(k) { var o = []; for (var i = 0; i < k; i++) o.push(i); return o; }
  function nb4(i, n) {
    var r = Math.floor(i / n), c = i % n, o = [];
    if (r > 0) o.push(i - n);
    if (r < n - 1) o.push(i + n);
    if (c > 0) o.push(i - 1);
    if (c < n - 1) o.push(i + 1);
    return o;
  }
  function randFill(n, pool) {
    pool = pool || CID;
    return range(n * n).map(function () { return pick(pool); });
  }

  // ---------- 길 찾기 ----------
  function ringOf(r, c, n) { return Math.min(r, c, n - 1 - r, n - 1 - c); }
  function ringPath(k, n) { // 둘레 k의 칸들, 시계 방향
    var a = k, b = n - 1 - k, o = [], r, c;
    if (a === b) return [[a, a]];
    for (c = a; c < b; c++) o.push([a, c]);
    for (r = a; r < b; r++) o.push([r, b]);
    for (c = b; c > a; c--) o.push([b, c]);
    for (r = b; r > a; r--) o.push([r, a]);
    return o;
  }
  var DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  // v0.5: 시계·반시계(둘레 돌기)를 없애고 위·아래·왼쪽·오른쪽 곧은 이동만 쓴다.
  // 매 이동은 방향을 꺾는다(같은 방향·되돌아가기 없음). trail = 이동마다 지나가는 칸(튜토리얼용)
  function genPath(lv, n) {
    var nSteps = lv < 4 ? 2 : lv < 9 ? 3 : 4;
    var mCount = Math.min(4, 2 + Math.floor(lv / 6));
    var maxL = lv < 4 ? 2 : lv < 9 ? 3 : n - 1;
    var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
    for (var tries = 0; tries < 400; tries++) {
      var marks = shuffled(range(n * n)).slice(0, mCount);
      var startNo = ri(1, mCount), start = marks[startNo - 1], cur = start, ok = true, last = null;
      var steps = [{ mk: startNo }], trail = [];
      for (var s = 0; s < nSteps; s++) {
        var r = Math.floor(cur / n), c = cur % n;
        var opts = Object.keys(DIRS).filter(function (k) { return k !== last && k !== OPP[last]; }).map(function (k) {
          var d = DIRS[k], m = 0;
          while (r + d[0] * (m + 1) >= 0 && r + d[0] * (m + 1) < n && c + d[1] * (m + 1) >= 0 && c + d[1] * (m + 1) < n) m++;
          return { k: k, d: d, max: m };
        }).filter(function (o) { return o.max >= 1; });
        if (!opts.length) { ok = false; break; }
        var dd = pick(opts), L = ri(1, Math.min(dd.max, maxL)), seg = [];
        for (var q = 1; q <= L; q++) seg.push((r + dd.d[0] * q) * n + (c + dd.d[1] * q));
        cur = seg[seg.length - 1];
        steps.push({ line: dd.k, v: L }); trail.push(seg); last = dd.k;
      }
      if (!ok || cur === start || marks.indexOf(cur) >= 0) continue;
      var tiles = range(n * n).map(function (i) {
        var t = { kind: 'plain', tap: true };
        var m = marks.indexOf(i);
        if (m >= 0) t.marker = m + 1;
        return t;
      });
      return {
        rule: 'path', n: n, tiles: tiles, answer: cur, start: start, trail: trail,
        clue: { title: ['도착하는 한 칸'], steps: steps, hint: '출발 칸은 세지 않아요. 바로 옆 칸이 1칸째예요' }
      };
    }
    return null;
  }

  // ---------- 줄 숫자 ----------
  function genLines(lv, n) {
    var X = pick(CID), others = CID.filter(function (c) { return c !== X; });
    var sol = randFill(n);
    var tr = ri(0, n - 1), tc = ri(0, n - 1), t = tr * n + tc;
    sol[t] = X;
    var want = Math.min(Math.floor(n * n / 3), 2 + Math.floor(lv / 3));
    var blanks = [t];
    function add(i) { if (blanks.indexOf(i) < 0) blanks.push(i); }
    add(tr * n + pick(range(n).filter(function (c) { return c !== tc; })));
    add(pick(range(n).filter(function (r) { return r !== tr; })) * n + tc);
    var rest = shuffled(range(n * n));
    for (var k = 0; blanks.length < want + 1 && k < rest.length; k++) add(rest[k]);
    blanks.forEach(function (b) { if (b !== t && sol[b] === X) sol[b] = pick(others); });
    var top = range(n).map(function (c) { return range(n).filter(function (r) { return sol[r * n + c] === X; }).length; });
    var left = range(n).map(function (r) { return range(n).filter(function (c) { return sol[r * n + c] === X; }).length; });
    var tiles = range(n * n).map(function (i) {
      return blanks.indexOf(i) >= 0 ? { kind: 'blank', tap: true } : { kind: 'color', color: sol[i], tap: false };
    });
    return {
      rule: 'lines', n: n, tiles: tiles, answer: t, edges: { color: X, top: top, left: left },
      clue: { title: ['빈칸 중 ', { c: X }, '이 들어갈 한 칸'], steps: [], hint: '바깥 숫자 = 그 줄에 있어야 할 ' + CNAME[X] + ' 개수' }
    };
  }

  // ---------- 틀린 숫자 ----------
  function diffCount(sol, i, n) {
    return nb4(i, n).filter(function (j) { return sol[j] !== sol[i]; }).length;
  }
  function genCount(lv, n) {
    var sol = randFill(n);
    var k = Math.min(7, 3 + Math.floor(lv / 4));
    var cells = shuffled(range(n * n)).slice(0, k);
    var wrong = pick(cells);
    var tiles = sol.map(function (c) { return { kind: 'color', color: c, tap: false }; });
    cells.forEach(function (i) {
      var v = diffCount(sol, i, n);
      if (i === wrong) {
        var max = nb4(i, n).length;
        v = v === 0 ? 1 : v === max ? v - 1 : v + pick([-1, 1]);
      }
      tiles[i].num = v; tiles[i].tap = true;
    });
    return {
      rule: 'count', n: n, tiles: tiles, answer: wrong,
      clue: { title: ['숫자가 틀린 한 칸'], steps: [], hint: '숫자 = 위·아래·왼쪽·오른쪽 중 색이 다른 칸 수' }
    };
  }

  // ---------- 규칙 어긴 칸 ----------
  var COLOR_RULES = [
    { x: 'g', y: 'b', dirs: 'ud' }, { x: 'r', y: 'y', dirs: 'lr' },
    { x: 'y', y: 'r', dirs: 'ud' }, { x: 'b', y: 'g', dirs: 'lr' },
    { x: 'g', y: 'y', dirs: 'lr' }, { x: 'r', y: 'b', dirs: 'ud' }
  ];
  function dirNb(i, n, dirs) {
    var r = Math.floor(i / n), c = i % n, o = [];
    if (dirs === 'ud') { if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); }
    else { if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); }
    return o;
  }
  function genRule(lv, n) {
    for (var tries = 0; tries < 300; tries++) {
      var R = pick(COLOR_RULES);
      var notX = CID.filter(function (c) { return c !== R.x; });
      var sol = randFill(n, notX);
      var cnt = Math.min(Math.floor(n * n / 5), 2 + Math.floor(lv / 4));
      var xs = [], forbid = {};
      shuffled(range(n * n)).forEach(function (i) {
        if (xs.length >= cnt || forbid[i]) return;
        var nbs = dirNb(i, n, R.dirs);
        if (nbs.some(function (j) { return xs.indexOf(j) >= 0; })) return;
        xs.push(i);
        nbs.forEach(function (j) { forbid[j] = true; });
      });
      if (xs.length < 2) continue;
      var share = {};
      xs.forEach(function (x) {
        sol[x] = R.x;
        dirNb(x, n, R.dirs).forEach(function (j) { sol[j] = R.y; share[j] = (share[j] || 0) + 1; });
      });
      var cands = xs.filter(function (x) { return dirNb(x, n, R.dirs).some(function (j) { return share[j] === 1; }); });
      if (!cands.length) continue;
      var bad = pick(cands);
      var j = pick(dirNb(bad, n, R.dirs).filter(function (q) { return share[q] === 1; }));
      sol[j] = pick(CID.filter(function (c) { return c !== R.x && c !== R.y; }));
      var tiles = sol.map(function (c, i) { return { kind: 'color', color: c, tap: c === R.x }; });
      var where = R.dirs === 'ud' ? ' 위·아래는 ' : ' 왼쪽·오른쪽은 ';
      return {
        rule: 'rule', n: n, tiles: tiles, answer: bad, cr: R,
        clue: {
          title: ['규칙을 어긴 ', { c: R.x }, ' 한 칸'],
          steps: [{ c: R.x }, where, { c: R.y }],
          hint: '모든 ' + CNAME[R.x] + ' 칸이 지켜야 하는 규칙이에요. 바깥쪽은 따지지 않아요'
        }
      };
    }
    return null;
  }

  // ---------- 짝 없는 칸 (v0.4) ----------
  // 색+숫자가 같은 칸끼리 짝. 짝이 없는 칸은 하나. 칸 수가 짝수면 빈자리 1칸을 둔다.
  function genTwin(lv, n) {
    var N = n * n, hasVoid = N % 2 === 0, used = hasVoid ? N - 1 : N;
    var nPairs = (used - 1) / 2, nTypes = nPairs + 1;
    // v0.6: 큰 판(8×8~10×10)은 9를 넘는 숫자도 쓴다
    var maxNum = Math.max(Math.ceil(nTypes / 4), Math.min(9, Math.ceil(nTypes / 4) + (lv < 4 ? 2 : lv < 10 ? 1 : 0)));
    var types = [];
    CID.forEach(function (c) { for (var k = 1; k <= maxNum; k++) types.push(c + k); });
    types = shuffled(types).slice(0, nTypes);
    var single = types[0], bag = [single];
    for (var t = 1; t < types.length; t++) bag.push(types[t], types[t]);
    if (hasVoid) bag.push('void');
    bag = shuffled(bag);
    var tiles = bag.map(function (s) {
      if (s === 'void') return { kind: 'void', tap: false };
      return { kind: 'color', color: s[0], num: +s.slice(1), tap: true };
    });
    return {
      rule: 'twin', n: n, tiles: tiles, answer: bag.indexOf(single),
      clue: { title: ['짝이 없는 한 칸'], steps: [], hint: '색과 숫자가 모두 같은 칸끼리 짝이에요' }
    };
  }

  // ---------- 외톨이 칸 (v0.4) ----------
  // X색 칸은 모두 상하좌우에 X색 이웃이 있고, 딱 한 칸만 없다.
  function genLonely(lv, n) {
    for (var tries = 0; tries < 400; tries++) {
      var X = pick(CID), others = CID.filter(function (c) { return c !== X; });
      var sol = randFill(n, others);
      var k = Math.min(Math.floor(n * n / 7), 2 + Math.floor(lv / 3));
      var xs = {}, placed = 0, cells = shuffled(range(n * n));
      for (var a = 0; a < cells.length && placed < k; a++) {
        var i = cells[a]; if (xs[i]) continue;
        var nb = nb4(i, n).filter(function (j) { return !xs[j]; }); if (!nb.length) continue;
        var j = pick(nb); xs[i] = xs[j] = true; placed++;
        if (lv >= 6 && Math.random() < 0.3) {
          var nb2 = nb4(j, n).filter(function (q) { return !xs[q]; });
          if (nb2.length) xs[pick(nb2)] = true;
        }
      }
      var cand = range(n * n).filter(function (i) { return !xs[i] && nb4(i, n).every(function (j) { return !xs[j]; }); });
      if (!cand.length) continue;
      xs[pick(cand)] = true;
      Object.keys(xs).forEach(function (i) { sol[+i] = X; });
      var lonely = range(n * n).filter(function (i) { return sol[i] === X && nb4(i, n).every(function (j) { return sol[j] !== X; }); });
      if (lonely.length !== 1) continue;
      var tiles = sol.map(function (c) { return { kind: 'color', color: c, tap: c === X }; });
      return {
        rule: 'lonely', n: n, tiles: tiles, answer: lonely[0],
        clue: { title: ['외톨이 ', { c: X }, ' 한 칸'], steps: ['위·아래·양옆에 같은 색이 없는 칸'], hint: '대각선은 이웃이 아니에요' }
      };
    }
    return null;
  }

  // ---------- 거울 칸 (v0.4) ----------
  // 거울(가운데 점선) 건너편과 같아야 한다. 밝은 쪽에서 한 칸만 다르다.
  function genMirror(lv, n) {
    var horiz = lv >= 5 && Math.random() < 0.5, mid = (n - 1) / 2;
    var sol = randFill(n);
    function pos(i) { return horiz ? Math.floor(i / n) : i % n; }
    function mirrorOf(i) { var r = Math.floor(i / n), c = i % n; return horiz ? (n - 1 - r) * n + c : r * n + (n - 1 - c); }
    var tapCells = range(n * n).filter(function (i) { return pos(i) > mid; });
    tapCells.forEach(function (i) { sol[i] = sol[mirrorOf(i)]; });
    var ans = pick(tapCells);
    sol[ans] = pick(CID.filter(function (c) { return c !== sol[ans]; }));
    var tiles = sol.map(function (c, i) {
      var tap = pos(i) > mid;
      return { kind: 'color', color: c, tap: tap, ref: !tap };
    });
    return {
      rule: 'mirror', n: n, tiles: tiles, answer: ans, mirror: horiz ? 'h' : 'v',
      clue: { title: ['거울에 비친 모습이 다른 한 칸'], steps: [], hint: '노란 점선이 거울이에요' }
    };
  }

  // ---------- 화살표 칸 (v0.4) ----------
  // 모든 칸의 화살표는 옆 칸 하나를 가리킨다. 아무도 가리키지 않는 칸은 하나.
  function tileDominoes(n) {
    var N = n * n, mate = [], steps = 0;
    for (var q = 0; q < N; q++) mate.push(-2);
    function first() { for (var i = 0; i < N; i++) if (mate[i] === -2) return i; return -1; }
    function dfs(h) {
      if (++steps > 20000) return false;
      var i = first(); if (i < 0) return h === 0;
      var r = Math.floor(i / n), c = i % n, opts = [];
      if (c < n - 1 && mate[i + 1] === -2) opts.push(i + 1);
      if (r < n - 1 && mate[i + n] === -2) opts.push(i + n);
      if (h > 0) opts.push(-1);
      opts = shuffled(opts);
      for (var k = 0; k < opts.length; k++) {
        var j = opts[k];
        if (j === -1) { mate[i] = -1; if (dfs(h - 1)) return true; mate[i] = -2; }
        else { mate[i] = j; mate[j] = i; if (dfs(h)) return true; mate[i] = mate[j] = -2; }
      }
      return false;
    }
    return dfs(N % 2) ? mate : null;
  }
  function genArrow(lv, n) {
    for (var tries = 0; tries < 30; tries++) {
      var to = tileDominoes(n); if (!to) continue;
      var p = lv < 3 ? 0.15 : Math.min(0.85, 0.25 + lv * 0.05);
      for (var r = 0; r < n - 1; r++) for (var c = 0; c < n - 1; c++) {
        if (Math.random() >= p) continue;
        var a = r * n + c, b = a + 1, d = a + n, e = a + n + 1;
        if (to[a] === b && to[b] === a && to[d] === e && to[e] === d) { to[a] = b; to[b] = e; to[e] = d; to[d] = a; }
        else if (to[a] === d && to[d] === a && to[b] === e && to[e] === b) { to[a] = d; to[d] = e; to[e] = b; to[b] = a; }
      }
      var ans, hole = to.indexOf(-1);
      if (hole >= 0) { ans = hole; to[hole] = pick(nb4(hole, n)); }
      else {
        var B = ri(0, n * n - 1), C = to[B];
        var alt = nb4(B, n).filter(function (x) { return x !== C; });
        if (!alt.length) continue;
        to[B] = pick(alt); ans = C;
      }
      var indeg = range(n * n).map(function () { return 0; });
      to.forEach(function (t) { indeg[t]++; });
      var zeros = range(n * n).filter(function (i) { return indeg[i] === 0; });
      if (zeros.length !== 1 || zeros[0] !== ans) continue;
      var tiles = to.map(function (t, i) {
        var dir = t === i - n ? 'up' : t === i + n ? 'down' : t === i - 1 ? 'left' : 'right';
        return { kind: 'arrow', dir: dir, tap: true };
      });
      return {
        rule: 'arrow', n: n, tiles: tiles, answer: ans,
        clue: { title: ['아무 화살표도 가리키지 않는 한 칸'], steps: [], hint: '화살표는 바로 옆 칸 하나를 가리켜요' }
      };
    }
    return null;
  }

  // ---------- 보물 찾기 (v0.7, 길 찾기 대신 첫 규칙) ----------
  // 숫자 칸 = 보물까지 위·아래·양옆으로 걸어가는 칸 수(맨해튼 거리). 숫자를 모두 만족하는 칸이 딱 하나.
  function manh(a, b, n) { return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n); }
  function distCands(marks, n, skip) {
    return range(n * n).filter(function (c) {
      if (skip && skip.indexOf(c) >= 0) return false;
      return marks.every(function (m) { return c !== m[0] && manh(c, m[0], n) === m[1]; });
    });
  }
  function genDist(lv, n) {
    var minD = lv < 4 ? 1 : 2;
    for (var tries = 0; tries < 400; tries++) {
      var T = ri(0, n * n - 1), marks = [], cells = shuffled(range(n * n));
      for (var a = 0; a < cells.length && marks.length < 4; a++) {
        var M = cells[a];
        if (M === T || manh(M, T, n) < minD) continue;
        if (marks.some(function (m) { return m[0] === M; })) continue;
        var before = distCands(marks, n, marks.map(function (m) { return m[0]; }));
        var next = marks.concat([[M, manh(M, T, n)]]);
        var after = distCands(next, n, next.map(function (m) { return m[0]; }));
        if (marks.length && after.length >= before.length) continue; // 도움이 안 되는 숫자는 빼기
        marks = next;
        if (after.length === 1) break;
      }
      var mk = marks.map(function (m) { return m[0]; });
      var c = distCands(marks, n, mk);
      if (c.length !== 1 || c[0] !== T || marks.length < 2) continue;
      var tiles = range(n * n).map(function (i) {
        var k = mk.indexOf(i);
        return k >= 0 ? { kind: 'plain', marker: marks[k][1], tap: false, dist: true } : { kind: 'plain', tap: true };
      });
      return { rule: 'dist', n: n, tiles: tiles, answer: T, marks: marks,
        clue: { title: ['보물이 숨은 한 칸'], steps: [], hint: '숫자 = 보물까지 위·아래·양옆으로 걸어가는 칸 수' } };
    }
    return null;
  }

  var GEN = { dist: genDist, path: genPath, lines: genLines, count: genCount, rule: genRule, twin: genTwin, lonely: genLonely, mirror: genMirror, arrow: genArrow };
  function make(rule, lv, n) {
    var pz = null;
    for (var i = 0; !pz && i < 5; i++) pz = GEN[rule](lv, n);
    return pz || genLines(lv, n);
  }

  root.Puzzles = {
    make: make, CNAME: CNAME, COLORS: CID,
    _test: { ringPath: ringPath, ringOf: ringOf, diffCount: diffCount, dirNb: dirNb, nb4: nb4, gen: GEN },
    _h: { manh: manh, distCands: distCands, ri: ri, pick: pick, shuffled: shuffled, range: range, nb4: nb4, randFill: randFill, dirNb: dirNb, diffCount: diffCount, COLOR_RULES: COLOR_RULES, tileDominoes: tileDominoes, genPath: genPath, CID: CID, CNAME: CNAME }
  };
})(typeof window !== 'undefined' ? window : globalThis);
