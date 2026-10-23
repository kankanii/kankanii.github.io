/*
 * 한칸 찾기 · puzzles-multi.js — 마스터 난이도용 '여러 칸 찾기' 문제 (v0.6, 모든 스토어 공통)
 * Puzzles.makeMulti(rule, lv, n, k) → { ..., answers: [칸 번호...], multi: true }
 * 정답 칸이 정확히 answers 뿐인지 만들 때 확인한다. k = 찾을 칸 수(길 찾기는 지나가는 칸 수라 k를 쓰지 않음)
 */
(function (root) {
  'use strict';
  var Z = root.Puzzles, H = Z._h;
  var ri = H.ri, pick = H.pick, shuffled = H.shuffled, range = H.range, nb4 = H.nb4, randFill = H.randFill, dirNb = H.dirNb, CID = H.CID, CNAME = H.CNAME;
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // 길 찾기: 지나가는 칸 모두 (출발 칸 빼고, 도착 칸 포함)
  function mPath(lv, n) {
    var pz = H.genPath(Math.max(9, lv), n);
    if (!pz) return null;
    var ans = uniq([].concat.apply([], pz.trail)).filter(function (i) { return i !== pz.start; });
    pz.answers = ans;
    pz.clue = { title: ['지나가는 칸 모두'], steps: pz.clue.steps, hint: '출발 칸은 빼고, 지나가는 칸과 도착 칸을 모두 골라요' };
    return pz;
  }

  // 줄 숫자: 그 색이 들어갈 빈칸 모두 (해가 하나뿐인 판만)
  function mLines(lv, n, k) {
    for (var tries = 0; tries < 300; tries++) {
      var X = pick(CID), others = CID.filter(function (c) { return c !== X; });
      var sol = range(n * n).map(function () { return Math.random() < 0.28 ? X : pick(others); });
      var B = Math.min(14, Math.max(k + 3, 4 + Math.floor(lv / 4)));
      var blanks = shuffled(range(n * n)).slice(0, B);
      var ans = blanks.filter(function (i) { return sol[i] === X; });
      if (ans.length < 2 || ans.length > k + 1) continue;
      var top = range(n).map(function (c) { return range(n).filter(function (r) { return sol[r * n + c] === X; }).length; });
      var left = range(n).map(function (r) { return range(n).filter(function (c) { return sol[r * n + c] === X; }).length; });
      // 빈칸에 X를 넣는 방법이 하나뿐인지 셈
      var baseR = range(n).map(function (r) { return range(n).filter(function (c) { var i = r * n + c; return blanks.indexOf(i) < 0 && sol[i] === X; }).length; });
      var baseC = range(n).map(function (c) { return range(n).filter(function (r) { var i = r * n + c; return blanks.indexOf(i) < 0 && sol[i] === X; }).length; });
      var count = 0;
      for (var m = 0; m < (1 << B) && count < 2; m++) {
        var R = baseR.slice(), C = baseC.slice(), ok = true;
        for (var b = 0; b < B; b++) if (m & (1 << b)) { var i = blanks[b]; R[Math.floor(i / n)]++; C[i % n]++; }
        for (var q = 0; q < n && ok; q++) if (R[q] !== left[q] || C[q] !== top[q]) ok = false;
        if (ok) count++;
      }
      if (count !== 1) continue;
      var tiles = range(n * n).map(function (i) { return blanks.indexOf(i) >= 0 ? { kind: 'blank', tap: true } : { kind: 'color', color: sol[i], tap: false }; });
      return { rule: 'lines', n: n, tiles: tiles, answers: ans, edges: { color: X, top: top, left: left },
        clue: { title: ['빈칸 중 ', { c: X }, '이 들어갈 칸 모두'], steps: [], hint: '바깥 숫자 = 그 줄에 있어야 할 ' + CNAME[X] + ' 개수' } };
    }
    return null;
  }

  // 짝 없는 칸 모두
  function mTwin(lv, n, k) {
    var N = n * n, voids = (N - k) % 2, pairs = (N - voids - k) / 2, nTypes = pairs + k;
    var maxNum = Math.max(Math.ceil(nTypes / 4), Math.min(9, Math.ceil(nTypes / 4) + 1));
    var types = [];
    CID.forEach(function (c) { for (var v = 1; v <= maxNum; v++) types.push(c + v); });
    types = shuffled(types).slice(0, nTypes);
    var singles = types.slice(0, k), bag = singles.slice();
    for (var t = k; t < types.length; t++) bag.push(types[t], types[t]);
    for (var v2 = 0; v2 < voids; v2++) bag.push('void');
    bag = shuffled(bag);
    var tiles = bag.map(function (s) { return s === 'void' ? { kind: 'void', tap: false } : { kind: 'color', color: s[0], num: +s.slice(1), tap: true }; });
    return { rule: 'twin', n: n, tiles: tiles, answers: singles.map(function (s) { return bag.indexOf(s); }),
      clue: { title: ['짝이 없는 칸 모두'], steps: [], hint: '색과 숫자가 모두 같은 칸끼리 짝이에요' } };
  }

  // 숫자가 틀린 칸 모두
  function mCount(lv, n, k) {
    var sol = randFill(n);
    var cnt = Math.min(Math.floor(n * n * 0.45), Math.max(k + 3, 4 + Math.floor(lv / 3)));
    var cells = shuffled(range(n * n)).slice(0, cnt), wrong = cells.slice(0, k);
    var tiles = sol.map(function (c) { return { kind: 'color', color: c, tap: false }; });
    cells.forEach(function (i) {
      var v = H.diffCount(sol, i, n);
      if (wrong.indexOf(i) >= 0) { var max = nb4(i, n).length; v = v === 0 ? 1 : v === max ? v - 1 : v + pick([-1, 1]); }
      tiles[i].num = v; tiles[i].tap = true;
    });
    return { rule: 'count', n: n, tiles: tiles, answers: wrong,
      clue: { title: ['숫자가 틀린 칸 모두'], steps: [], hint: '숫자 = 위·아래·왼쪽·오른쪽 중 색이 다른 칸 수' } };
  }

  // 외톨이 칸 모두
  function mLonely(lv, n, k) {
    for (var tries = 0; tries < 400; tries++) {
      var X = pick(CID), others = CID.filter(function (c) { return c !== X; });
      var sol = randFill(n, others), xs = {};
      var groups = Math.min(Math.floor(n * n / 8), 2 + Math.floor(lv / 3)), placed = 0, cells = shuffled(range(n * n));
      for (var a = 0; a < cells.length && placed < groups; a++) {
        var i = cells[a]; if (xs[i]) continue;
        var nb = nb4(i, n).filter(function (j) { return !xs[j]; }); if (!nb.length) continue;
        var j = pick(nb); xs[i] = xs[j] = true; placed++;
        if (Math.random() < 0.3) { var nb2 = nb4(j, n).filter(function (q) { return !xs[q]; }); if (nb2.length) xs[pick(nb2)] = true; }
      }
      for (var s = 0; s < k; s++) {
        var cand = range(n * n).filter(function (i) { return !xs[i] && nb4(i, n).every(function (j) { return !xs[j]; }); });
        if (!cand.length) break;
        xs[pick(cand)] = true;
      }
      Object.keys(xs).forEach(function (i) { sol[+i] = X; });
      var lonely = range(n * n).filter(function (i) { return sol[i] === X && nb4(i, n).every(function (j) { return sol[j] !== X; }); });
      if (lonely.length !== k) continue;
      return { rule: 'lonely', n: n, tiles: sol.map(function (c) { return { kind: 'color', color: c, tap: c === X }; }), answers: lonely,
        clue: { title: ['외톨이 ', { c: X }, ' 칸 모두'], steps: ['위·아래·양옆에 같은 색이 없는 칸'], hint: '대각선은 이웃이 아니에요' } };
    }
    return null;
  }

  // 거울 모습과 다른 칸 모두
  function mMirror(lv, n, k) {
    var horiz = Math.random() < 0.5, mid = (n - 1) / 2, sol = randFill(n);
    function pos(i) { return horiz ? Math.floor(i / n) : i % n; }
    function mirrorOf(i) { var r = Math.floor(i / n), c = i % n; return horiz ? (n - 1 - r) * n + c : r * n + (n - 1 - c); }
    var tapCells = range(n * n).filter(function (i) { return pos(i) > mid; });
    tapCells.forEach(function (i) { sol[i] = sol[mirrorOf(i)]; });
    var ans = shuffled(tapCells).slice(0, k);
    ans.forEach(function (i) { sol[i] = pick(CID.filter(function (c) { return c !== sol[i]; })); });
    return { rule: 'mirror', n: n, mirror: horiz ? 'h' : 'v', answers: ans,
      tiles: sol.map(function (c, i) { var tap = pos(i) > mid; return { kind: 'color', color: c, tap: tap, ref: !tap }; }),
      clue: { title: ['거울 모습과 다른 칸 모두'], steps: [], hint: '노란 점선이 거울이에요' } };
  }

  // 규칙을 어긴 칸 모두
  function mRule(lv, n, k) {
    for (var tries = 0; tries < 300; tries++) {
      var R = pick(H.COLOR_RULES), notX = CID.filter(function (c) { return c !== R.x; });
      var sol = randFill(n, notX), cnt = Math.min(Math.floor(n * n / 5), Math.max(k + 2, 3 + Math.floor(lv / 4)));
      var xs = [], forbid = {};
      shuffled(range(n * n)).forEach(function (i) {
        if (xs.length >= cnt || forbid[i]) return;
        var nbs = dirNb(i, n, R.dirs);
        if (nbs.some(function (j) { return xs.indexOf(j) >= 0; })) return;
        xs.push(i); nbs.forEach(function (j) { forbid[j] = true; });
      });
      var share = {};
      xs.forEach(function (x) { sol[x] = R.x; dirNb(x, n, R.dirs).forEach(function (j) { sol[j] = R.y; share[j] = (share[j] || 0) + 1; }); });
      var cands = shuffled(xs.filter(function (x) { return dirNb(x, n, R.dirs).some(function (j) { return share[j] === 1; }); }));
      if (cands.length < k + 1) continue;
      var bad = cands.slice(0, k);
      bad.forEach(function (b) {
        var j = pick(dirNb(b, n, R.dirs).filter(function (q) { return share[q] === 1; }));
        sol[j] = pick(CID.filter(function (c) { return c !== R.x && c !== R.y; }));
      });
      var where = R.dirs === 'ud' ? ' 위·아래는 ' : ' 왼쪽·오른쪽은 ';
      return { rule: 'rule', n: n, cr: R, answers: bad, tiles: sol.map(function (c) { return { kind: 'color', color: c, tap: c === R.x }; }),
        clue: { title: ['규칙을 어긴 ', { c: R.x }, ' 칸 모두'], steps: [{ c: R.x }, where, { c: R.y }], hint: '판 바깥은 따지지 않아요' } };
    }
    return null;
  }

  // 아무도 가리키지 않는 칸 모두
  function mArrow(lv, n, k) {
    for (var tries = 0; tries < 40; tries++) {
      var to = H.tileDominoes(n); if (!to) continue;
      var hole = to.indexOf(-1);
      if (hole >= 0) to[hole] = pick(nb4(hole, n));
      function zeros() { var d = range(n * n).map(function () { return 0; }); to.forEach(function (t) { d[t]++; }); return range(n * n).filter(function (i) { return d[i] === 0; }); }
      var guard = 0;
      while (zeros().length < k && guard++ < 200) {
        var z = zeros(), deg = range(n * n).map(function () { return 0; });
        to.forEach(function (t) { deg[t]++; });
        var B = ri(0, n * n - 1), C = to[B];
        if (deg[C] !== 1) continue;
        var alt = nb4(B, n).filter(function (x) { return x !== C && z.indexOf(x) < 0; });
        if (!alt.length) continue;
        to[B] = pick(alt);
      }
      var zs = zeros();
      if (zs.length !== k) continue;
      return { rule: 'arrow', n: n, answers: zs, tiles: to.map(function (t, i) {
        var dir = t === i - n ? 'up' : t === i + n ? 'down' : t === i - 1 ? 'left' : 'right';
        return { kind: 'arrow', dir: dir, tap: true };
      }), clue: { title: ['아무 화살표도 가리키지 않는 칸 모두'], steps: [], hint: '화살표는 바로 옆 칸 하나를 가리켜요' } };
    }
    return null;
  }

  // 보물 찾기: 숫자를 모두 만족하는 칸 모두 (숫자 2개)
  function mDist(lv, n, k) {
    for (var tries = 0; tries < 400; tries++) {
      var a = ri(0, n * n - 1), b = ri(0, n * n - 1);
      if (a === b) continue;
      var marks = [[a, ri(2, Math.min(2 * (n - 1), 3 + Math.floor(lv / 4)))], [b, ri(2, Math.min(2 * (n - 1), 3 + Math.floor(lv / 4)))]];
      var c = H.distCands(marks, n, [a, b]);
      if (c.length < 2 || c.length > k + 1) continue;
      var tiles = range(n * n).map(function (i) {
        return i === a ? { kind: 'plain', marker: marks[0][1], tap: false, dist: true } : i === b ? { kind: 'plain', marker: marks[1][1], tap: false, dist: true } : { kind: 'plain', tap: true };
      });
      return { rule: 'dist', n: n, tiles: tiles, answers: c, marks: marks,
        clue: { title: ['숫자를 모두 만족하는 칸 모두'], steps: [], hint: '숫자 = 그 칸까지 위·아래·양옆으로 걸어가는 칸 수' } };
    }
    return null;
  }

  var GEN = { dist: mDist, path: mPath, lines: mLines, twin: mTwin, count: mCount, lonely: mLonely, mirror: mMirror, rule: mRule, arrow: mArrow };
  function makeMulti(rule, lv, n, k) {
    var pz = null;
    k = Math.max(2, Math.min(k, Math.floor(n * n / 10))); // 판이 작으면 찾을 칸 수를 줄인다
    for (var i = 0; !pz && i < 8; i++) pz = GEN[rule](lv, n, k);
    if (!pz) pz = mCount(lv, n, k);
    pz.multi = true; pz.answer = -1;
    return pz;
  }
  Z.makeMulti = makeMulti;
  Z._multi = GEN;
})(typeof window !== 'undefined' ? window : globalThis);
