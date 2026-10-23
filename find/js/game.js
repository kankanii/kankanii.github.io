/*
 * 한칸 찾기 · game.js (게임 본체 — 모든 스토어 공통)
 * 저장·진동·광고·결제·순위표는 window.Platform 으로만 부른다.
 */
(function () {
  'use strict';
  var P = window.Platform, Z = window.Puzzles, SND = window.Sound, FX = window.FX;
  var VERSION = '1.0.0';
  var SCORE_VERSION = 2; // 타임어택 점수 체계가 크게 바뀌면 올린다 → 명예의 전당 초기화

  // ===== 게임 설정 (출시-준비물.md '게임 설정'과 같게 유지) =====
  var CFG = {
    // 타임어택
    startTime: 90, maxTime: 99, correctBonus: 3, wrongPenalty: 5, rewardBonus: 15, hallSize: 10,
    // 하트 모드(단계 도전·규칙 연습)
    hearts: 3,
    // 티켓(게임 플레이용)
    ticketMax: 5, ticketEvery: 30 * 60 * 1000, startHints: 3,
    // v0.11 일일 티켓 부스터: 24시간 동안 티켓을 쓰지 않음 (코인 500 · 현금 ₩500)
    boostMs: 24 * 3600 * 1000, boostCost: 500,
    // v0.5: 하트 모드는 시작할 때 티켓을 쓰지 않고, 한 판에서 하트를 2개 잃는 순간 1장 쓴다
    ticketAtMiss: 2,
    adTicketsPerDay: 3, adHintsPerDay: 3,
    // 코인
    coinStage: 5, coinStagePerfect: 10, coinPractice: 1, coinPracticePerfect: 2, coinTimeDiv: 2,
    // 전면 광고: 쌓인 값이 6이 되면 다음 화면 넘어갈 때 1번 (타임어택 1판 = 3, 하트 모드 1판 = 1)
    // v0.4: 세 번째 규칙이 열리는 단계(21)부터만 쌓고 보여 준다
    adEvery: 6, adsFromRules: 3, // v0.8: 세 번째 규칙이 열린 뒤부터 전면 광고
    // v0.6 익스퍼트(단계 도전 10단계 클리어)·마스터(20단계 클리어)
    expertAt: 10, masterAt: 20,
    coinExpert: 8, coinExpertPerfect: 15, coinMaster: 10, coinMasterPerfect: 20,
    // 카드팩: 단계 도전 5단계마다 1개 (무료로만 받음)
    packEvery: 5
  };
  var COIN_ITEMS = [
    { id: 'c-t1', title: '티켓 1장', give: { tickets: 1 }, cost: 60 },
    { id: 'c-t3', title: '티켓 3장', give: { tickets: 3 }, cost: 160 },
    { id: 'c-h1', title: '힌트 1개', give: { hints: 1 }, cost: 20 },
    { id: 'c-h3', title: '힌트 3개', give: { hints: 3 }, cost: 50 },
    { id: 'c-boost', title: '일일 티켓 부스터', give: { boost: 1 }, cost: CFG.boostCost }
  ];
  function shopIc(g) { return g.boost ? 'boost' : g.tickets && g.hints ? 'shop' : g.tickets ? 'ticket' : 'hint'; }
  function boostSub() { return boosted() ? '사용 중 · ' + boostLeftText() + ' 남음 (사면 +24시간)' : '24시간 동안 티켓 안 써요'; }
  // 단계 도전에서 배우는 순서 (10단계마다 하나씩)
  // v0.7: 첫 규칙 '길 찾기' → '보물 찾기'(거리 숫자 추론)
  // v0.8.2: 보물 찾기가 어려워서 뒤로(7번째). 쉬운 규칙부터
  var RULE_ORDER = ['twin', 'lines', 'lonely', 'count', 'mirror', 'rule', 'dist', 'arrow'];
  var TIME_BASE = ['twin', 'lines']; // 타임어택은 처음부터 이 두 규칙을 고를 수 있다
  var RULE_META = {
    dist: { name: '보물 찾기', desc: '숫자를 모두 만족하는, 보물이 숨은 칸을 골라요.', detail: [
      '숫자는 그 칸에서 보물까지 위·아래·양옆으로 걸어가는 칸 수예요. 대각선으로는 못 가요.',
      '숫자마다 맞는 칸들을 떠올리고, 모든 숫자에 맞는 한 칸을 찾아요.',
      '숫자 칸에는 보물이 없어요.'] },
    path: { name: '길 찾기', desc: '번호 칸에서 출발해 화살표대로 움직여 도착하는 칸을 골라요.', detail: [
      '↑ ↓ ← →: 그 방향으로 곧게 움직여요.',
      '출발 칸은 세지 않아요. 바로 옆 칸이 1칸째예요.',
      '움직임은 왼쪽부터 순서대로 이어서 해요.'] },
    lines: { name: '줄 숫자', desc: '빈칸 가운데 그 색이 들어갈 칸을 골라요.', detail: [
      '바깥 숫자는 그 가로줄·세로줄에 있어야 할 그 색의 개수예요.',
      '이미 있는 칸을 빼고, 가로줄과 세로줄이 모두 모자란 빈칸이 정답이에요.'] },
    count: { name: '틀린 숫자', desc: '숫자가 틀린 칸을 골라요.', detail: [
      '숫자는 위·아래·왼쪽·오른쪽 칸 가운데 색이 다른 칸의 수예요.',
      '판 바깥은 세지 않아요. 틀린 숫자는 하나뿐이에요.'] },
    rule: { name: '규칙 어긴 칸', desc: '규칙을 지키지 않은 칸을 골라요.', detail: [
      '"초록 위·아래는 파랑"이면 모든 초록 칸의 바로 위·아래 칸이 파랑이어야 해요.',
      '판 바깥은 따지지 않아요. 규칙에 나온 색 칸만 누를 수 있어요.'] },
    twin: { name: '짝 없는 칸', desc: '색과 숫자가 똑같은 짝이 없는 칸을 골라요.', detail: [
      '색과 숫자가 모두 같아야 짝이에요.',
      '짝이 없는 칸은 하나뿐이에요. 어두운 빈자리는 세지 않아요.'] },
    lonely: { name: '외톨이 칸', desc: '옆에 같은 색 친구가 없는 칸을 골라요.', detail: [
      '위·아래·왼쪽·오른쪽에 같은 색 칸이 하나도 없으면 외톨이예요.',
      '대각선은 이웃이 아니에요. 단서에 나온 색 칸만 누를 수 있어요.'] },
    mirror: { name: '거울 칸', desc: '거울에 비친 모습이 다른 칸을 골라요.', detail: [
      '노란 점선이 거울이에요. 건너편 같은 자리의 칸과 색이 같아야 해요.',
      '흐린 쪽이 원래 모습이에요. 밝은 쪽에서 다른 칸 하나를 찾아요.',
      '거울은 세로로도, 가로로도 놓여요.'] },
    arrow: { name: '화살표 칸', desc: '아무 화살표도 가리키지 않는 칸을 골라요.', detail: [
      '모든 칸의 화살표는 바로 옆 칸 하나를 가리켜요.',
      '어떤 화살표도 가리키지 않는 칸은 하나뿐이에요.'] }
  };
  // 타임어택 판 크기 (튜토리얼에는 쓰지 않는다)
  // v0.6: 최대 10×10까지 커진다
  // v0.7: 4번 맞힐 때마다 한 줄씩
  var SIZE_STEPS = [[1, 4], [5, 5], [9, 6], [13, 7], [17, 8], [21, 9], [25, 10]];
  function gridSize(lv) { var n = 4; SIZE_STEPS.forEach(function (s) { if (lv >= s[0]) n = s[1]; }); return n; }
  // 단계 도전: 10단계마다 새 규칙. 81단계부터는 모든 규칙이 섞임.
  // v0.6: 뒤쪽 규칙일수록 판이 커진다(블록 시작 크기 4→7, 블록 안에서 +0~2). 81부터 6×6 → 10×10
  // v0.8: 단계 도전은 규칙마다 따로 끝없이 오른다. 5단계마다 한 줄(최대 10×10)
  function stagePlan(rule, L) {
    return { rule: rule, lv: Math.min(30, 1 + Math.round((L - 1) * 1.1)), n: Math.min(10, 4 + Math.floor((L - 1) / 5)) };
  }
  var BANDS = [[1, '쉬움'], [11, '보통'], [21, '어려움'], [31, '매우 어려움'], [41, '달인'], [51, '전설']];
  function bandOf(L) { var o = BANDS[0][1]; BANDS.forEach(function (b) { if (L >= b[0]) o = b[1]; }); return o; }
  var FRAME_AT = [[10, 'bronze', '동 테두리'], [20, 'silver', '은 테두리'], [30, 'gold', '금 테두리'], [40, 'rainbow', '무지개 테두리']];


  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  // ===== 저장 데이터 =====
  var data = P.load();
  data.hall = Array.isArray(data.hall) ? data.hall : [];
  data.settings = Object.assign({ sound: true, music: true, vibe: true, cb: false }, data.settings || {});
  // v0.11 색약 모드: 색마다 모양을 크게 + 구분이 쉬운 색
  function applyCb() { document.documentElement.classList.toggle('cb', !!data.settings.cb); }
  applyCb();
  data.learned = data.learned || {};
  if (data.learned.path) data.learned.dist = true; // v0.7 첫 규칙 교체
  data.stage = data.stage || 1;
  data.bestStage = data.bestStage || 0;
  data.xp = data.xp || {};
  if (!data.rlv) { // v0.8: 한 줄짜리 단계 → 규칙별 단계로 옮기기
    data.rlv = {};
    ['dist', 'lines', 'twin', 'count', 'lonely', 'mirror', 'rule', 'arrow'].forEach(function (r, i) {
      var lv = data.stage > 80 ? 11 : data.stage - i * 10;
      data.rlv[r] = Math.max(1, Math.min(11, lv));
      if (data.rlv[r] > 1) data.xp[r] = (data.rlv[r] - 1) * 12;
    });
    data.clearsTotal = Math.max(0, data.stage - 1);
  }
  data.clearsTotal = data.clearsTotal || 0;
  // 예전 버전에서 하던 판 정리 (v0.8 이전 단계 도전 저장은 규칙 정보가 없어 이어할 수 없음)
  if (data.saves && data.saves.stage && !(data.saves.stage.srule && RULE_META[data.saves.stage.srule])) delete data.saves.stage;
  ['expert', 'master', 'practice', 'time'].forEach(function (k) {
    var sv = data.saves && data.saves[k];
    if (sv && sv.pz && sv.pz.rule && !RULE_META[sv.pz.rule]) delete data.saves[k];
  });
  data.adMeter = data.adMeter || 0;
  data.saves = data.saves || {};          // 판 중간 저장 (모드별)
  data.timePick = Array.isArray(data.timePick) ? data.timePick : null; // 타임어택에서 고른 규칙
  data.timeKnown = data.timeKnown || {};
  data.tutSeen = data.tutSeen || {};
  data.expert = data.expert || {};        // 익스퍼트 조합별 단계 ('path+lines', 'random')
  data.master = data.master || {};
  // v0.12 마스터 = 세 규칙 섞기. 예전 '여러 칸 찾기' 판은 이어할 수 없음
  if (data.saves && data.saves.master && !(data.saves.master.pz && data.saves.master.pz.combo === 'one3')) delete data.saves.master;
  if (!data.masterV3) { data.masterV3 = true; data.masterIntro = false; }        // 마스터 규칙별 단계      // v0.5 따라 하기 튜토리얼을 본 규칙
  data.packs = data.packs || 0;
  data.col = data.col || {};
  data.look = Object.assign({ avatar: 'f1', frame: 'none', theme: 'night', bgm: 'basic', sfx: 'basic' }, data.look || {});
  var hallWasReset = false;
  if (data.scoreVersion !== SCORE_VERSION) {
    if (data.hall.length) hallWasReset = true;
    data.hall = []; data.scoreVersion = SCORE_VERSION;
  }
  var E = data.eco = Object.assign({ tickets: CFG.ticketMax, regenAt: 0, coins: 0, hints: CFG.startHints, adDay: '', adT: 0, adH: 0 }, data.eco || {});
  function persist() { P.save(data); }
  function bestScore(exceptId) {
    var l = data.hall.filter(function (r) { return r.id !== exceptId; });
    return l.length ? l[0].score : 0;
  }
  SND.setSfx(data.settings.sound); SND.setMusic(data.settings.music);
  function vib(ms) { if (data.settings.vibe) P.vibrate(ms); }
  document.addEventListener('pointerdown', function () { SND.unlock(); }, true);
  document.addEventListener('keydown', function () { SND.unlock(); }, true);

  // ===== 티켓 · 힌트 · 코인 =====
  // v0.11 일일 티켓 부스터: E.boostUntil 전까지 티켓을 쓰지 않는다 (충전은 평소대로)
  function boosted() { return !!E.boostUntil && Date.now() < E.boostUntil; }
  function syncTickets() {
    var now = Date.now();
    if (E.tickets >= CFG.ticketMax) { E.regenAt = 0; return; }
    if (!E.regenAt) E.regenAt = now + CFG.ticketEvery;
    while (E.regenAt && now >= E.regenAt && E.tickets < CFG.ticketMax) {
      E.tickets++;
      E.regenAt = E.tickets >= CFG.ticketMax ? 0 : E.regenAt + CFG.ticketEvery;
    }
  }
  function startBoost() {
    var now = Date.now();
    E.boostUntil = Math.max(now, E.boostUntil || 0) + CFG.boostMs; // 쓰는 중에 또 사면 24시간 늘어남
    syncTickets(); persist(); refreshWallet();
  }
  function boostLeftText() {
    var s = Math.max(0, Math.ceil(((E.boostUntil || 0) - Date.now()) / 60000));
    return Math.floor(s / 60) + '시간 ' + (s % 60) + '분';
  }
  function spendTicket() {
    syncTickets();
    if (boosted()) return true; // 부스터 중에는 티켓을 쓰지 않음
    if (E.tickets <= 0) return false;
    E.tickets--; syncTickets(); persist(); refreshWallet();
    return true;
  }
  function give(g) {
    if (!g) return;
    if (g.tickets) E.tickets += g.tickets;
    if (g.hints) E.hints += g.hints;
    if (g.coins) E.coins += g.coins;
    if (g.boost) { startBoost(); return; }
    syncTickets(); persist(); refreshWallet();
  }
  function adCounts() { var d = today(); if (E.adDay !== d) { E.adDay = d; E.adT = 0; E.adH = 0; } }
  function regenText() {
    syncTickets();
    if (E.tickets >= CFG.ticketMax) return '가득';
    var s = Math.max(0, Math.ceil((E.regenAt - Date.now()) / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function refreshWallet() {
    syncTickets();
    $$('[data-w="tickets"]').forEach(function (el) { el.textContent = E.tickets; });
    $$('[data-w="hints"]').forEach(function (el) { el.textContent = E.hints; });
    $$('[data-w="coins"]').forEach(function (el) { el.textContent = E.coins; });
    var bo = boosted(), rt = bo ? '무제한' : regenText();
    $$('[data-w="regen"]').forEach(function (el) { el.textContent = rt; });
    $$('.wpill.tk').forEach(function (el) { el.classList.toggle('boost', bo); });
    $$('[data-w="boost"]').forEach(function (el) { el.textContent = bo ? boostLeftText() : ''; });
  }
  setInterval(function () { var before = E.tickets; refreshWallet(); if (E.tickets !== before) persist(); }, 1000);

  // ===== 그리기 =====
  var CNAME = Z.CNAME;
  function sym(c) { return '<svg class="sym" aria-hidden="true"><use href="#sym-' + c + '"/></svg>'; }
  function chip(c) { return '<span class="cchip c-' + c + '"><svg aria-hidden="true"><use href="#sym-' + c + '"/></svg>' + CNAME[c] + '</span>'; }
  function icon(id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="#ic-' + id + '"/></svg>'; }
  var DIR_TXT = { up: ['↑', '위로'], down: ['↓', '아래로'], left: ['←', '왼쪽으로'], right: ['→', '오른쪽으로'] };
  var ARW = { up: [0, '위쪽'], right: [90, '오른쪽'], down: [180, '아래쪽'], left: [270, '왼쪽'] };
  function partsHTML(parts) {
    return parts.map(function (p) {
      if (typeof p === 'string') return '<span>' + p + '</span>';
      if (p.c) return chip(p.c);
      if (p.rl) return '<span class="cl-rule">' + icon(p.rl, 'cl-ic') + partsHTML(p.parts) + '</span>';
      if (p.mk) return '<span class="mkchip">' + p.mk + '</span><span>에서 출발</span>';
      if (p.ring !== undefined) return '<span class="sep">›</span><span class="step"><i>' + (p.ring ? '↻' : '↺') + '</i>' + (p.ring ? '시계로 ' : '반시계로 ') + p.v + '칸</span>';
      if (p.line) return '<span class="sep">›</span><span class="step"><i>' + DIR_TXT[p.line][0] + '</i>' + DIR_TXT[p.line][1] + ' ' + p.v + '칸</span>';
      return '';
    }).join('');
  }
  function tileHTML(t, i, n, anim) {
    var r = Math.floor(i / n), c = i % n, mid = (n - 1) / 2;
    var d = anim ? Math.round((Math.abs(r - mid) + Math.abs(c - mid)) * 45 + Math.random() * 30) : 0;
    var hn = t.num != null || t.marker || t.dmark != null;
    var cls = 'tile k-' + t.kind + (t.color ? ' c-' + t.color : '') + (hn ? ' hn' : '') + (t.ring != null ? ' rg' + (t.ring % 4) : '') + (t.ref ? ' ref' : '') + (t.tap ? '' : ' off');
    var inner = (t.color ? sym(t.color) : '') + (t.marker ? '<b class="mk">' + t.marker + '</b>' : '') + (t.num != null ? '<b class="num">' + t.num + '</b>' : '') +
      (t.dir && t.kind === 'arrow' ? '<svg class="arw" style="--rot:' + ARW[t.dir][0] + 'deg" aria-hidden="true"><use href="#sym-arrow"/></svg>' : '') +
      (t.dir && t.kind !== 'arrow' ? '<i class="arw-s d-' + t.dir + '"></i>' : '') +
      (t.dmark != null ? '<b class="dm">' + t.dmark + '</b>' : '');
    var label = (r + 1) + '행 ' + (c + 1) + '열' + (t.color ? ' ' + CNAME[t.color] : t.kind === 'blank' ? ' 빈칸' : t.kind === 'void' ? ' 빈자리' : '') +
      (t.marker ? (t.dist ? ' 거리 숫자 ' : ' 번호 ') + t.marker : '') + (t.num != null ? ' 숫자 ' + t.num : '') + (t.dir ? ' 화살표 ' + ARW[t.dir][1] : '') +
      (t.dmark != null ? ' 거리 숫자 ' + t.dmark : '');
    return '<button class="' + cls + '" data-i="' + i + '" style="--d:' + d + 'ms"' + (t.tap ? '' : ' tabindex="-1"') + ' aria-label="' + label + '">' + inner + '</button>';
  }
  function renderBoard(box, pz, anim) {
    var n = pz.n, e = pz.edges, h = '';
    if (e) {
      h += '<span class="corner"></span>';
      e.top.forEach(function (v, c) { h += '<span class="edge c-' + e.color + '" data-et="' + c + '" style="--d:' + (anim ? c * 40 : 0) + 'ms">' + sym(e.color) + v + '</span>'; });
    }
    for (var r = 0; r < n; r++) {
      if (e) h += '<span class="edge c-' + e.color + '" data-el="' + r + '" style="--d:' + (anim ? r * 40 : 0) + 'ms">' + sym(e.color) + e.left[r] + '</span>';
      for (var c = 0; c < n; c++) {
        var th = tileHTML(pz.tiles[r * n + c], r * n + c, n, anim);
        // 줄 숫자 빈칸: 정답이 드러날 때 색 모양도 보이게(색약 모드)
        if (e && pz.tiles[r * n + c].kind === 'blank') th = th.replace('</button>', '<svg class="sym bsym" aria-hidden="true"><use href="#sym-' + e.color + '"/></svg></button>');
        h += th;
      }
    }
    var tracks = (e ? '.62fr ' : '') + 'repeat(' + n + ',1fr)';
    box.style.gridTemplateColumns = tracks; box.style.gridTemplateRows = tracks;
    box.style.setProperty('--n', e ? n + 0.62 : n);
    box.classList.toggle('mirror-v', pz.mirror === 'v');
    box.classList.toggle('mirror-h', pz.mirror === 'h');
    box.innerHTML = h;
  }
  function renderMini(box, rule, lv) {
    var pz = Z.make(rule, lv || 2, 4);
    renderBoard(box, pz, false);
    var a = box.querySelector('[data-i="' + pz.answer + '"]');
    if (a) { a.classList.add('reveal'); if (pz.edges) a.classList.add('c-' + pz.edges.color); }
    box.querySelectorAll('.tile').forEach(function (t) { t.setAttribute('tabindex', '-1'); });
    return pz;
  }
  var MINI_LV = { dist: 3, path: 5, lines: 3, count: 2, rule: 2, twin: 2, lonely: 2, mirror: 2, arrow: 2 };
  function ruleSheetHTML(rule, kicker) {
    var m = RULE_META[rule];
    return '<div class="rs-head"><span class="rs-ic">' + icon(rule) + '</span><div><p class="rs-kicker">' + kicker + '</p><h3>' + m.name + '</h3></div></div>' +
      '<p class="rs-desc">' + m.desc + '</p>' +
      '<div class="rs-body"><div class="tray mini" data-mini="' + rule + '"></div><ul>' + m.detail.map(function (d) { return '<li>' + d + '</li>'; }).join('') + '</ul></div>' +
      '<p class="rs-ex" data-mini-ex="' + rule + '"></p>';
  }
  function fillMinis(root) {
    root.querySelectorAll('[data-mini]').forEach(function (box) {
      var rule = box.dataset.mini, pz = renderMini(box, rule, MINI_LV[rule]);
      var ex = root.querySelector('[data-mini-ex="' + rule + '"]');
      if (ex) ex.innerHTML = '<em>예시</em>' + partsHTML(pz.clue.title.concat(pz.clue.steps.length ? [' · '] : [], pz.clue.steps)) + '<span class="sub">→ 빛나는 칸</span>';
    });
  }

  // ===== v0.5 규칙별 따라 하기 튜토리얼 =====
  // 예시 판에서 설명하는 칸만 밝히고 나머지는 어둡게(스포트라이트). 마지막에 직접 정답 칸을 눌러 본다.
  var TUT = null;
  var NB4 = Z._test.nb4, DIRNB = Z._test.dirNb;
  function sample(a, k) { var b = a.slice(), o = []; while (b.length && o.length < k) o.push(b.splice(Math.floor(Math.random() * b.length), 1)[0]); return o; }
  function tutSteps(pz) {
    var n = pz.n, T = pz.tiles, ans = pz.answer, st = [], all = T.map(function (t, i) { return i; });
    switch (pz.rule) {
      case 'dist': {
        var mks = pz.marks.map(function (m) { return m[0]; });
        pz.marks.forEach(function (m, j) {
          var ring = all.filter(function (c) { return mks.indexOf(c) < 0 && Z._h.manh(c, m[0], n) === m[1]; });
          st.push({ say: (j ? '이 숫자는 <b>' + m[1] + '</b>예요. 여기서 ' + m[1] + '칸 떨어진 칸들이에요.' :
            '숫자는 보물까지 <b>위·아래·양옆으로 걸어가는 칸 수</b>예요. 이 칸에서 ' + m[1] + '칸 떨어진 칸들이 밝게 보여요.'), spot: [m[0]].concat(ring) });
        });
        st.push({ say: '<b>모든 숫자</b>에 맞는 칸은 하나뿐이에요. 보물 칸을 눌러 보세요!', tap: true });
        break;
      }
      case 'path': {
        var mv = pz.clue.steps.slice(1), from = pz.start;
        st.push({ say: '<b>' + pz.clue.steps[0].mk + '번</b> 칸에서 출발해요.', spot: [from] });
        for (var k = 0; k < mv.length - 1; k++) {
          var seg = pz.trail[k], cnt = {};
          seg.forEach(function (c, j) { cnt[c] = j + 1; });
          st.push({ say: '<i class="tdir">' + DIR_TXT[mv[k].line][0] + '</i><b>' + DIR_TXT[mv[k].line][1] + ' ' + mv[k].v + '칸</b> 움직여요.' +
            (k === 0 ? ' 출발한 칸은 세지 않고, 바로 옆 칸이 1칸째예요.' : ''), spot: [from].concat(seg), cnt: cnt, from: from });
          from = seg[seg.length - 1];
        }
        var lm = mv[mv.length - 1];
        st.push({ say: '마지막으로 <i class="tdir">' + DIR_TXT[lm.line][0] + '</i><b>' + DIR_TXT[lm.line][1] + ' ' + lm.v + '칸</b>! 도착하는 칸을 눌러 보세요.', tap: true, pulse: [from] });
        break;
      }
      case 'lines': {
        var e = pz.edges, X = e.color, r = Math.floor(ans / n), c = ans % n;
        var col = [], row = [];
        for (var q = 0; q < n; q++) { col.push(q * n + c); row.push(r * n + q); }
        var hc = col.filter(function (i) { return T[i].color === X; }).length, hr = row.filter(function (i) { return T[i].color === X; }).length;
        st.push({ say: '바깥 숫자는 그 줄에 들어갈 ' + chip(X) + ' 개수예요.', spot: [], edges: { top: all.slice(0, n), left: all.slice(0, n) } });
        st.push({ say: '이 세로줄은 <b>' + e.top[c] + '개</b>여야 하는데 지금 <b>' + hc + '개</b>예요. 빈칸 하나가 ' + chip(X) + '이에요.', spot: col, edges: { top: [c] } });
        st.push({ say: '이 가로줄도 <b>' + e.left[r] + '개</b>여야 하는데 지금 <b>' + hr + '개</b>예요.', spot: row, edges: { left: [r] } });
        st.push({ say: '두 줄에 모두 들어가는 빈칸이 정답이에요. 눌러 보세요!', tap: true });
        break;
      }
      case 'twin': {
        var groups = {};
        T.forEach(function (t, i) { if (t.kind === 'color') { var k2 = t.color + t.num; (groups[k2] = groups[k2] || []).push(i); } });
        var pairs = Object.keys(groups).filter(function (k2) { return groups[k2].length === 2; }).map(function (k2) { return groups[k2]; });
        if (pairs.length < 2) return null;
        var pp = sample(pairs, 2);
        st.push({ say: '색과 숫자가 <b>모두 같은</b> 두 칸은 짝이에요.', spot: pp[0] });
        st.push({ say: '이 두 칸도 짝이에요. 이렇게 모든 칸에 짝이 있는데…', spot: pp[1] });
        var vd = T.findIndex(function (t) { return t.kind === 'void'; });
        if (vd >= 0) st.push({ say: '어두운 빈자리는 세지 않아요.', spot: [vd] });
        st.push({ say: '<b>짝이 없는 칸</b>이 딱 하나 있어요. 찾아 눌러 보세요!', tap: true });
        break;
      }
      case 'count': {
        var ok = all.filter(function (i) { return T[i].num != null && i !== ans; });
        if (!ok.length) return null;
        sample(ok, 2).forEach(function (i, j) {
          var nb = NB4(i, n), diff = nb.filter(function (x) { return T[x].color !== T[i].color; }).length;
          st.push({ say: (j ? '이 칸도 ' : '숫자는 위·아래·양옆 중 <b>색이 다른 칸 수</b>예요. 이 칸은 ') + '다른 색이 <b>' + diff + '개</b>라서 숫자 ' + T[i].num + '이 맞아요.',
            spot: [i].concat(nb), cnt: nb.reduce(function (o, x) { if (T[x].color !== T[i].color) o[x] = '✓'; return o; }, {}) });
        });
        st.push({ say: '숫자가 <b>틀린 칸</b>이 하나 있어요. 찾아 눌러 보세요!', tap: true });
        break;
      }
      case 'lonely': {
        var X2 = T[ans].color;
        var buddy = all.filter(function (i) { return i !== ans && T[i].color === X2 && NB4(i, n).some(function (j) { return T[j].color === X2; }); });
        if (!buddy.length) return null;
        var b0 = buddy[0], b1 = NB4(b0, n).filter(function (j) { return T[j].color === X2; })[0];
        st.push({ say: chip(X2) + ' 칸만 볼게요. 바로 옆에 같은 색이 붙어 있으면 외톨이가 아니에요.', spot: [b0, b1] });
        st.push({ say: '대각선은 이웃이 아니에요. 위·아래·양옆에 ' + chip(X2) + '이 하나도 없는 칸을 눌러 보세요!', tap: true });
        break;
      }
      case 'mirror': {
        var h = pz.mirror === 'h';
        var mOf = function (i) { var r2 = Math.floor(i / n), c2 = i % n; return h ? (n - 1 - r2) * n + c2 : r2 * n + (n - 1 - c2); };
        var taps = all.filter(function (i) { return T[i].tap && i !== ans; });
        var pk = sample(taps, 2);
        st.push({ say: '노란 점선이 거울이에요. 흐린 쪽이 원래 모습이에요.', spot: all.filter(function (i) { return T[i].ref; }) });
        st.push({ say: '거울 건너편 <b>같은 자리</b>끼리는 색이 같아야 해요.', spot: [pk[0], mOf(pk[0])] });
        st.push({ say: '이 두 칸도 같아요.', spot: [pk[1], mOf(pk[1])] });
        st.push({ say: '밝은 쪽에서 거울 모습과 <b>색이 다른 칸</b>을 눌러 보세요!', tap: true });
        break;
      }
      case 'rule': {
        var R = pz.cr; if (!R) return null;
        var goods = all.filter(function (i) { return T[i].color === R.x && i !== ans; });
        if (!goods.length) return null;
        var g0 = goods[0], gn = DIRNB(g0, n, R.dirs);
        var where = R.dirs === 'ud' ? ' 위·아래는 ' : ' 왼쪽·오른쪽은 ';
        st.push({ say: '모든 ' + chip(R.x) + ' 칸은 규칙을 지켜야 해요: ' + chip(R.x) + where + chip(R.y), spot: [g0].concat(gn) });
        st.push({ say: '이 칸은 규칙을 잘 지켰어요. 판 바깥은 따지지 않아요.', spot: [g0].concat(gn) });
        st.push({ say: '규칙을 <b>어긴</b> ' + chip(R.x) + ' 칸을 눌러 보세요!', tap: true });
        break;
      }
      case 'arrow': {
        var D = { up: -n, down: n, left: -1, right: 1 };
        var pk2 = sample(all.filter(function (i) { return i !== ans; }), 2);
        pk2.forEach(function (i, j) {
          var to = i + D[T[i].dir], cnt2 = {}; cnt2[to] = '★';
          st.push({ say: j ? '이 화살표도 옆 칸(★)을 가리켜요. 거의 모든 칸이 누군가에게 가리켜지고 있어요.' : '화살표는 <b>바로 옆 칸 하나</b>(★)를 가리켜요.', spot: [i, to], cnt: cnt2 });
        });
        st.push({ say: '<b>아무 화살표도 가리키지 않는 칸</b>이 하나 있어요. 찾아 눌러 보세요!', tap: true });
        break;
      }
    }
    return st;
  }
  function openTutorial(rule, first, next) {
    var pz = null, steps = null;
    for (var i = 0; i < 40 && !steps; i++) { pz = Z.make(rule, rule === 'path' || rule === 'dist' ? 3 : 2, rule === 'path' || rule === 'dist' ? 5 : 4); steps = tutSteps(pz); }
    TUT = { pz: pz, steps: steps, i: 0, miss: 0, done: false, first: first };
    var m = RULE_META[rule];
    var h = '<div class="tut">' +
      '<div class="rs-head"><span class="rs-ic">' + icon(rule) + '</span><div><p class="rs-kicker">' + (first ? '새 규칙 · 따라 해 보기' : '따라 해 보기') + '</p><h3>' + m.name + '</h3></div></div>' +
      '<div class="tut-clue"><span class="tc-k">단서</span>' + partsHTML(pz.clue.title.concat(pz.clue.steps.length ? [' · '] : [], pz.clue.steps)) + '</div>' +
      '<div class="tut-board"><div class="tray tut-tray" id="tut-tray"></div></div>' +
      '<p class="tut-say" id="tut-say"></p>' +
      '<div class="tut-nav"><button class="btn ghost tut-prev" data-act="tut-prev" id="tut-prev">이전</button><span class="tut-dots" id="tut-dots"></span><button class="btn primary tut-next" data-act="tut-next" id="tut-next">다음</button></div>' +
      '<button class="btn ghost tut-skip" data-act="tut-done" id="tut-skip">' + (first ? '건너뛰고 시작하기' : '닫기') + '</button></div>';
    openModal(h, next || function () {});
    renderBoard($('#tut-tray'), pz, true);
    $('#tut-tray').querySelectorAll('.tile').forEach(function (t) { t.setAttribute('tabindex', '-1'); });
    tutGo(0);
  }
  function tutGo(k) {
    if (!TUT || k >= TUT.steps.length) return;
    TUT.i = k;
    var s = TUT.steps[k], tr = $('#tut-tray');
    tr.querySelectorAll('.spot,.pulse,.miss,.reveal').forEach(function (el) { el.classList.remove('spot', 'pulse', 'miss', 'reveal'); });
    tr.querySelectorAll('[data-cnt]').forEach(function (el) { el.removeAttribute('data-cnt'); });
    tr.classList.toggle('tdim', !s.tap);
    (s.spot || []).forEach(function (i) { var el = tr.querySelector('[data-i="' + i + '"]'); if (el) el.classList.add('spot'); });
    (s.pulse || []).forEach(function (i) { var el = tr.querySelector('[data-i="' + i + '"]'); if (el) el.classList.add('pulse'); });
    Object.keys(s.cnt || {}).forEach(function (i) { var el = tr.querySelector('[data-i="' + i + '"]'); if (el) el.setAttribute('data-cnt', s.cnt[i]); });
    var ed = s.edges || {};
    (ed.top || []).forEach(function (c) { var el = tr.querySelector('[data-et="' + c + '"]'); if (el) el.classList.add('spot'); });
    (ed.left || []).forEach(function (r) { var el = tr.querySelector('[data-el="' + r + '"]'); if (el) el.classList.add('spot'); });
    var say = $('#tut-say'); say.innerHTML = s.say; retrigger(say, 'in');
    $('#tut-dots').innerHTML = TUT.steps.map(function (x, j) { return '<i class="' + (j === k ? 'on' : j < k ? 'past' : '') + '"></i>'; }).join('');
    $('#tut-prev').style.visibility = k > 0 && !TUT.done ? 'visible' : 'hidden';
    var nx = $('#tut-next');
    nx.hidden = !!s.tap;
    SND.play(k ? 'pick' : 'open');
  }
  function tutTap(i, el) {
    if (!TUT || TUT.done) return;
    var s = TUT.steps[TUT.i];
    if (!s.tap) { retrigger($('#tut-next'), 'nudge'); return; }
    var pz = TUT.pz, tile = pz.tiles[i];
    if (!tile || !tile.tap) return;
    if (i === pz.answer) {
      TUT.done = true;
      if (pz.edges) el.classList.add('c-' + pz.edges.color);
      el.classList.add('hit');
      var xy = FX.centerOf(el);
      FX.burst(xy[0], xy[1], null, 26, 1); FX.ring(xy[0], xy[1], FX.color('y'));
      SND.play('correct', 3); vib(15);
      $('#tut-say').innerHTML = '<b>정답!</b> ' + (TUT.first ? '이제 직접 풀어 봐요.' : '잘했어요.'); retrigger($('#tut-say'), 'in');
      $('#tut-prev').style.visibility = 'hidden';
      $('#tut-skip').hidden = true;
      var nx = $('#tut-next'); nx.hidden = false; nx.textContent = TUT.first ? '시작하기' : '닫기'; nx.dataset.act = 'tut-done';
      $('#tut-dots').querySelectorAll('i').forEach(function (d) { d.className = 'past'; });
    } else {
      TUT.miss++;
      retrigger(el, 'miss'); SND.play('nope'); vib(40);
      var say = $('#tut-say');
      if (TUT.miss >= 2) {
        var a = $('#tut-tray').querySelector('[data-i="' + pz.answer + '"]');
        if (a) a.classList.add('pulse');
        say.innerHTML = '괜찮아요! <b>깜빡이는 칸</b>이 정답이에요. 눌러 보세요.';
      } else say.innerHTML = '그 칸은 아니에요. 다시 찾아봐요!';
      retrigger(say, 'in');
    }
  }

  // ===== 화면 이동 · 알림 =====
  var screen = 'scr-title';
  function show(id) {
    screen = id;
    $$('.screen').forEach(function (el) { el.hidden = el.id !== id; });
    SND.setMode(id === 'scr-play' ? 'play' : 'title');
  }
  function go(id, setup) {
    SND.play('whoosh');
    return FX.wipe(function () { if (setup) setup(); show(id); });
  }
  var toastTimer = 0;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function floatAt(x, y, text, cls) {
    var el = document.createElement('span');
    el.className = 'float ' + cls; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  var modalNext = null;
  function openModal(html, next) {
    modalNext = next || null;
    var box = $('#modal-box'); box.innerHTML = html; fillMinis(box);
    $('#modal').hidden = false; SND.play('open');
  }
  function closeModal() { $('#modal').hidden = true; var f = modalNext; modalNext = null; return f; }
  // v0.4: 세 번째 규칙(21단계)이 열리기 전에는 전면 광고를 쌓지도 보여 주지도 않는다
  function adsOn() { return P.features.ads && !P.hasNoAds() && unlockedRules().length >= CFG.adsFromRules; }
  function addAdMeter(k) { if (adsOn()) data.adMeter += k; }
  function maybeAd(next) {
    if (adsOn() && data.adMeter >= CFG.adEvery) {
      data.adMeter = 0; persist(); SND.duck(true);
      P.showInterstitial().then(function () { SND.duck(false); next(); }, function () { SND.duck(false); next(); });
    } else next();
  }

  // ===== 꾸미기 적용 =====
  function applyLook() {
    var L = Collect.fixLook();
    document.documentElement.dataset.theme = L.theme;
    SND.setBgm(L.bgm); SND.setSfxSet(L.sfx);
    var pr = $('#profile');
    if (pr) {
      var n = Collect.count();
      pr.innerHTML = Collect.avatarHTML(L) + '<span class="pf-txt"><b>총 ' + data.clearsTotal + '단계</b><small>수집 ' + n.own + '/' + n.total + '</small></span>';
    }
  }

  // ===== 처음 화면 =====
  function setupHome() {
    var sv = data.saves;
    $('#stage-sub').textContent = sv.stage ? RULE_META[sv.stage.srule].name + ' ' + sv.stage.slv + '단계 · 이어하기' : '규칙 고르기 · 총 ' + data.clearsTotal + '단계';
    $('#time-sub').textContent = sv.time ? '이어하기 · ' + sv.time.score + '칸' : '90초 기록 겨루기';
    $('#practice-sub').textContent = sv.practice ? '이어하기' : '고른 규칙만';
    $('#btn-stage').classList.toggle('resume', !!sv.stage);
    $('#btn-time').classList.toggle('resume', !!sv.time);
    $('#btn-practice').classList.toggle('resume', !!sv.practice);
    ['expert', 'master'].forEach(function (k) {
      var open = hardOpen(k), b = $('#btn-' + k);
      b.classList.toggle('locked', !open); b.classList.toggle('resume', open && !!sv[k]);
      $('#' + k + '-sub').textContent = !open ? hardLockText(k) : sv[k] ? '이어하기' : k === 'expert' ? '두 규칙 섞기' : '세 규칙 섞기';
    });
    var n = Collect.count(), badge = data.packs > 0 ? data.packs : n.waiting > 0 ? n.waiting : 0;
    var b = $('#col-badge'); b.textContent = badge; b.hidden = !badge;
    b.classList.toggle('pk', data.packs > 0);
    refreshWallet(); applyLook();
    $$('.ltile').forEach(function (el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  }
  function goHome() { go('scr-title', setupHome); }

  // 티켓·힌트가 없을 때 창
  function needModal(kind, inPlay) {
    adCounts();
    var isT = kind === 'ticket';
    var adLeft = isT ? CFG.adTicketsPerDay - E.adT : CFG.adHintsPerDay - E.adH;
    var item = COIN_ITEMS.filter(function (c) { return c.id === (isT ? 'c-t1' : 'c-h1'); })[0];
    var h = '<div class="need-ic ' + (isT ? 'tk' : 'ht') + '">' + icon(isT ? 'ticket' : 'hint') + '</div>' +
      '<h2>' + (isT ? '티켓이 없어요' : '힌트가 없어요') + '</h2>' +
      (isT ? '<p class="sub">다음 티켓까지 <b data-w="regen">' + regenText() + '</b></p>' : '<p class="sub">힌트를 더 받아 볼까요?</p>');
    if (P.features.ads && adLeft > 0) h += '<button class="btn go" data-act="' + (isT ? 'ad-ticket' : 'ad-hint') + '">광고 보고 ' + (isT ? '티켓 1장' : '힌트 1개') + ' <small>오늘 ' + adLeft + '번 남음</small></button>';
    h += '<button class="btn" data-act="buy-coin" data-id="' + item.id + '"' + (E.coins < item.cost ? ' disabled' : '') + '>' + item.title + ' <small class="cost">' + icon('coin') + item.cost + '</small></button>';
    if (isT && !boosted()) h += '<button class="btn" data-act="buy-coin" data-id="c-boost"' + (E.coins < CFG.boostCost ? ' disabled' : '') + '>일일 티켓 부스터 <small class="cost">' + icon('coin') + CFG.boostCost + '</small></button>';
    if (!inPlay) h += '<button class="btn" data-act="go-shop">상점 가기</button>';
    h += '<button class="btn ghost" data-act="modal-close">닫기</button>';
    openModal(h);
  }
  function needTicket(inPlay) {
    syncTickets();
    if (boosted() || E.tickets > 0) return true;
    needModal('ticket', inPlay);
    return false;
  }

  // ===== 플레이 상태 =====
  var S = { mode: 'time', active: false, running: false, paused: false, lock: true, pz: null, pzDone: false, inRun: false, rule: null, level: 1, score: 0,
    combo: 0, maxCombo: 0, time: CFG.startTime, last: 0, raf: 0, rewardUsed: false, runId: 0, isBest: false, lastSec: 99, lastSave: 0,
    hearts: CFG.hearts, mistakes: 0, hintLv: 0, hintDecoy: null, solved: 0, pick: [], timeRules: TIME_BASE.slice(),
    sel: [], hintCells: [], hkey: null, hlevel: 1, part: 0, seq: null, tool: 'pick', msym: 'o', mcol: 'r', marks: {} };
  var tray = $('#tray');

  // ===== 판 중간 저장 (나가도 그 자리에서 티켓 없이 이어하기) =====
  function snapOf() {
    var heart = S.mode !== 'time';
    var s = { pz: S.pzDone ? null : S.pz, hearts: S.hearts, mistakes: S.mistakes, hintLv: S.pzDone ? 0 : S.hintLv, decoy: S.pzDone ? null : S.hintDecoy, rule: S.rule, at: Date.now() };
    if (S.mode === 'stage') { s.srule = S.srule; s.slv = data.rlv[S.srule]; }
    if (S.mode === 'practice') { s.pick = S.pick.slice(); s.solved = S.solved; }
    s.marks = S.pzDone ? {} : JSON.parse(JSON.stringify(S.marks));
    if (isHard()) Object.assign(s, { hkey: S.hkey, hlevel: S.hlevel, part: S.part, seq: S.seq, sel: S.pzDone ? [] : S.sel.slice(), hintCells: S.pzDone ? [] : S.hintCells.slice() });
    if (!heart) Object.assign(s, { time: S.time, score: S.score, level: S.level, maxCombo: S.maxCombo, rewardUsed: S.rewardUsed, runId: S.runId, coinsGiven: timeCoinsGiven, timeRules: S.timeRules });
    return s;
  }
  function saveRun() {
    if (!S.inRun || !S.pz) return;
    if (S.mode !== 'time' && S.pzDone) return; // 하트 모드는 다 푼 판을 저장하지 않는다
    data.saves[S.mode] = snapOf(); persist();
  }
  function clearRun(mode) { if (data.saves[mode]) { delete data.saves[mode]; persist(); } }
  function resumeRun(mode) {
    var s = data.saves[mode]; if (!s) return false;
    Object.assign(S, { mode: mode, active: false, running: false, paused: false, inRun: true, rule: s.rule,
      hearts: s.hearts != null ? s.hearts : CFG.hearts, mistakes: s.mistakes || 0 });
    if (mode === 'practice') { S.pick = s.pick || S.pick; S.solved = s.solved || 0; }
    if (mode === 'stage') S.srule = s.srule;
    if (mode === 'expert' || mode === 'master') Object.assign(S, { hkey: s.hkey, hlevel: s.hlevel, part: s.part || 0, seq: s.seq });
    if (mode === 'time') {
      Object.assign(S, { time: Math.max(3, s.time), score: s.score, level: s.level, combo: 0, maxCombo: s.maxCombo || 0, rewardUsed: !!s.rewardUsed,
        runId: s.runId, isBest: false, lastSec: 99, timeRules: s.timeRules || TIME_BASE.slice() });
      timeCoinsGiven = s.coinsGiven || 0;
    }
    function redeal() {
      if (s.pz) deal(s.pz, { hintLv: s.hintLv || 0, decoy: s.decoy, sel: s.sel, hintCells: s.hintCells, marks: s.marks });
      else if (mode === 'expert' || mode === 'master') dealHard();
      else if (mode === 'time') nextTimePuzzle();
      else if (mode === 'stage') nextStagePuzzle(); else nextPracticePuzzle();
    }
    if (mode === 'time') go('scr-play', setupHud).then(countdown).then(function () { redeal(); runTimer(); });
    else go('scr-play', setupHud).then(function () { showBanner(mode === 'stage' ? RULE_META[S.srule].name + ' ' + data.rlv[S.srule] + '단계 이어하기' : isHard() ? HARD_NAME[mode] + ' ' + S.hlevel + ' 이어하기' : '이어하기'); redeal(); });
    return true;
  }

  function setupHud() {
    var t = S.mode === 'time';
    $('#bar-wrap').hidden = !t; $('#hud-time').hidden = !t; $('#combo').hidden = !t;
    $('#hearts').hidden = t; $('#hud-tk').hidden = t;
    $('#hud-lbl').textContent = t ? '찾은 칸' : S.mode === 'stage' ? RULE_META[S.srule].name : isHard() ? HARD_NAME[S.mode] : '연습';
    $('#btn-confirm').hidden = true;
    $('#pause').hidden = true; $('#psheet').hidden = true; $('#banner').hidden = true;
    tray.classList.remove('veil', 'out', 'mirror-v', 'mirror-h'); tray.innerHTML = '';
    $('#clue-title').innerHTML = '<span>준비!</span>'; $('#clue-steps').innerHTML = '';
    $('#rule-ic').hidden = true;
    updateHud(); refreshWallet();
  }
  function renderHearts(lostAnim) {
    var h = '';
    for (var i = 0; i < CFG.hearts; i++) {
      var lost = i >= S.hearts;
      h += '<span class="hrt' + (lost ? ' lost' : '') + (lost && lostAnim && i === S.hearts ? ' break' : '') + '">' + icon('heart') + '</span>';
    }
    $('#hearts').innerHTML = h;
  }
  function updateHud() {
    if (S.mode === 'time') {
      $('#score').textContent = S.score;
      var sec = Math.max(0, Math.ceil(S.time));
      $('#time').textContent = sec;
      $('#bar').style.transform = 'scaleX(' + Math.min(1, Math.max(0, S.time / CFG.startTime)) + ')';
      var low = S.time < 10;
      $('#hud-time').classList.toggle('low', low);
      $('#bar-wrap').classList.toggle('low', low);
      if (S.running && !S.paused && low && sec < S.lastSec) SND.play('low');
      if (S.running) SND.setMode(low ? 'hurry' : 'play');
      S.lastSec = sec;
    } else {
      $('#score').textContent = S.mode === 'stage' ? data.rlv[S.srule] : isHard() ? S.hlevel : S.solved + 1;
      renderHearts(false);
    }
  }
  function updateHintBtn() {
    if (S.pz && S.pz.multi) {
      var left = S.pz.answers.filter(function (i) { return S.sel.indexOf(i) < 0; }).length;
      var maxH = Math.min(3, S.pz.answers.length - 1), done = S.hintLv >= maxH || left === 0;
      $('#hint-next').textContent = done ? '다 썼어요' : '한 칸 알려주기';
      $('#btn-hint').disabled = done;
      return;
    }
    var labels = ['약한 힌트', '강한 힌트', '정답 보기', '다 썼어요'];
    $('#hint-next').textContent = labels[S.hintLv];
    $('#btn-hint').disabled = S.hintLv >= 3;
  }
  function chooseFrom(pool, prev) {
    var k; do { k = pick(pool); } while (pool.length > 1 && k === prev);
    return k;
  }

  // v0.5: 판 크기를 칸 수에 맞춰 줄인다 (한 손으로 누르기 편하게, 칸 약 40~55px)
  var FIT = { 4: 0.72, 5: 0.78, 6: 0.84, 7: 0.9, 8: 0.94, 9: 0.97, 10: 1 };
  // 문제를 판에 깔기 (처음 보는 규칙이면 튜토리얼부터). resume: 저장된 힌트 단계
  function deal(pz, resume) {
    S.pz = pz; S.pzDone = false;
    S.hintLv = resume ? resume.hintLv || 0 : 0; S.hintDecoy = resume ? (resume.decoy != null ? resume.decoy : null) : null;
    S.sel = resume && resume.sel ? resume.sel.slice() : []; S.hintCells = resume && resume.hintCells ? resume.hintCells.slice() : [];
    S.marks = {};
    if (resume && resume.marks) Object.keys(resume.marks).forEach(function (i) { if (Array.isArray(resume.marks[i])) S.marks[i] = resume.marks[i].slice(); });
    var showIt = function () {
      tray.classList.remove('out', 'veil');
      $('#rule-ic-use').setAttribute('href', '#ic-' + pz.rule);
      $('#rule-ic').hidden = false;
      $('#clue-title').innerHTML = partsHTML(pz.clue.title);
      $('#clue-steps').innerHTML = partsHTML(pz.clue.steps);
      retrigger($('#clue'), 'in');
      tray.style.setProperty('--fit', FIT[pz.n] || 0.9);
      renderBoard(tray, pz, true);
      Object.keys(S.marks).forEach(function (i) { renderMark(+i); });
      // 색으로 구분하는 판이면 색 표시도 쓸 수 있게
      updateTools();
      if (!data.markTip2) { data.markTip2 = true; persist(); setTimeout(function () { toast('색을 고르고 ○ ✕ 를 눌러 칸에 표시해요. 한 칸에 여러 개도 돼요'); }, 1400); }
      for (var k = 0; k < 7; k++) setTimeout(function () { SND.play('deal'); }, 40 + k * 45);
      $('#btn-confirm').hidden = !pz.multi;
      if (pz.multi) { S.sel.forEach(function (i) { var t = tray.querySelector('[data-i="' + i + '"]'); if (t) t.classList.add('sel'); }); updateConfirm(); }
      updateHintBtn();
      if (S.hintLv) applyHint();
      S.lock = false; S.active = true;
      saveRun();
    };
    saveRun();
    var unseen = (pz.rules || [pz.rule]).filter(function (r) { return RULE_META[r] && !data.tutSeen[r]; });
    var wasPaused = S.paused;
    if (unseen.length) {
      var r0 = unseen[0];
      data.learned[r0] = true; data.tutSeen[r0] = true; persist(); // 규칙마다 한 번만
      S.paused = true;
      openTutorial(r0, true, function () { S.paused = wasPaused; deal(pz, resume); });
    } else if (pz.combo && pz.combo !== 'one3' && !data.comboIntro) {
      data.comboIntro = true; persist(); S.paused = true;
      openModal('<p class="rs-kicker" style="text-align:center">익스퍼트</p><h2>규칙 섞기</h2><ul class="intro-list">' +
        '<li>한 판에 규칙 <b>두 개</b>가 함께 나와요. 단서에 두 규칙이 한 줄씩 적혀 있어요.</li>' +
        '<li><b>한 칸</b> 문제: 두 규칙을 <b>모두</b> 지키는 칸은 딱 하나예요. 한 규칙만 보면 후보가 여러 개예요.</li>' +
        '<li><b>모두</b> 문제: 두 규칙에 맞는 칸을 모두 골라 <b>확정</b>해요.</li>' +
        '<li>판 위의 작은 표시: 오른쪽 위 동그라미 숫자 = 거리 숫자, 칸 가장자리 삼각형 = 화살표.</li></ul>' +
        '<button class="btn primary" data-act="modal-next">시작하기</button>', function () { S.paused = wasPaused; S.last = performance.now(); showIt(); });
    } else showIt();
  }
  function nextTimePuzzle() {
    S.rule = chooseFrom(S.timeRules, S.rule);
    deal(Z.make(S.rule, S.level, gridSize(S.level)));
  }
  function nextStagePuzzle() {
    var L = data.rlv[S.srule] || 1, plan = stagePlan(S.srule, L);
    S.rule = S.srule;
    S.hearts = CFG.hearts; S.mistakes = 0;
    updateHud();
    showBanner(RULE_META[S.srule].name + ' ' + L + '단계 · ' + bandOf(L));
    deal(Z.make(S.rule, plan.lv, plan.n));
  }
  function nextPracticePuzzle() {
    S.rule = chooseFrom(S.pick, S.rule);
    S.hearts = CFG.hearts; S.mistakes = 0;
    var lv = 3 + S.solved;
    updateHud();
    deal(Z.make(S.rule, lv, gridSize(lv)));
  }
  function showBanner(text) {
    var b = $('#banner'); b.textContent = text; b.hidden = false; retrigger(b, 'go');
    clearTimeout(showBanner.t); showBanner.t = setTimeout(function () { b.hidden = true; }, 1100);
  }

  // ===== 탭 처리 =====
  // ===== 칸 표시 (색별 ○ ✕, 한 칸에 여러 개) — 정답 판정과 상관없는 메모 =====
  var MCOL = ['g', 'r', 'b', 'y'];
  function updateTools() {
    var on = S.tool !== 'pick';
    $$('#marks [data-act="tool"]').forEach(function (b) {
      var id = b.dataset.id;
      b.setAttribute('aria-pressed', String(id === 'pick' ? !on : MCOL.indexOf(id) >= 0 ? id === S.mcol : on && id === S.msym));
    });
    $('#marks').className = 'marks mc-' + S.mcol + (on ? ' on' : '');
    tray.classList.toggle('marking', on);
  }
  function setTool(id) {
    if (id === 'pick') S.tool = 'pick';
    else if (MCOL.indexOf(id) >= 0) { S.mcol = id; S.tool = 'mark'; }
    else if (S.tool === 'mark' && S.msym === id) S.tool = 'pick';
    else { S.msym = id; S.tool = 'mark'; }
    updateTools();
  }
  function renderMark(i) {
    var el = tray.querySelector('[data-i="' + i + '"]'); if (!el) return;
    var old = el.querySelector('.marks-on'); if (old) old.remove();
    var list = S.marks[i];
    if (!list || !list.length) return;
    var box = document.createElement('span');
    box.className = 'marks-on';
    box.innerHTML = list.map(function (k) { return '<i class="mn m-' + k[0] + ' c-' + k[1] + '"><svg class="ms" aria-hidden="true"><use href="#sym-' + k[1] + '"/></svg></i>'; }).join('');
    el.appendChild(box);
  }
  function toggleMark(i, el) {
    var k = S.msym + S.mcol, list = (S.marks[i] || []).slice(), at = list.indexOf(k);
    if (at >= 0) list.splice(at, 1); else if (list.length < 8) list.push(k); else { toast('한 칸에는 8개까지 표시해요'); return; }
    if (list.length) S.marks[i] = list; else delete S.marks[i];
    renderMark(i); retrigger(el, 'tap');
    SND.play('pick'); vib(5); saveRun();
  }
  function clearMarks() {
    Object.keys(S.marks).forEach(function (i) { delete S.marks[i]; renderMark(+i); });
    saveRun(); toast('표시를 모두 지웠어요');
  }
  function onTile(i, el) {
    if (!S.active || S.paused || S.lock) return;
    var t = S.pz.tiles[i];
    if (S.tool !== 'pick') { if (t && t.kind !== 'void') toggleMark(i, el); return; }
    if (!t || !t.tap) return;
    if (S.pz.multi) { toggleSel(i, el); return; }
    var xy = FX.centerOf(el);
    if (i === S.pz.answer) correct(el, t, xy); else wrong(el, xy);
  }
  // ===== 마스터: 여러 칸 고르고 확정 =====
  function ansList(pz) { return pz.multi ? pz.answers : [pz.answer]; }
  function updateConfirm() {
    var b = $('#btn-confirm');
    b.innerHTML = '확정 <em>' + S.sel.length + '</em>';
    b.disabled = !S.sel.length;
  }
  function toggleSel(i, el) {
    if (S.hintCells.indexOf(i) >= 0) return; // 힌트로 알려 준 칸은 고정
    var k = S.sel.indexOf(i);
    if (k >= 0) S.sel.splice(k, 1); else S.sel.push(i);
    el.classList.toggle('sel', k < 0);
    retrigger(el, 'tap');
    SND.play(k < 0 ? 'pick' : 'slice'); vib(8);
    updateConfirm(); saveRun();
  }
  function confirmPick() {
    if (!S.active || S.lock || S.paused || !S.pz || !S.pz.multi || !S.sel.length) return;
    var ans = S.pz.answers;
    var bad = S.sel.filter(function (i) { return ans.indexOf(i) < 0; });
    var missing = ans.filter(function (i) { return S.sel.indexOf(i) < 0; });
    if (!bad.length && !missing.length) {
      ans.forEach(function (i, j) {
        var el = tray.querySelector('[data-i="' + i + '"]'); if (!el) return;
        el.classList.remove('sel'); el.classList.add('hit');
        if (j) { var xy = FX.centerOf(el); setTimeout(function () { FX.burst(xy[0], xy[1], null, 12, 0.8); }, j * 60); }
      });
      var e0 = tray.querySelector('[data-i="' + ans[0] + '"]');
      correct(e0, S.pz.tiles[ans[0]], FX.centerOf(e0));
      return;
    }
    bad.forEach(function (i) {
      var el = tray.querySelector('[data-i="' + i + '"]'); if (el) { el.classList.remove('sel'); retrigger(el, 'miss'); }
      S.sel.splice(S.sel.indexOf(i), 1);
    });
    updateConfirm();
    toast(bad.length ? '틀린 칸 ' + bad.length + '개를 뺐어요' + (missing.length ? ' · 찾을 칸이 더 있어요' : '') : '아직 찾을 칸이 더 있어요');
    wrong(tray, null);
  }
  function hitFx(el, t, xy, power) {
    if (t.kind === 'blank' && S.pz.edges) el.classList.add('c-' + S.pz.edges.color);
    el.classList.remove('dim'); el.classList.add('hit');
    var cols = [FX.color('y'), FX.color(t.color || (S.pz.edges && S.pz.edges.color) || 'g'), FX.color('tile')];
    FX.burst(xy[0], xy[1], cols, 22 + power * 3, 1 + power * 0.08);
    FX.ring(xy[0], xy[1], FX.color('y'));
  }
  function correct(el, t, xy) {
    S.lock = true; S.pzDone = true;
    if (S.mode === 'time') {
      S.score++; S.level++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.time = Math.min(CFG.maxTime, S.time + CFG.correctBonus);
      saveRun();
      hitFx(el, t, xy, Math.min(S.combo, 8));
      SND.play('correct', S.combo - 1); vib(15);
      floatAt(xy[0], xy[1] - 20, '+' + CFG.correctBonus + '초', 'plus');
      retrigger($('#score-tile'), 'bump'); retrigger($('#bar-wrap'), 'hit');
      if (S.combo >= 3) { var cb = $('#combo'); cb.textContent = S.combo + ' 연속!'; retrigger(cb, 'show'); }
      updateHud();
      setTimeout(function () {
        if (!S.running) return;
        tray.classList.add('out');
        setTimeout(function () { if (S.running) nextTimePuzzle(); }, 210);
      }, 330);
      return;
    }
    // 하트 모드
    S.active = false;
    if (S.mode === 'expert' && S.part < S.seq.length - 1) { // 익스퍼트: 첫 번째 규칙을 풀면 두 번째 규칙으로
      hitFx(el, t, xy, 4); SND.play('correct', 2); vib(15);
      S.part = 1; data.saves.expert = snapOf(); persist();
      setTimeout(function () {
        showBanner('두 번째 규칙!'); tray.classList.add('out');
        setTimeout(dealHard, 230);
      }, 600);
      return;
    }
    clearRun(S.mode);
    var perfect = S.mistakes === 0;
    var coins = S.mode === 'stage' ? (perfect ? CFG.coinStagePerfect : CFG.coinStage) :
      S.mode === 'expert' ? (perfect ? CFG.coinExpertPerfect : CFG.coinExpert) :
      S.mode === 'master' ? (perfect ? CFG.coinMasterPerfect : CFG.coinMaster) : (perfect ? CFG.coinPracticePerfect : CFG.coinPractice);
    hitFx(el, t, xy, perfect ? 8 : 3);
    SND.play('correct', perfect ? 4 : 0); vib(15);
    floatAt(xy[0], xy[1] - 20, '+' + coins + ' 코인', 'plus');
    give({ coins: coins });
    addAdMeter(1);
    if (S.mode === 'stage') {
      S.inRun = false;
      var r = S.srule, cleared = data.rlv[r] || 1, prevMax = maxCleared(), wasOpen = unlockedRules().length;
      data.rlv[r] = cleared + 1;
      data.clearsTotal++;
      var gotPack = data.clearsTotal % CFG.packEvery === 0;
      if (gotPack) data.packs++;
      var xp = gainXp(r, perfect ? 15 : 10);
      var frame = FRAME_AT.filter(function (f) { return prevMax < f[0] && maxCleared() >= f[0]; })[0];
      var newRule = unlockedRules().length > wasOpen ? unlockedRules()[unlockedRules().length - 1] : null;
      data.bestStage = Math.max(data.bestStage, data.clearsTotal); persist();
      P.submitScore(data.clearsTotal, P.leaderboards.stage);
      setTimeout(function () {
        SND.play('clear'); stageSheet(true, cleared, perfect, coins, gotPack, { xp: xp, frame: frame, newRule: newRule });
        if (xp.t1 > xp.t0) setTimeout(function () { medalUp(xp); }, 900);
      }, 650);
    } else if (isHard()) {
      S.inRun = false;
      var hl = S.hlevel; data[S.mode][S.hkey] = hl + 1;
      var rs = S.mode === 'expert' ? (S.hkey === 'random' ? (S.seq[0].indexOf('+') > 0 ? S.seq[0].split('+') : S.seq) : S.hkey.split('+')) : S.rule.split('+');
      var ups = rs.map(function (r2) { return gainXp(r2, S.mode === 'expert' ? 8 : 12); });
      persist();
      setTimeout(function () {
        SND.play('clear'); hardSheet(true, hl, perfect, coins, ups);
        var up = ups.filter(function (x) { return x.t1 > x.t0; })[0];
        if (up) setTimeout(function () { medalUp(up); }, 900);
      }, 650);
    } else {
      S.solved++; persist();
      setTimeout(function () {
        showBanner(perfect ? '한 번에 성공!' : S.mistakes >= CFG.ticketAtMiss ? (boosted() ? '성공! (부스터 중 · 티켓 그대로)' : '성공! (티켓 1장 썼어요)') : '성공! 티켓 그대로');
        tray.classList.add('out');
        setTimeout(function () {
          maybeAd(function () {
            if (!needTicket(true)) { practiceEnd(); return; }
            nextPracticePuzzle();
          });
        }, 260);
      }, 500);
    }
  }
  function wrong(el, xy) {
    S.combo = 0;
    retrigger(el, 'miss'); retrigger(tray, 'shake'); retrigger($('#flash'), 'on');
    SND.play('wrong'); vib(70);
    if (S.mode === 'time') {
      S.time = Math.max(0, S.time - CFG.wrongPenalty);
      retrigger($('#bar-wrap'), 'miss');
      var tr = $('#hud-time').getBoundingClientRect();
      floatAt(tr.left + tr.width / 2, tr.bottom + 6, '-' + CFG.wrongPenalty + '초', 'minus');
      updateHud(); saveRun();
      return;
    }
    S.mistakes++; S.hearts--;
    renderHearts(true);
    if (S.mistakes === CFG.ticketAtMiss && !boosted()) {
      spendTicket();
      var tk = $('#hud-tk'); retrigger(tk, 'spent');
      var tb = tk.getBoundingClientRect();
      setTimeout(function () { floatAt(tb.left + tb.width / 2, tb.bottom + 8, '티켓 -1', 'minus'); }, 380);
    }
    setTimeout(function () { SND.play('heart'); }, 120);
    var hb = $('#hearts').getBoundingClientRect();
    floatAt(hb.left + hb.width / 2, hb.bottom + 6, '하트 -1', 'minus');
    if (S.hearts <= 0) {
      S.active = false; S.lock = true; S.inRun = false;
      clearRun(S.mode);
      addAdMeter(1); persist();
      ansList(S.pz).forEach(function (i) {
        var a = tray.querySelector('[data-i="' + i + '"]');
        if (a) { a.classList.remove('sel'); if (S.pz.edges) a.classList.add('c-' + S.pz.edges.color); a.classList.add('reveal'); }
      });
      setTimeout(function () {
        SND.play('fail');
        if (S.mode === 'stage') stageSheet(false, data.rlv[S.srule], false, 0); else if (isHard()) hardSheet(false, S.hlevel, false, 0); else practiceEnd();
      }, 1100);
    } else saveRun();
  }
  tray.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.tile'); if (!b) return;
    e.preventDefault(); onTile(+b.dataset.i, b);
  });
  tray.addEventListener('click', function (e) {
    if (e.detail !== 0) return;
    var b = e.target.closest('.tile'); if (b) onTile(+b.dataset.i, b);
  });

  // ===== 힌트: 약한 → 강한 → 정답 =====
  function applyHint() {
    if (!S.pz || !S.hintLv) return;
    if (S.pz.multi) {
      S.hintCells.forEach(function (i) { var el = tray.querySelector('[data-i="' + i + '"]'); if (el) el.classList.add('sel', 'reveal'); });
      return;
    }
    var n = S.pz.n, ans = S.pz.answer, row = Math.floor(ans / n);
    var cand = Array.prototype.slice.call(tray.querySelectorAll('.tile')).filter(function (el) { return !el.classList.contains('off'); });
    var keep;
    if (S.hintLv === 1) keep = cand.filter(function (el) { return Math.floor(+el.dataset.i / n) === row; });
    else if (S.hintLv === 2) {
      if (S.hintDecoy == null) {
        var others = cand.filter(function (el) { return +el.dataset.i !== ans; });
        var sameRow = others.filter(function (el) { return Math.floor(+el.dataset.i / n) === row; });
        var dc = pick(sameRow.length ? sameRow : others);
        S.hintDecoy = dc ? +dc.dataset.i : -1;
      }
      keep = cand.filter(function (el) { return +el.dataset.i === ans || +el.dataset.i === S.hintDecoy; });
    } else keep = cand.filter(function (el) { return +el.dataset.i === ans; });
    cand.forEach(function (el) { el.classList.toggle('dim', keep.indexOf(el) < 0); });
    if (S.hintLv === 3) keep.forEach(function (el) { el.classList.add('reveal'); });
  }
  function useHint() {
    if (!S.active || S.lock || S.paused || !S.pz || S.hintLv >= 3) return;
    if (E.hints <= 0) { needModal('hint', true); return; }
    if (S.pz.multi) {
      var left = S.pz.answers.filter(function (i) { return S.sel.indexOf(i) < 0; });
      if (!left.length) { toast('정답 칸은 이미 모두 골랐어요'); return; }
      E.hints--; S.hintLv++; persist(); refreshWallet();
      var hc = pick(left); S.sel.push(hc); S.hintCells.push(hc);
      applyHint(); updateConfirm();
      toast('정답 칸 하나를 골라 두었어요');
      SND.play('hint'); updateHintBtn(); saveRun();
      return;
    }
    E.hints--; S.hintLv++; persist(); refreshWallet();
    applyHint();
    toast(['', '정답은 밝은 가로줄 안에 있어요', '밝은 두 칸 가운데 하나예요', '빛나는 칸이 정답이에요'][S.hintLv]);
    SND.play('hint');
    var xy = FX.centerOf($('#btn-hint')); FX.burst(xy[0], xy[1], [FX.color('y'), FX.color('tile')], 12, 0.7);
    updateHintBtn();
    saveRun();
  }

  // ===== 타임어택 =====
  function tick(ts) {
    if (!S.running) return;
    if (!S.paused) {
      S.time -= Math.min(0.1, (ts - S.last) / 1000);
      if (S.time <= 0) { S.time = 0; updateHud(); timeUp(); return; }
      updateHud();
      if (ts - S.lastSave > 1000) { S.lastSave = ts; saveRun(); }
    }
    S.last = ts;
    S.raf = requestAnimationFrame(tick);
  }
  function countdown() {
    return new Promise(function (resolve) {
      var el = $('#count'), c = 3;
      function num() { el.textContent = c; retrigger(el, 'go'); SND.play('tick'); }
      el.hidden = false; num();
      var t = setInterval(function () {
        c--;
        if (c > 0) return num();
        clearInterval(t);
        el.textContent = '시작!'; retrigger(el, 'go'); SND.play('go');
        var xy = FX.centerOf(tray);
        FX.ring(xy[0], xy[1], FX.color('y')); FX.burst(xy[0], xy[1], null, 24, 1.1);
        setTimeout(function () { el.hidden = true; resolve(); }, 380);
      }, 620);
    });
  }
  function runTimer() {
    S.running = true; S.paused = false;
    S.last = performance.now(); S.lastSave = S.last;
    S.raf = requestAnimationFrame(tick);
  }
  // 타임어택 규칙 고르기 — 열린 규칙은 새로 열릴 때 자동으로 켜진다
  function timeAllowed() { return RULE_ORDER.filter(function (r) { return TIME_BASE.indexOf(r) >= 0 || data.learned[r]; }); }
  function syncTimePick() {
    var allow = timeAllowed();
    if (!data.timePick) data.timePick = allow.slice();
    allow.forEach(function (r) {
      if (!data.timeKnown[r]) { data.timeKnown[r] = true; if (data.timePick.indexOf(r) < 0) data.timePick.push(r); }
    });
    data.timePick = data.timePick.filter(function (r) { return allow.indexOf(r) >= 0; });
    if (!data.timePick.length) data.timePick = allow.slice();
  }
  function timePickHTML() {
    var allow = timeAllowed();
    return RULE_ORDER.map(function (r) {
      var ok = allow.indexOf(r) >= 0, on = ok && data.timePick.indexOf(r) >= 0;
      return '<button class="pchip' + (ok ? '' : ' locked') + '" data-act="tpick" data-id="' + r + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + '>' +
        icon(ok ? r : 'lock') + '<span>' + (ok ? RULE_META[r].name : '잠김') + '</span></button>';
    }).join('');
  }
  function timeSheet() {
    syncTimePick(); persist();
    var sv = data.saves.time, h = '<h2>타임어택</h2>';
    if (sv) h += '<button class="btn go" data-act="time-resume">이어서 하기 <small>남은 ' + Math.ceil(sv.time) + '초 · ' + sv.score + '칸</small></button>' +
      '<p class="sub small">새로 시작하면 이어하던 판은 지금 기록(' + sv.score + '칸)으로 끝나요</p>';
    h += '<p class="sub">이번 판에 나올 규칙을 골라요 (여러 개 가능)</p><div class="pick" id="tpick">' + timePickHTML() + '</div>' +
      '<button class="btn primary" data-act="time-go">' + (sv ? '새로 시작' : '시작') + ' <small class="cost">' + icon('ticket') + '1</small></button>' +
      '<button class="btn ghost" data-act="modal-close">닫기</button>';
    openModal(h);
  }
  function toggleTimePick(r) {
    var i = data.timePick.indexOf(r);
    if (i >= 0) { if (data.timePick.length > 1) data.timePick.splice(i, 1); else { toast('규칙은 하나 이상 골라요'); return; } }
    else data.timePick.push(r);
    persist();
    var box = $('#tpick'); if (box) box.innerHTML = timePickHTML();
  }
  function finishSavedTime() {
    var sv = data.saves.time; if (!sv) return;
    clearRun('time');
    recordScore(sv.score, sv.runId);
    var coins = Math.floor(sv.score / CFG.coinTimeDiv) - (sv.coinsGiven || 0);
    if (coins > 0) give({ coins: coins });
    addAdMeter(3); persist();
    if (sv.score > 0) toast('이어하던 판을 ' + sv.score + '칸으로 기록했어요');
  }
  function startTime() {
    if (data.saves.time) finishSavedTime();
    if (!needTicket()) return;
    syncTimePick();
    spendTicket();
    timeCoinsGiven = 0;
    Object.assign(S, { mode: 'time', active: false, running: false, paused: false, inRun: true, level: 1, score: 0, combo: 0, maxCombo: 0,
      time: CFG.startTime, rewardUsed: false, rule: null, runId: Date.now(), isBest: false, lastSec: 99, timeRules: data.timePick.slice() });
    go('scr-play', setupHud).then(countdown).then(function () { nextTimePuzzle(); runTimer(); });
  }
  function recordScore(score, runId) {
    data.hall = data.hall.filter(function (r) { return r.id !== runId; });
    var best = score > 0 && score > bestScore(runId);
    if (score > 0) {
      data.hall.push({ id: runId, score: score, date: today() });
      data.hall.sort(function (a, b) { return b.score - a.score || a.id - b.id; });
      data.hall = data.hall.slice(0, CFG.hallSize);
    }
    persist();
    if (score > 0) P.submitScore(score, P.leaderboards.timeattack);
    return best;
  }
  function recordResult() { S.isBest = recordScore(S.score, S.runId); }
  function countUp(el, to, done) {
    if (FX.reduce || to === 0) { el.textContent = to; if (done) done(); return; }
    var dur = Math.min(1300, 250 + to * 70), t0 = performance.now(), shown = -1;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (v !== shown) { shown = v; el.textContent = v; SND.play('count', v); }
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  var timeCoinsGiven = 0;
  function endTime(head) {
    S.running = false; S.paused = false; S.active = false; S.lock = true; S.inRun = false;
    cancelAnimationFrame(S.raf); SND.duck(false); closePeek();
    clearRun('time');
    var a = S.pz && tray.querySelector('[data-i="' + S.pz.answer + '"]');
    if (a) { if (S.pz.edges) a.classList.add('c-' + S.pz.edges.color); a.classList.add('reveal'); }
    SND.play('end'); vib(140);
    recordResult();
    addAdMeter(3); persist();
    // 코인: 이어하기 했으면 늘어난 만큼만 더 준다
    var coins = Math.floor(S.score / CFG.coinTimeDiv) - timeCoinsGiven;
    if (coins > 0) { give({ coins: coins }); timeCoinsGiven += coins; }
    setTimeout(function () {
      go('scr-result', function () {
        $('#res-head').textContent = head;
        $('#res-score').textContent = '0';
        $('#res-best').hidden = !S.isBest;
        $('#res-combo').textContent = S.maxCombo >= 2 ? '최고 ' + S.maxCombo + '연속' : '';
        var rank = data.hall.findIndex(function (r) { return r.id === S.runId; });
        $('#res-rank').textContent = rank >= 0 ? '명예의 전당 ' + (rank + 1) + '위' : (S.score > 0 ? '명예의 전당 10위 안에는 못 들었어요' : '다음 판엔 한 칸부터 찾아봐요');
        $('#res-coin').innerHTML = timeCoinsGiven > 0 ? icon('coin') + '+' + timeCoinsGiven + ' 코인' : '';
        $('#btn-cont').hidden = S.rewardUsed || !P.features.ads;
      }).then(function () {
        countUp($('#res-score'), S.score, function () { if (S.isBest) { SND.play('best'); FX.confetti(); } });
      });
    }, 700);
  }
  function timeUp() { endTime('시간 끝!'); }
  function continueWithAd() {
    if (S.rewardUsed) return;
    SND.duck(true);
    P.showRewarded().then(function (ok) {
      SND.duck(false);
      if (!ok) { toast('광고를 끝까지 보면 15초를 더 받아요'); return; }
      S.rewardUsed = true; S.time = CFG.rewardBonus; S.combo = 0; S.lastSec = 99; S.inRun = true;
      go('scr-play', setupHud).then(countdown).then(function () { nextTimePuzzle(); runTimer(); });
    });
  }

  // ===== v0.6 익스퍼트 · 마스터 =====
  // 익스퍼트: 열린 규칙 두 개를 한 단계에 이어서 푼다(하트 3개를 같이 씀). 새 규칙이 열릴 때마다 조합이 늘어남.
  // 마스터: 한 규칙에서 맞는 칸을 '모두' 골라 확정. 다 골라도 자동으로 끝나지 않는다.
  var HARD_NAME = { expert: '익스퍼트', master: '마스터' };
  var COMBO_TXT = { one: '한 판 · 한 칸 찾기', union: '한 판 · 칸 모두 찾기', split: '두 판 · 판마다 2칸 이상' };
  var HARD = { kind: 'expert', key: null, msel: [] };
  function isHard() { return S.mode === 'expert' || S.mode === 'master'; }
  // 테스트용: 테스트 빌드에서만 마스터를 잠시 열어 둠 (출시 전에 지울 것)
  var TEST_OPEN_MASTER = P.target === 'web-test';
  function hardOpen(kind) {
    if (kind === 'master') return TEST_OPEN_MASTER || (maxCleared() >= CFG.masterAt && masterTriples().length > 0);
    return maxCleared() >= CFG.expertAt;
  }
  // 잠겨 있을 때 안내 (마스터는 20단계 + 섞을 수 있는 세 규칙 조합이 열려야 함)
  function hardLockText(kind) {
    if (kind === 'expert' || maxCleared() < CFG.masterAt) return (kind === 'expert' ? CFG.expertAt : CFG.masterAt) + '단계를 깨면 열려요';
    return '규칙을 더 열면 열려요';
  }
  // 단계 도전에서 10단계마다 다음 규칙이 열린다 (최고 기록 기준)
  function unlockedRules() { return RULE_ORDER.filter(ruleOpen); }
  function rulePairs() {
    var u = unlockedRules(), o = [];
    for (var j = 1; j < u.length; j++) for (var i = 0; i < j; i++) o.push(u[i] + '+' + u[j]);
    return o;
  }
  function hardLabel(key) { return key === 'random' ? '랜덤' : key.split('+').map(function (r) { return RULE_META[r].name; }).join(' + '); }
  // v0.7: 4단계마다 한 줄씩
  function expertPlan(lv) { return { lv: Math.min(30, 8 + Math.round(lv * 1.5)), n: Math.min(10, 5 + Math.floor((lv - 1) / 4)) }; }
  function masterPlan(lv) { return { lv: Math.min(30, 6 + lv), n: Math.min(10, 5 + Math.floor((lv - 1) / 4)), k: Math.min(6, 2 + Math.floor((lv - 1) / 3)) }; }
  function masterRules() { return TEST_OPEN_MASTER ? RULE_ORDER.slice() : unlockedRules(); } // 테스트: 마스터는 8규칙 모두
  // v0.12 마스터: 열린 규칙으로 만들 수 있는 세 규칙 조합
  function masterTriples() { var u = masterRules(); return Z.TRIPLES.filter(function (k) { return k.split('+').every(function (r) { return u.indexOf(r) >= 0; }); }); }
  function hardOptions(kind) { return (kind === 'expert' ? rulePairs().reverse() : masterTriples()).concat(['random']); }
  function mselKey() { return HARD.msel.length === 3 ? Z.tripleKey(HARD.msel) : null; }
  // 지금 고른 규칙에 r을 더해도 만들 수 있는 조합이 남는지
  function mselCan(r) {
    var sel = HARD.msel.concat([r]);
    return masterTriples().some(function (k) { var a = k.split('+'); return sel.every(function (x) { return a.indexOf(x) >= 0; }); });
  }
  function setupMasterPick() {
    var u = masterRules(), store = data.master;
    HARD.msel = HARD.msel.filter(function (r) { return u.indexOf(r) >= 0; });
    var mk = mselKey();
    if (!mk && HARD.key !== 'random' && HARD.msel.length === 0) HARD.key = 'random';
    if (mk) HARD.key = mk; else if (HARD.msel.length) HARD.key = null;
    var h = '<button class="hchip rnd" data-act="hpick" data-id="random" aria-pressed="' + (HARD.key === 'random') + '">' +
      '<span class="hc-ic">' + icon('dice') + '</span><span class="hc-t"><b>랜덤</b><small>단계마다 세 규칙이 바뀌어요 · 단계 ' + (store.random || 1) + '</small></span></button>';
    h += '<p class="sub small mp-tip">또는 규칙 <b>3개</b>를 골라요</p><div class="pick mpick">' + RULE_ORDER.map(function (r) {
      var open = u.indexOf(r) >= 0, on = HARD.msel.indexOf(r) >= 0;
      var ok = open && (on || (HARD.msel.length < 3 && mselCan(r)));
      return '<button class="pchip' + (ok ? '' : ' locked') + '" data-act="mpick" data-id="' + r + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + '>' +
        icon(open ? r : 'lock') + '<span>' + (open ? RULE_META[r].name : '아직 몰라요') + '</span></button>';
    }).join('') + '</div>';
    h += '<p class="sub small mp-now">' + (mk ? hardLabel(mk) + ' · 단계 ' + (store[mk] || 1) : HARD.key === 'random' ? '' : '규칙을 ' + (3 - HARD.msel.length) + '개 더 골라요') + '</p>';
    $('#hard-pick').innerHTML = h;
    $('#btn-hard-go').disabled = !HARD.key;
  }
  function setupHard() {
    var kind = HARD.kind, opts = hardOptions(kind), store = data[kind];
    $('#btn-hard-go').disabled = false;
    if (kind === 'master') HARD.msel = HARD.msel || [];
    else if (opts.indexOf(HARD.key) < 0) HARD.key = opts[0];
    $('#hard-title').textContent = HARD_NAME[kind];
    $('#hard-lead').innerHTML = kind === 'expert'
      ? '열린 규칙 <b>두 개</b>를 한 판에 섞어요. 대부분 두 규칙을 <b>모두 지키는 한 칸</b>을 찾고, 조합에 따라 두 규칙의 칸을 <b>모두</b> 찾아요.'
      : '열린 규칙 <b>세 개</b>를 한 판에 섞어요. 세 규칙을 <b>모두 지키는 칸은 딱 하나</b>예요. 두 규칙만 보면 후보가 여러 개라 세 단서를 다 써야 해요.';
    if (kind === 'master') setupMasterPick();
    else $('#hard-pick').innerHTML = opts.map(function (k) {
      var on = k === HARD.key, ics = k === 'random' ? icon('dice') : k.split('+').map(function (r) { return icon(r); }).join('');
      return '<button class="hchip' + (k === 'random' ? ' rnd' : '') + '" data-act="hpick" data-id="' + k + '" aria-pressed="' + on + '">' +
        '<span class="hc-ic">' + ics + '</span><span class="hc-t"><b>' + hardLabel(k) + '</b><small>' +
        (k === 'random' ? (kind === 'expert' ? '단계마다 조합이 바뀌어요 · ' : '단계마다 규칙이 바뀌어요 · ') : kind === 'expert' ? COMBO_TXT[Z.comboPlan.apply(null, k.split('+')).mode] + ' · ' : '') +
        '단계 ' + (store[k] || 1) + '</small></span></button>';
    }).join('');
    var sv = data.saves[kind], rb = $('#btn-hard-resume');
    rb.hidden = !sv;
    if (sv) rb.innerHTML = '이어서 하기 <small>' + hardLabel(sv.hkey) + ' · 단계 ' + sv.hlevel + '</small>';
    $('#hard-note').textContent = (kind === 'expert' ? '단계 도전에서 새 규칙이 열릴 때마다 조합이 늘어나요. ' : '단계가 오를수록 판이 커져요. 한 판에 함께 둘 수 없는 규칙끼리는 고를 수 없어요. ') +
      (sv ? '새로 시작하면 이어하던 판은 사라져요. ' : '') + '하트를 2개 잃으면 티켓 1장을 써요.';
  }
  function startHard(kind, key) {
    if (!needTicket()) return;
    var begin = function () {
      clearRun(kind);
      Object.assign(S, { mode: kind, active: false, running: false, paused: false, inRun: true, rule: null, hkey: key, hlevel: data[kind][key] || 1, part: 0, seq: null });
      go('scr-play', setupHud).then(nextHardPuzzle);
    };
    if (kind === 'master' && !data.masterIntro) {
      openModal('<p class="rs-kicker" style="text-align:center">새 난이도</p><h2>마스터</h2>' +
        '<ul class="intro-list"><li>한 판에 규칙 <b>세 개</b>가 함께 나와요. 단서에 세 규칙이 한 줄씩 적혀 있어요.</li>' +
        '<li>세 규칙을 <b>모두</b> 지키는 칸은 딱 하나예요. 두 규칙만 보면 후보가 여러 개예요.</li>' +
        '<li>판 위의 작은 표시: 오른쪽 위 동그라미 숫자 = 거리 숫자, 칸 가장자리 삼각형 = 화살표.</li>' +
        '<li>규칙 아이콘을 꾹 누르면 세 규칙 설명이 함께 보여요.</li></ul>' +
        '<button class="btn primary" data-act="modal-next">시작하기</button>', function () { data.masterIntro = true; persist(); begin(); });
    } else begin();
  }
  function nextHardPuzzle() {
    S.hearts = CFG.hearts; S.mistakes = 0; S.part = 0;
    if (S.mode === 'expert') {
      var key = S.hkey === 'random' ? pick(rulePairs()) : S.hkey, pr = key.split('+');
      // 한 판에 섞을 수 있으면 한 판(키 그대로), 안 되면 두 판(판마다 2칸 이상)
      S.seq = Z.comboPlan(pr[0], pr[1]).mode === 'split' ? (Math.random() < 0.5 ? pr : [pr[1], pr[0]]) : [key];
    } else S.seq = [S.hkey === 'random' ? chooseFrom(masterTriples(), S.rule) : S.hkey];
    updateHud();
    showBanner(HARD_NAME[S.mode] + ' ' + S.hlevel);
    dealHard();
  }
  function dealHard() {
    S.rule = S.seq[S.part];
    if (S.mode === 'expert') {
      var p = expertPlan(S.hlevel);
      if (S.rule.indexOf('+') > 0) {
        var ab = S.rule.split('+'), cz = Z.makeCombo(ab[0], ab[1], p.lv, p.n);
        if (cz) { deal(cz); return; }
        S.seq = ab; S.part = 0; S.rule = ab[0]; // 드물게 못 만들면 두 판으로
      }
      deal(Z.makeMulti(S.rule, p.lv, p.n, 2));
    }
    else {
      // v0.12 마스터: 세 규칙을 모두 지키는 한 칸
      var m = masterPlan(S.hlevel), tz = Z.makeTriple(S.rule.split('+'), m.lv, m.n);
      for (var g = 0; !tz && g < 5; g++) tz = Z.makeTriple(S.rule.split('+'), m.lv, Math.max(5, m.n - 1 - g));
      deal(tz);
    }
  }
  function hardSheet(win, lv, perfect, coins, ups) {
    var head = '<p class="ps-kicker">' + HARD_NAME[S.mode] + ' · ' + hardLabel(S.hkey) + '</p>';
    var h = win
      ? head + '<h2 class="ps-big">단계 ' + lv + ' 클리어!</h2><div class="ps-hearts">' + $('#hearts').innerHTML + '</div>' +
        '<p class="ps-line">' + icon('ticket') + (perfect ? '한 번에 성공! 티켓은 그대로예요' : S.mistakes >= CFG.ticketAtMiss ? (boosted() ? '티켓 부스터 중이라 티켓은 그대로예요' : '하트를 2개 잃어서 티켓 1장을 썼어요') : '하트 1개만 잃어서 티켓은 그대로예요') + '</p>' +
        '<p class="gain">' + icon('coin') + '+' + coins + ' 코인</p>' + (ups || []).map(xpRowHTML).join('') + '<button class="btn primary" data-act="hard-next">다음 단계</button>'
      : head + '<h2 class="ps-big sad">아쉬워요</h2><p class="ps-line">' + icon('ticket') + '하트를 모두 잃었어요 · ' + (boosted() ? '티켓 부스터 중이라 티켓은 그대로예요' : '티켓 1장을 썼어요') + '</p>' +
        '<button class="btn primary" data-act="hard-next">다시 도전</button>';
    h += '<button class="btn ghost" data-act="home">처음으로</button>';
    $('#psheet-box').innerHTML = h; $('#psheet').hidden = false;
    if (win) { var xy = FX.centerOf($('#psheet-box')); FX.burst(xy[0], xy[1] - 60, null, 40, 1.3); if (perfect) FX.confetti(); }
  }
  function hardNext() {
    if (!needTicket(true)) return;
    $('#psheet').hidden = true;
    maybeAd(function () {
      S.inRun = true; S.hlevel = data[S.mode][S.hkey] || 1;
      tray.classList.add('out');
      setTimeout(nextHardPuzzle, 220);
    });
  }

  // ===== 단계 도전 (v0.8: 규칙 고르기 → 그 규칙의 단계) =====
  function cleared(r) { return (data.rlv[r] || 1) - 1; }
  function maxCleared() { return Math.max.apply(null, RULE_ORDER.map(cleared)); }
  // 앞 규칙 10단계를 깨면 열림. 이미 해 본 규칙(순서가 바뀌기 전 기록 포함)은 계속 열려 있음
  function ruleOpen(r) { var i = RULE_ORDER.indexOf(r); return i === 0 || cleared(r) > 0 || cleared(RULE_ORDER[i - 1]) >= 10; }
  function gainXp(r, amt) {
    var b = data.xp[r] || 0, a = b + amt; data.xp[r] = a;
    return { rule: r, amt: amt, before: b, after: a, t0: Medals.tierOf(b), t1: Medals.tierOf(a) };
  }
  function xpRowHTML(x) {
    var pg = Medals.progress(x.after);
    return '<div class="xp-row"><span class="xp-md">' + Medals.svg(x.rule, x.t1) + '</span><span class="xp-t"><b>' + RULE_META[x.rule].name + ' 메달 <em>+' + x.amt + ' XP</em></b>' +
      '<i class="xp-bar"><i style="width:' + Math.round(pg.pct * 100) + '%"></i></i><small>' + (pg.need ? Medals.TIERS[pg.tier].name + ' · 다음까지 ' + pg.need + ' XP' : '전설 메달 완성!') + '</small></span></div>';
  }
  var TIER_DESC = ['', '첫 메달이에요. 테두리만 있는 새싹 메달!', '메달이 2/6만큼 차올랐어요.', '메달이 4/6까지 차올랐어요.', '메달이 가득 찼어요! 아래에 별이 붙었어요.',
    '겉면에 무지갯빛 테가 둘렀어요.', '뒤에서 후광이 비춰요.', '전설 메달! 반짝이와 빛이 스쳐요.'];
  function medalUp(x) {
    openModal('<p class="rs-kicker" style="text-align:center">메달이 자랐어요!</p><div class="mu-row"><span class="mu-old">' + Medals.svg(x.rule, x.t0) + '</span><span class="mu-arrow">›</span><span class="mu-new">' + Medals.svg(x.rule, x.t1) + '</span></div>' +
      '<h2>' + RULE_META[x.rule].name + ' · ' + Medals.TIERS[x.t1].name + ' 메달</h2><p class="sub">' + TIER_DESC[x.t1] + '</p><button class="btn primary" data-act="modal-close">좋아요</button>');
    SND.play('best'); FX.confetti();
  }
  function medalDetail(r) {
    var xp = data.xp[r] || 0, pg = Medals.progress(xp), t = pg.tier;
    openModal('<div class="md-big">' + Medals.svg(r, t) + '</div><h2>' + RULE_META[r].name + ' 메달</h2>' +
      '<p class="sub">' + (t ? Medals.TIERS[t].name + ' 메달 · ' + xp + ' XP' : '이 규칙의 단계를 깨면 메달을 받아요') + '</p>' +
      (pg.need ? '<i class="xp-bar big"><i style="width:' + Math.round(pg.pct * 100) + '%"></i></i><p class="sub small">다음 단계(' + Medals.TIERS[t + 1].name + ')까지 ' + pg.need + ' XP</p>' : '') +
      '<div class="md-steps">' + Medals.TIERS.slice(1).map(function (T, i) { return '<span class="' + (i + 1 <= t ? 'on' : '') + '">' + Medals.svg(r, i + 1 <= t ? i + 1 : 0) + '<small>' + T.name + '</small></span>'; }).join('') + '</div>' +
      '<p class="sub small">경험치: 단계 클리어 10(실수 없으면 15) · 익스퍼트 8 · 마스터 12</p><button class="btn" data-act="modal-close">닫기</button>');
  }
  function medalsHTML() {
    return '<h3 class="sec">메달</h3><div class="mgrid">' + RULE_ORDER.map(function (r) {
      var t = Medals.tierOf(data.xp[r] || 0);
      return '<button class="mcell" data-act="medal" data-id="' + r + '">' + Medals.svg(r, t) + '<b>' + RULE_META[r].name + '</b><small>' + (t ? Medals.TIERS[t].name : '아직 없어요') + '</small></button>';
    }).join('') + '</div>';
  }
  function setupRules() {
    var sv = data.saves.stage;
    $('#rule-cards').innerHTML = RULE_ORDER.map(function (r, i) {
      var open = ruleOpen(r), L = data.rlv[r] || 1, xp = data.xp[r] || 0, pg = Medals.progress(xp);
      if (!open) return '<div class="rcard locked"><span class="rc-md">' + Medals.svg(r, 0) + '</span><span class="rc-t"><b>' + icon('lock') + ' ???</b><small>' + RULE_META[RULE_ORDER[i - 1]].name + ' 10단계를 깨면 열려요</small></span></div>';
      var resume = sv && sv.srule === r;
      return '<button class="rcard' + (resume ? ' resume' : '') + '" data-act="rpick" data-id="' + r + '"><span class="rc-md">' + Medals.svg(r, pg.tier) + '</span>' +
        '<span class="rc-t"><b>' + icon(r, 'rc-ic') + RULE_META[r].name + '</b><small>' + (resume ? '이어하기 · ' : '') + L + '단계 · ' + bandOf(L) + '</small>' +
        '<i class="xp-bar"><i style="width:' + Math.round(pg.pct * 100) + '%"></i></i></span><em class="rc-go">' + (resume ? '이어하기' : '시작') + '</em></button>';
    }).join('');
    $('#rules-note').textContent = '규칙마다 단계가 따로 올라요. 10단계를 깨면 다음 규칙이 열리고, 아무 규칙이나 10·20·30·40단계를 깨면 프로필 테두리를 받아요.' + (sv ? ' 다른 규칙을 시작하면 이어하던 판은 사라져요.' : '');
  }
  function startStage(r) {
    var sv = data.saves.stage;
    if (sv && sv.srule === r) { resumeRun('stage'); return; }
    if (!needTicket()) return;
    if (sv) clearRun('stage');
    Object.assign(S, { mode: 'stage', active: false, running: false, paused: false, inRun: true, rule: null, srule: r });
    go('scr-play', setupHud).then(nextStagePuzzle);
  }
  function stageSheet(win, st, perfect, coins, gotPack, ex) {
    ex = ex || {};
    var nm = RULE_META[S.srule].name;
    var h = win
      ? '<p class="ps-kicker">' + nm + ' · ' + st + '단계 · ' + bandOf(st) + '</p><h2 class="ps-big">클리어!</h2>' +
        '<div class="ps-hearts">' + $('#hearts').innerHTML + '</div>' +
        '<p class="ps-line">' + icon('ticket') + (perfect ? '한 번에 성공! 티켓은 그대로예요' : S.mistakes >= CFG.ticketAtMiss ? (boosted() ? '티켓 부스터 중이라 티켓은 그대로예요' : '하트를 2개 잃어서 티켓 1장을 썼어요') : '하트 1개만 잃어서 티켓은 그대로예요') + '</p>' +
        '<p class="gain">' + icon('coin') + '+' + coins + ' 코인</p>' +
        (ex.xp ? xpRowHTML(ex.xp) : '') +
        (ex.frame ? '<div class="ps-pack">' + Collect.avatarHTML({ avatar: data.look.avatar, frame: ex.frame[1] }, 'sm') + '<span><b>보상: ' + ex.frame[2] + '!</b><small>' + ex.frame[0] + '단계 클리어 보상 · 꾸미기에서 바꿔요</small></span></div>' : '') +
        (ex.newRule ? '<div class="ps-pack"><span class="rs-ic">' + icon(ex.newRule) + '</span><span><b>새 규칙: ' + RULE_META[ex.newRule].name + '</b><small>단계 도전에서 고를 수 있어요</small></span></div>' : '') +
        (gotPack ? '<div class="ps-pack">' + Collect.packMini() + '<span><b>카드팩을 받았어요!</b><small>뜯어서 카드·가구·퍼즐 칸을 모아요</small></span></div>' +
          '<button class="btn go" data-act="pack-open">지금 뜯기</button>' : '') +
        '<button class="btn primary" data-act="stage-next">다음 단계</button>'
      : '<p class="ps-kicker">' + nm + ' · ' + st + '단계</p><h2 class="ps-big sad">아쉬워요</h2>' +
        '<p class="ps-line">' + icon('ticket') + '하트를 모두 잃었어요 · ' + (boosted() ? '티켓 부스터 중이라 티켓은 그대로예요' : '티켓 1장을 썼어요') + '</p>' +
        '<button class="btn primary" data-act="stage-next">다시 도전</button>';
    h += '<button class="btn ghost" data-act="rules-back">규칙 고르기</button>';
    $('#psheet-box').innerHTML = h;
    $('#psheet').hidden = false;
    if (win) { var xy = FX.centerOf($('#psheet-box')); FX.burst(xy[0], xy[1] - 60, null, 40, 1.3); if (perfect) FX.confetti(); }
    if (gotPack) setTimeout(function () { SND.play('newcard'); }, 500);
  }
  function stageNext() {
    if (!needTicket(true)) return;
    $('#psheet').hidden = true;
    maybeAd(function () {
      S.inRun = true;
      tray.classList.add('out');
      setTimeout(nextStagePuzzle, 220);
    });
  }

  // ===== 규칙 연습 =====
  function setupPractice() {
    var learned = RULE_ORDER.filter(function (r) { return data.learned[r]; });
    S.pick = S.pick.filter(function (r) { return data.learned[r]; });
    if (!S.pick.length && learned.length) S.pick = [learned[0]];
    $('#pick-rules').innerHTML = RULE_ORDER.map(function (r) {
      var on = S.pick.indexOf(r) >= 0, ok = !!data.learned[r];
      return '<button class="pchip' + (ok ? '' : ' locked') + '" data-act="pick" data-id="' + r + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + '>' +
        icon(ok ? r : 'lock') + '<span>' + (ok ? RULE_META[r].name : '아직 몰라요') + '</span></button>';
    }).join('');
    var sv = data.saves.practice, rb = $('#btn-practice-resume');
    rb.hidden = !sv;
    if (sv) rb.innerHTML = '이어서 하기 <small>' + (sv.pick || []).map(function (r) { return RULE_META[r] ? RULE_META[r].name : ''; }).join(' · ') + ' · ' + ((sv.solved || 0) + 1) + '번째 판</small>';
    $('#pick-note').textContent = learned.length ? (sv ? '새로 시작하면 이어하던 판은 사라져요 · ' : '') + '한 판에 하트 3개 · 하트를 2개 잃으면 티켓 1장을 써요' : '단계 도전에서 규칙을 배우면 연습할 수 있어요';
    $('#btn-practice-go').disabled = !S.pick.length;
    $('#tut-list').innerHTML = learned.map(function (r) {
      return '<button class="tchip" data-act="tut-open" data-id="' + r + '">' + icon(r) + '<span>' + RULE_META[r].name + '</span></button>';
    }).join('');
    $('#tut-sec').hidden = !learned.length;
  }
  function togglePick(r) {
    var i = S.pick.indexOf(r);
    if (i >= 0) { if (S.pick.length > 1) S.pick.splice(i, 1); }
    else { S.pick.push(r); if (S.pick.length > 2) S.pick.shift(); }
    setupPractice();
  }
  function startPractice() {
    if (!S.pick.length || !needTicket()) return;
    clearRun('practice');
    Object.assign(S, { mode: 'practice', active: false, running: false, paused: false, inRun: true, rule: null, solved: 0 });
    go('scr-play', setupHud).then(nextPracticePuzzle);
  }
  function practiceEnd() {
    S.active = false; S.inRun = false; clearRun('practice');
    var h = '<p class="ps-kicker">규칙 연습</p><h2 class="ps-big">' + S.solved + '판 성공</h2>' +
      '<p class="ps-line">' + S.pick.map(function (r) { return RULE_META[r].name; }).join(' · ') + '</p>' +
      '<button class="btn primary" data-act="practice-again">다시 하기</button>' +
      '<button class="btn ghost" data-act="home">처음으로</button>';
    $('#psheet-box').innerHTML = h; $('#psheet').hidden = false;
  }

  // ===== 멈춤 · 나가기 =====
  function pause() {
    if (!S.active && !S.running) return;
    if (S.paused) return;
    S.paused = true;
    if (S.mode === 'time') tray.classList.add('veil');
    $('#pause-note').textContent = '지금 나가도 이 판은 그대로 저장돼요. 다시 누르면 티켓 없이 이어서 해요.';
    $('#btn-end').hidden = S.mode !== 'time';
    $('#pause').hidden = false; SND.duck(true);
    saveRun();
  }
  function resume() {
    if (!S.paused) return;
    $('#pause').hidden = true; SND.duck(false);
    S.paused = false; S.last = performance.now();
    tray.classList.remove('veil');
  }
  function leave() {
    $('#pause').hidden = true; SND.duck(false);
    saveRun();
    S.inRun = false; S.active = false; S.running = false; S.paused = false;
    cancelAnimationFrame(S.raf); closePeek();
    goHome();
  }
  function endNow() {
    $('#pause').hidden = true; SND.duck(false);
    S.rewardUsed = true; S.paused = false; endTime('그만했어요');
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    if (S.mode === 'time' && S.running) pause();
    saveRun();
  });
  window.addEventListener('pagehide', saveRun);

  // ===== 규칙 꾹 눌러 보기 =====
  var ruleIc = $('#rule-ic'), peekTimer = 0, peeking = false, pressAt = 0;
  function openPeek() {
    if (!S.pz) return;
    peeking = true;
    var box = $('#peek-box');
    box.innerHTML = (S.pz.rules || [S.pz.rule]).map(function (r) { return ruleSheetHTML(r, '규칙'); }).join('<hr class="rs-hr">'); fillMinis(box);
    $('#peek').hidden = false; SND.play('open'); vib(10);
  }
  function closePeek() { clearTimeout(peekTimer); ruleIc.classList.remove('pressing'); if (peeking) { peeking = false; $('#peek').hidden = true; } }
  ruleIc.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { ruleIc.setPointerCapture(e.pointerId); } catch (x) {}
    pressAt = Date.now(); ruleIc.classList.add('pressing');
    peekTimer = setTimeout(openPeek, 380);
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    ruleIc.addEventListener(ev, function () {
      var short = !peeking && Date.now() - pressAt < 380;
      closePeek();
      if (short && ev === 'pointerup') toast('꾹 누르고 있으면 규칙이 보여요');
    });
  });
  ruleIc.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  ruleIc.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && S.pz) { e.preventDefault(); openModal(ruleSheetHTML(S.pz.rule, '규칙') + '<button class="btn" data-act="modal-close">닫기</button>'); }
  });

  // ===== 명예의 전당 · 도감 · 상점 · 설정 =====
  // 이용약관·개인정보처리방침 (스토어 심사 필수). 바깥 링크는 platform.js가 스토어에 맞게 연다(data-ext)
  var PRIVACY_URL = 'https://kankanii.github.io/hankan-find/privacy.html';
  var EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  function legalLinks(withEula) {
    return (withEula ? '<a class="lnk" data-ext href="' + EULA_URL + '">이용약관(EULA)</a> · ' : '') +
      '<a class="lnk" data-ext href="' + PRIVACY_URL + '">개인정보처리방침</a>';
  }
  function setupHall() {
    $('#btn-board').hidden = !P.features.leaderboard;
    $('#hall-stage').textContent = data.clearsTotal ? data.clearsTotal + '단계' : '-';
    $('#hall-rules').innerHTML = RULE_ORDER.filter(ruleOpen).map(function (r) {
      return '<li><span class="hr-md">' + Medals.svg(r, Medals.tierOf(data.xp[r] || 0)) + '</span><span>' + RULE_META[r].name + '</span><b>' + cleared(r) + '단계</b></li>';
    }).join('');
    $('#hall-list').innerHTML = data.hall.map(function (r, i) {
      return '<li style="--k:' + i + '"><span class="rk">' + (i + 1) + '</span><span class="sc">' + r.score + '<small>칸</small></span><span class="dt">' + r.date + '</span></li>';
    }).join('');
    $('#hall-empty').hidden = data.hall.length > 0;
  }
  function setupBook() {
    var box = $('#book-rules');
    box.innerHTML = RULE_ORDER.map(function (r) {
      if (!data.learned[r]) return '<li class="locked"><span class="lock">' + icon('lock') + '</span><div><b>???</b><p>단계 도전을 하면 열려요.</p></div></li>';
      var m = RULE_META[r];
      return '<li><div class="tray mini" data-mini="' + r + '"></div><div><b>' + icon(r, 'bi') + m.name + '</b><p>' + m.desc + '</p>' +
        '<span class="bk-btns"><button class="btn small-btn" data-act="tut-open" data-id="' + r + '">따라 해 보기</button>' +
        '<button class="btn small-btn ghostish" data-act="rule-more" data-id="' + r + '">자세히</button></span></div></li>';
    }).join('');
    fillMinis(box);
  }
  function setupShop() {
    adCounts();
    var h = '';
    if (P.features.ads) {
      h += '<h3 class="sec">무료</h3><div class="shop-grid">' +
        shopCard('ad-ticket', '', 'ticket', '티켓 1장', '광고 보기', '오늘 ' + (CFG.adTicketsPerDay - E.adT) + '번 남음', E.adT >= CFG.adTicketsPerDay) +
        shopCard('ad-hint', '', 'hint', '힌트 1개', '광고 보기', '오늘 ' + (CFG.adHintsPerDay - E.adH) + '번 남음', E.adH >= CFG.adHintsPerDay) + '</div>';
    }
    h += '<h3 class="sec">코인으로</h3><div class="shop-grid">' + COIN_ITEMS.map(function (c) {
      return shopCard('buy-coin', c.id, shopIc(c.give), c.title, icon('coin') + c.cost, c.give.boost ? boostSub() : '', E.coins < c.cost);
    }).join('') + '</div>';
    if (P.features.iap) {
      h += '<h3 class="sec">묶음 상품</h3><div class="shop-grid">' + P.products.filter(function (p) { return p.kind === 'consumable'; }).map(function (p) {
        return shopCard('buy-cash', p.id, shopIc(p.give), p.title, p.price, p.give.boost ? boostSub() : (p.sub || ''), false);
      }).join('') + '</div>';
      h += '<h3 class="sec">광고 제거</h3><div class="shop-list">' + P.products.filter(function (p) { return p.kind !== 'consumable'; }).map(function (p) {
        return '<button class="srow" data-act="buy-cash" data-id="' + p.id + '"><span><b>' + p.title + '</b><small>' + (p.sub || '') + '</small></span><em>' + p.price + '</em></button>';
      }).join('') + '<button class="srow" data-act="restore"><span><b>구매 복원</b><small>예전에 산 광고 제거를 다시 받아요</small></span><em>복원</em></button></div>' +
        '<p class="sub small">' + (P.target === 'web-test' ? '테스트 빌드: 결제 없이 바로 받아요. ' : '') + '구독은 언제든 해지할 수 있어요. ' + legalLinks(true) + '</p>';
    }
    h += '<p class="sub small">코인은 게임을 하면 모여요. 단계 클리어, 연습 성공, 타임어택 기록으로 받아요.<br>티켓 부스터: 24시간 동안 어떤 모드를 해도 티켓을 쓰지 않아요. 쓰는 중에 또 사면 24시간이 늘어나요.</p>';
    $('#shop-list').innerHTML = h;
    refreshWallet();
  }
  function shopCard(act, id, ic, title, price, sub, disabled) {
    return '<button class="scard" data-act="' + act + '" data-id="' + id + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="sc-ic ' + (ic === 'ticket' ? 'tk' : ic === 'hint' ? 'ht' : ic === 'boost' ? 'bo' : 'bd') + '">' + icon(ic) + '</span>' +
      '<b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '<em>' + price + '</em></button>';
  }
  function buyCoin(id) {
    var c = COIN_ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!c || E.coins < c.cost) { toast('코인이 모자라요'); return; }
    E.coins -= c.cost; give(c.give); SND.play('coin');
    toast(c.give.boost ? '티켓 부스터 시작! ' + boostLeftText() + ' 동안 티켓을 쓰지 않아요' : c.title + '을(를) 받았어요');
    afterGain();
  }
  function afterGain() {
    if (screen === 'scr-shop') setupShop();
    if (!$('#modal').hidden) closeModal();
  }
  function adReward(kind) {
    adCounts();
    if (kind === 'ticket' ? E.adT >= CFG.adTicketsPerDay : E.adH >= CFG.adHintsPerDay) { toast('오늘은 다 받았어요'); return; }
    SND.duck(true);
    P.showRewarded().then(function (ok) {
      SND.duck(false);
      if (!ok) return;
      if (kind === 'ticket') { E.adT++; give({ tickets: 1 }); } else { E.adH++; give({ hints: 1 }); }
      SND.play('coin'); toast(kind === 'ticket' ? '티켓 1장을 받았어요' : '힌트 1개를 받았어요');
      afterGain();
    });
  }
  function buyCash(id) {
    P.buy(id).then(function (r) {
      if (!r || !r.ok) { if (!(r && r.canceled)) toast((r && r.message) || '구매하지 못했어요. 다시 해 주세요'); return; }
      if (r.give) give(r.give);
      SND.play('coin'); toast(r.give && r.give.boost ? '티켓 부스터 시작! ' + boostLeftText() + ' 동안 티켓을 쓰지 않아요' : '구매가 끝났어요'); afterGain();
    });
  }
  var resetArmed = false;
  function setupSettings() {
    $('#set-music').setAttribute('aria-pressed', String(data.settings.music));
    $('#set-sound').setAttribute('aria-pressed', String(data.settings.sound));
    $('#set-vibe').setAttribute('aria-pressed', String(data.settings.vibe));
    $('#set-cb').setAttribute('aria-pressed', String(!!data.settings.cb));
    resetArmed = false; $('#reset-hint').textContent = '';
  }
  function leavePlay() {
    S.inRun = false; S.active = false; S.running = false; S.paused = false;
    cancelAnimationFrame(S.raf); closePeek();
  }

  // ===== 버튼 =====
  var ACTS = {
    stage: function () { go('scr-rules', setupRules); },
    rpick: function (id) { startStage(id); },
    'rules-back': function () { leavePlay(); maybeAd(function () { go('scr-rules', setupRules); }); },
    medal: function (id) { medalDetail(id); },
    expert: function () { if (!hardOpen('expert')) { toast('단계 도전 ' + CFG.expertAt + '단계를 깨면 열려요'); return; } HARD.kind = 'expert'; go('scr-hard', setupHard); },
    master: function () { if (!hardOpen('master')) { toast(maxCleared() < CFG.masterAt ? '단계 도전 ' + CFG.masterAt + '단계를 깨면 열려요' : '세 규칙을 섞으려면 규칙을 더 열어야 해요'); return; } HARD.kind = 'master'; go('scr-hard', setupHard); },
    hpick: function (id) { HARD.key = id; if (HARD.kind === 'master') HARD.msel = []; setupHard(); },
    mpick: function (id) {
      var i = HARD.msel.indexOf(id);
      if (i >= 0) HARD.msel.splice(i, 1); else if (HARD.msel.length < 3) HARD.msel.push(id);
      if (HARD.key === 'random') HARD.key = null;
      setupMasterPick();
    },
    'hard-go': function () { startHard(HARD.kind, HARD.key); },
    'hard-resume': function () { resumeRun(HARD.kind); },
    'hard-next': hardNext,
    confirm: confirmPick,
    time: timeSheet,
    'time-go': function () { closeModal(); startTime(); },
    'time-resume': function () { closeModal(); resumeRun('time'); },
    tpick: function (id) { toggleTimePick(id); },
    practice: function () { go('scr-practice', setupPractice); },
    'practice-resume': function () { resumeRun('practice'); },
    pick: function (id) { togglePick(id); },
    'practice-go': startPractice,
    'practice-again': function () { if (!needTicket(true)) return; $('#psheet').hidden = true; S.solved = 0; S.inRun = true; tray.classList.add('out'); setTimeout(nextPracticePuzzle, 220); },
    'stage-next': stageNext,
    hall: function () { go('scr-hall', setupHall); },
    board: function () { P.openLeaderboard(P.leaderboards.timeattack); },
    book: function () { go('scr-book', setupBook); },
    'tut-open': function (id) { openTutorial(id, false, null); },
    'tut-next': function () { tutGo(TUT.i + 1); },
    'tut-prev': function () { if (TUT.i > 0) tutGo(TUT.i - 1); },
    'tut-done': function () { var f = closeModal(); TUT = null; if (f) f(); },
    'rule-more': function (id) { openModal(ruleSheetHTML(id, '규칙') + '<button class="btn" data-act="modal-close">닫기</button>'); },
    shop: function () { go('scr-shop', setupShop); },
    'go-shop': function () { closeModal(); go('scr-shop', setupShop); },
    settings: function () { go('scr-settings', setupSettings); },
    // 수집 · 꾸미기
    col: function () { go('scr-col', Collect.setupCol); },
    'col-set': function (id) { go('scr-board', function () { Collect.setupBoard(id); }); },
    'grow-go': function () { closeModal(); if (screen === 'scr-play') leavePlay(); go('scr-board', function () { Collect.setupBoard('grow'); }); },
    'grow-item': function (id) { Collect.growModal(id); },
    'grow-up': function (id) { Collect.upgrade(id); if (screen === 'scr-room') Room.setup(); },
    'shard-swap': function () { Collect.shardSwap(); },
    'col-back': function () { go('scr-col', Collect.setupCol); },
    'col-go': function () { closeModal(); if (screen === 'scr-play') leavePlay(); go('scr-col', Collect.setupCol); },
    room: function () { Room.preload(); go('scr-room', Room.setup); },
    'room-go': function () { closeModal(); if (screen === 'scr-play') leavePlay(); Room.preload(); go('scr-room', Room.setup); },
    'pack-open': function () { Collect.openPack(); },
    'pack-again': function () { closeModal(); Collect.openPack(); },
    'pack-tear': function () { Collect.tear(); },
    'pack-done': function () { closeModal(); if (screen === 'scr-col') Collect.setupCol(); else if (screen === 'scr-title') setupHome(); },
    look: function () { if (!$('#modal').hidden) closeModal(); if (screen === 'scr-play') leavePlay(); go('scr-look', Collect.setupLook); },
    'look-set': function (id) { Collect.setLook(id); },
    home: function () { leavePlay(); maybeAd(goHome); },
    pause: pause, resume: resume, leave: leave, 'end-now': endNow,
    hint: useHint,
    tool: function (id) { setTool(id); SND.play('pick'); },
    'marks-clear': clearMarks,
    'continue': continueWithAd,
    again: function () { maybeAd(startTime); },
    'home-result': function () { maybeAd(goHome); },
    'modal-close': function () { closeModal(); },
    'modal-next': function () { var f = closeModal(); if (f) f(); },
    'ad-ticket': function () { adReward('ticket'); },
    'ad-hint': function () { adReward('hint'); },
    'buy-coin': function (id) { buyCoin(id); },
    'buy-cash': function (id) { buyCash(id); },
    restore: function () { P.restore().then(function (r) { toast(r && r.restored ? '구매를 복원했어요' : '복원할 구매가 없어요'); }); },
    'toggle-music': function () { data.settings.music = !data.settings.music; SND.setMusic(data.settings.music); persist(); setupSettings(); },
    'toggle-sound': function () { data.settings.sound = !data.settings.sound; SND.setSfx(data.settings.sound); persist(); setupSettings(); },
    'toggle-cb': function () { data.settings.cb = !data.settings.cb; persist(); applyCb(); setupSettings(); toast(data.settings.cb ? '색약 모드를 켰어요' : '색약 모드를 껐어요'); },
    'toggle-vibe': function () { data.settings.vibe = !data.settings.vibe; persist(); setupSettings(); if (data.settings.vibe) P.vibrate(20); },
    reset: function () {
      if (!resetArmed) { resetArmed = true; $('#reset-hint').textContent = '한 번 더 누르면 지워져요'; return; }
      data.hall = []; persist(); resetArmed = false; $('#reset-hint').textContent = '';
      toast('타임어택 기록을 지웠어요');
    }
  };
  var QUIET = { pause: 1, stage: 1, rpick: 1, tool: 1, hint: 1, confirm: 1, hpick: 1, mpick: 1, 'look-set': 1, 'pack-tear': 1 };
  $('#modal-box').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('#tut-tray .tile'); if (!b) return;
    e.preventDefault(); tutTap(+b.dataset.i, b);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var f = ACTS[b.dataset.act]; if (!f) return;
    SND.unlock();
    if (!QUIET[b.dataset.act]) SND.play('click');
    f(b.dataset.id);
  });
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal' && !modalNext) closeModal(); });

  Collect.init({ data: data, persist: persist, give: give, toast: toast, go: go, openModal: openModal, closeModal: closeModal,
    icon: icon, SND: SND, FX: FX, vib: vib, applyLook: applyLook, medalsHTML: medalsHTML, maxCleared: maxCleared });
  // 스토어 결제가 나중에 끝나면(승인 대기 · 결제 중 앱 종료) platform.js가 여기로 아이템을 보낸다
  if (P.onGrant) P.onGrant(function (g) {
    give(g); SND.play('coin');
    toast(g && g.boost ? '티켓 부스터 시작! ' + boostLeftText() + ' 동안 티켓을 쓰지 않아요' : '구매한 상품을 받았어요');
    afterGain();
  });
  syncTickets(); persist();
  setupHome(); show('scr-title');
  // 시작 로고: 페이드 인 → 잠깐 → 페이드 아웃 (누르면 건너뜀). 끝나면 처음 화면 연출을 다시 재생
  (function splash() {
    var sp = $('#splash'); if (!sp) return;
    var done = false;
    function finish() {
      if (done) return; done = true;
      sp.classList.add('out');
      setupHome();
      if (hallWasReset) toast('점수 방식이 바뀌어서 명예의 전당을 새로 시작해요');
      setTimeout(function () { sp.remove(); }, 500);
    }
    setTimeout(finish, FX.reduce ? 1200 : 2300);
    sp.addEventListener('click', finish);
  })();
  window.HankanFind = { version: VERSION, config: CFG };
})();
