/*
 * 한칸 찾기 · room.js — 한칸 방 (v0.9, 모든 스토어 공통)
 * - 카드팩에서 나온 가구를 방 칸에 놓고, 벽지·바닥을 고른다.
 * - 모은 칸 친구들이 방 안을 걸어 다니고, 소파·의자에 앉았다 일어난다. 누르면 콩 뛴다.
 * - 방은 가로 6칸 · 바닥 4줄 + 벽. 바닥 가구는 바닥 칸, 벽 가구는 벽 칸, 러그는 바닥 2×2.
 * 좌표는 모두 '칸' 단위로 계산하고 화면에는 %로 그린다(화면 크기와 상관없음).
 * 저장: data.room = { items: { 가구id: { c, r } }, wall, floor, seen: { 가구id: true } }
 */
window.Room = (function () {
  'use strict';
  var C = null;
  var COLS = 6, ROWS = 4, WALL = 2.2, H = WALL + ROWS;
  var FS = 1.0; // 친구 그림 크기(칸) · v0.10 도트

  // place: floor(바닥) · wall(벽 가운데) · top(천장에 매달림) · rug(바닥 2×2, 다른 가구 밑)
  // fp: 차지하는 칸 수(가로) · sw: 그림 너비(칸) · a: 그림 세로/가로 · seats: [가운데에서 x, 바닥에서 앉는 높이(그림 높이 비율)]
  var FURNI = [
    { id: 'r1', name: '파란 소파', c: '#4f8fe6', a: 0.725, place: 'floor', fp: 2, sw: 1.95, seats: [[-0.42, 0.42], [0.42, 0.42]] },
    { id: 'r2', name: '초록 소파', c: '#62c25e', a: 0.727, place: 'floor', fp: 2, sw: 1.95, seats: [[-0.42, 0.42], [0.42, 0.42]] },
    { id: 'r3', name: '빨간 빈백', c: '#e8474c', a: 0.873, place: 'floor', fp: 1, sw: 0.98, seats: [[0.02, 0.4]] },
    { id: 'r4', name: '노란 의자', c: '#f3c53a', a: 1.034, place: 'floor', fp: 1, sw: 0.66, seats: [[0, 0.7]] },
    { id: 'r5', name: '포근한 침대', c: '#e9962e', a: 0.986, place: 'floor', fp: 2, sw: 1.7, seats: [[0.1, 0.46]] },
    { id: 'r6', name: '둥근 탁자', c: '#e9962e', a: 0.861, place: 'floor', fp: 1, sw: 0.92 },
    { id: 'r7', name: '작은 책상', c: '#e9962e', a: 0.816, place: 'floor', fp: 1, sw: 0.92 },
    { id: 'r8', name: '협탁 스탠드', c: '#e9962e', a: 1.414, place: 'floor', fp: 1, sw: 0.7, lamp: true },
    { id: 'r9', name: '책장', c: '#e9962e', a: 1.296, place: 'floor', fp: 1, sw: 0.98 },
    { id: 'r10', name: '서랍장', c: '#e9962e', a: 1.216, place: 'floor', fp: 1, sw: 0.86 },
    { id: 'r11', name: '수납장', c: '#e9962e', a: 1.216, place: 'floor', fp: 1, sw: 0.9 },
    { id: 'r12', name: '동그란 스탠드', c: '#f3c53a', a: 2.276, place: 'floor', fp: 1, sw: 0.5, lamp: true },
    { id: 'r13', name: '빨간 전등', c: '#e8474c', a: 1.414, place: 'top', fp: 1, sw: 0.62, lamp: true },
    { id: 'r14', name: '큰 화분', c: '#46a85a', a: 1.085, place: 'floor', fp: 1, sw: 0.92 },
    { id: 'r15', name: '선인장', c: '#3f86d6', a: 1.426, place: 'floor', fp: 1, sw: 0.6 },
    { id: 'r16', name: '걸이 화분', c: '#46a85a', a: 1.21, place: 'top', fp: 1, sw: 0.86 },
    { id: 'r17', name: '벽시계', c: '#f3c53a', a: 0.998, place: 'wall', fp: 1, sw: 0.74 },
    { id: 'r18', name: '구름 창문', c: '#3f86d6', a: 0.947, place: 'wall', fp: 2, sw: 1.45 },
    { id: 'r19', name: '벽 선반', c: '#d9b27a', a: 0.949, place: 'wall', fp: 1, sw: 0.8 },
    { id: 'r20', name: '게임기 TV', c: '#7cc6c0', a: 0.965, place: 'floor', fp: 1, sw: 0.98 },
    { id: 'r21', name: '작은 피아노', c: '#7cc6c0', a: 0.975, place: 'floor', fp: 1, sw: 0.98 },
    { id: 'r22', name: '어항', c: '#7cc6c0', a: 1.051, place: 'floor', fp: 1, sw: 0.82 },
    { id: 'r23', name: '장난감 상자', c: '#7cc6c0', a: 0.988, place: 'floor', fp: 1, sw: 0.8 },
    { id: 'r24', name: '네 색 러그', c: '#f3c53a', a: 0.965, place: 'rug', fp: 2, sw: 1.9 }
  ];
  // v0.10: 가구는 도트 그림. 그림 1칸(가구 방 1칸) = 도트 16칸으로 크기를 맞춘다. 앉는 높이도 도트 그림 기준
  var SEAT_H = { r1: 0.58, r2: 0.58, r3: 0.5, r4: 0.5, r5: 0.55 };
  var BY = {};
  FURNI.forEach(function (f, i) {
    f.no = i + 1; BY[f.id] = f;
    var d = window.Pixel && Pixel.dims(f.id);
    if (d) { f.sw = d.w / 16; f.a = d.h / d.w; }
    if (f.seats && SEAT_H[f.id]) f.seats.forEach(function (s) { s[1] = SEAT_H[f.id]; });
  });
  var STARTER = { r3: { c: 1, r: 1 }, r15: { c: 4, r: 0 } }; // 처음 방에 놓아 주는 가구 2개 (무료)

  // 벽지 · 바닥 (코드 무늬). need = 모은 가구 수
  var WALLS = [
    { id: 'cream', name: '크림 줄무늬', need: 0, sw: ['#fbf1dc', '#f3e2bf'] },
    { id: 'sky', name: '하늘 체크', need: 0, sw: ['#dcecff', '#b9d6fb'] },
    { id: 'mint', name: '민트 물방울', need: 6, sw: ['#d9f5e8', '#9fe0c3'] },
    { id: 'pink', name: '분홍 격자', need: 12, sw: ['#ffe3ee', '#ffbcd3'] },
    { id: 'night', name: '밤하늘 별', need: 18, sw: ['#272c69', '#f8c632'] }
  ];
  var FLOORS = [
    { id: 'wood', name: '나무 마루', need: 0, sw: ['#e2b67f', '#c98f55'] },
    { id: 'tile', name: '체크 타일', need: 0, sw: ['#f2f3fb', '#c9cde9'] },
    { id: 'grass', name: '잔디 카펫', need: 8, sw: ['#8fd36e', '#6cbc4f'] },
    { id: 'navy', name: '남색 칸', need: 16, sw: ['#272c69', '#4181f6'] }
  ];
  function $(s) { return document.querySelector(s); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pct(v, of) { return (v / of * 100).toFixed(3) + '%'; }
  function R() { return C.data.room; }
  function owned(id) { return !!C.data.col.own[id]; }
  function ownCount() { return FURNI.filter(function (f) { return owned(f.id); }).length; }
  function tier(id) { return (C && C.tierOf && C.tierOf(id)) || 2; }
  function src(id, t) { return Pixel.url(id, t || tier(id)); }

  // ===================== 자리 계산 =====================
  function isWall(f) { return f.place === 'wall' || f.place === 'top'; }
  function boxOf(f, p) {
    var h = f.sw * f.a, cx = p.c + f.fp / 2, top, bottom;
    if (f.place === 'floor') { bottom = WALL + p.r + 0.93; top = bottom - h; }
    else if (f.place === 'rug') { var cy = WALL + p.r + 1; top = cy - h / 2; bottom = cy + h / 2; }
    else if (f.place === 'top') { top = 0.02; bottom = top + h; }
    else { top = 1.12 - h / 2; bottom = top + h; }
    return { cx: cx, left: cx - f.sw / 2, top: top, bottom: bottom, h: h };
  }
  function zOf(f, p) {
    if (isWall(f)) return 5;
    if (f.place === 'rug') return 10;
    return Math.round(boxOf(f, p).bottom * 100);
  }
  // 칸 차지: 바닥 가구끼리, 벽 가구끼리, 러그끼리만 겹치지 않으면 된다
  function cellsOf(f, p) {
    var o = [];
    if (f.place === 'rug') { for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) o.push('g' + (p.r + a) + '-' + (p.c + b)); }
    else for (var k = 0; k < f.fp; k++) o.push((isWall(f) ? 'w' : 'f' + p.r + '-') + (p.c + k));
    return o;
  }
  function inside(f, p) {
    if (p.c < 0 || p.c + f.fp > COLS) return false;
    if (f.place === 'floor') return p.r >= 0 && p.r < ROWS;
    if (f.place === 'rug') return p.r >= 0 && p.r + 2 <= ROWS;
    return true;
  }
  function canPlace(id, p) {
    var f = BY[id]; if (!inside(f, p)) return false;
    var mine = cellsOf(f, p), items = R().items, ok = true;
    Object.keys(items).forEach(function (k) {
      if (k === id || !ok) return;
      var g = BY[k]; if (!g) return;
      var other = cellsOf(g, items[k]);
      if (mine.some(function (x) { return other.indexOf(x) >= 0; })) ok = false;
    });
    return ok;
  }
  // 포인터 위치(칸 단위 x, y) → 놓을 자리
  function cellAt(id, x, y) {
    var f = BY[id];
    var c = clamp(Math.round(x - f.fp / 2), 0, COLS - f.fp);
    if (isWall(f)) return { c: c, r: 0 };
    if (f.place === 'rug') return { c: clamp(Math.round(x - 1), 0, COLS - 2), r: clamp(Math.round(y - WALL - 1), 0, ROWS - 2) };
    return { c: c, r: clamp(Math.floor(y - WALL), 0, ROWS - 1) };
  }
  function freeSpot(id) {
    var f = BY[id], spots = [];
    var rows = isWall(f) ? [0] : f.place === 'rug' ? [0, 1, 2] : [1, 2, 0, 3];
    rows.forEach(function (r) { for (var c = 0; c <= COLS - f.fp; c++) if (canPlace(id, { c: c, r: r })) spots.push({ c: c, r: r }); });
    return spots[0] || null;
  }

  // ===================== 방 그리기 =====================
  function furniHTML(id, p, mini, extra) {
    var f = BY[id], b = boxOf(f, p);
    var st = 'left:' + pct(b.left, COLS) + ';top:' + pct(b.top, H) + ';width:' + pct(f.sw, COLS) + ';z-index:' + zOf(f, p);
    var cls = 'fu p-' + f.place + (f.lamp ? ' lamp' : '') + ' tr' + tier(id) + (extra || '');
    return mini ? '<span class="' + cls + '" style="' + st + '"><img src="' + src(id) + '" alt=""></span>'
      : '<span class="' + cls + '" data-fu="' + id + '" style="' + st + '" role="button" tabindex="0" aria-label="' + f.name + '"><img src="' + src(id) + '" alt="" draggable="false"></span>';
  }
  function roomHTML(mini) {
    var d = R(), h = '';
    h += '<div class="room wp-' + d.wall + ' fl-' + d.floor + (mini ? ' mini' : '') + '"' + (mini ? ' aria-hidden="true"' : ' id="room"') + '>';
    h += '<span class="rm-wall"></span><span class="rm-base"></span><span class="rm-floor"></span>';
    h += '<span class="rm-layer"' + (mini ? '' : ' id="rm-layer"') + '>';
    Object.keys(d.items).forEach(function (id) { if (BY[id] && owned(id)) h += furniHTML(id, d.items[id], mini); });
    h += '</span>';
    if (!mini) h += '<span class="rm-prev" id="rm-prev" hidden></span><span class="rm-chars" id="rm-chars"></span><span class="rm-pop" id="rm-pop" hidden></span>';
    if (!mini && !Object.keys(d.items).length) h += '<span class="rm-empty">가구를 끌어다 방에 놓아요</span>';
    return h + '</div>';
  }
  function miniHTML() { return roomHTML(true); }

  // ===================== 화면 =====================
  var tab = 'fu', sel = null;
  function setup() {
    ensure();
    sel = null;
    $('#room-wrap').innerHTML = roomHTML(false);
    renderPanel();
    var n = ownCount();
    $('#room-count').textContent = '가구 ' + n + '/' + FURNI.length;
    spawnChars();
    startLoop();
    FURNI.forEach(function (f) { if (owned(f.id)) R().seen[f.id] = true; });
    C.persist();
    if (C.checkFurniDone) setTimeout(C.checkFurniDone, 700);
  }
  function renderPanel() {
    var d = R(), h = '';
    document.querySelectorAll('#rm-tabs [data-rtab]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.rtab === tab); });
    if (tab === 'fu') {
      h += '<div class="rm-list fu">';
      FURNI.filter(function (f) { return owned(f.id); }).concat(FURNI.filter(function (f) { return !owned(f.id); })).forEach(function (f) {
        if (!owned(f.id)) { var u0 = src(f.id, 2); h += '<span class="rm-fi sil" aria-label="아직 없는 가구"><span class="rf-art" style="-webkit-mask-image:url(\'' + u0 + '\');mask-image:url(\'' + u0 + '\')"></span></span>'; return; }
        var on = !!d.items[f.id], fresh = !d.seen[f.id];
        var nm = C.nameOf ? C.nameOf(f.id) : f.name, up = C.canUp && C.canUp(f.id);
        h += '<button class="rm-fi tr' + tier(f.id) + (on ? ' on' : '') + (sel === f.id ? ' sel' : '') + '" data-rfi="' + f.id + '" aria-label="' + nm + (on ? ' (놓음)' : '') + '" style="--cc:' + f.c + '">' +
          '<img src="' + src(f.id) + '" alt="" draggable="false"><b>' + nm + '</b>' + (C.pips ? C.pips(tier(f.id)) : '') +
          (up ? '<em class="rf-new rf-up">올리기!</em>' : on ? '<em class="rf-on">놓음</em>' : fresh ? '<em class="rf-new">새로!</em>' : '') + '</button>';
      });
      h += '</div>';
      tip(sel ? '놓을 칸을 누르거나, 끌어다 놓아요' : ownCount() ? '가구를 끌어서 방에 놓아요 · 방에 놓인 가구도 끌어서 옮겨요' : '카드팩에서 가구가 나와요');
    } else {
      var list = tab === 'wall' ? WALLS : FLOORS, n = ownCount();
      h += '<div class="rm-list sw">';
      list.forEach(function (w) {
        var lock = n < w.need, on = (tab === 'wall' ? d.wall : d.floor) === w.id;
        h += '<button class="rm-sw' + (on ? ' on' : '') + (lock ? ' locked' : '') + '" data-rsw="' + tab + ':' + w.id + '" aria-pressed="' + on + '">' +
          '<span class="rs-pv ' + (tab === 'wall' ? 'wp-' : 'fl-') + w.id + '"></span><b>' + w.name + '</b>' + (lock ? '<small>' + C.icon('lock') + '가구 ' + w.need + '개</small>' : '') + '</button>';
      });
      h += '</div>';
      tip(tab === 'wall' ? '가구를 더 모으면 새 벽지가 열려요' : '가구를 더 모으면 새 바닥이 열려요');
    }
    $('#rm-list').innerHTML = h;
  }
  function tip(t) { var el = $('#rm-tip'); if (el) el.textContent = t; }
  function redrawFurni() {
    var d = R(), lay = $('#rm-layer'); if (!lay) return;
    lay.innerHTML = Object.keys(d.items).map(function (id) { return BY[id] && owned(id) ? furniHTML(id, d.items[id], false, sel === id ? ' sel' : '') : ''; }).join('');
    var emp = document.querySelector('#room .rm-empty'); if (emp) emp.remove();
    chars.forEach(function (ch) { if (ch.seat && !d.items[ch.seat.id]) standUp(ch); });
  }
  function place(id, p) {
    var d = R(), had = !!d.items[id];
    if (!canPlace(id, p)) { C.SND.play('nope'); C.vib(30); C.toast('다른 가구가 있어서 놓을 수 없어요'); return false; }
    d.items[id] = { c: p.c, r: p.r }; d.seen[id] = true;
    C.persist();
    // 자리를 옮기면 앉아 있던 친구는 일어난다
    chars.forEach(function (ch) { if (ch.seat && ch.seat.id === id) standUp(ch); });
    sel = null; hidePop();
    redrawFurni(); renderPanel();
    var el = document.querySelector('#rm-layer [data-fu="' + id + '"]');
    if (el) { el.classList.add('drop'); var r = el.getBoundingClientRect(); C.FX.ring(r.left + r.width / 2, r.bottom - 6, C.FX.color('y')); }
    C.SND.play('snap'); C.vib(15);
    if (!had) C.FX.burst && el && (function () { var r = el.getBoundingClientRect(); C.FX.burst(r.left + r.width / 2, r.top + r.height / 2, null, 10, 0.6); })();
    return true;
  }
  function putAway(id) {
    var d = R(); if (!d.items[id]) return;
    delete d.items[id]; C.persist();
    chars.forEach(function (ch) { if (ch.seat && ch.seat.id === id) standUp(ch); });
    sel = null; hidePop(); redrawFurni(); renderPanel();
    C.SND.play('pick');
  }
  function setSel(id) {
    sel = sel === id ? null : id;
    hidePop();
    renderPanel();
    document.querySelectorAll('#rm-layer .fu').forEach(function (el) { el.classList.toggle('sel', el.dataset.fu === sel); });
    if (sel) C.SND.play('pick');
  }
  // 방에 놓인 가구를 눌렀을 때: 통통 + 넣기 단추
  function tapFurni(id) {
    var el = document.querySelector('#rm-layer [data-fu="' + id + '"]'); if (!el) return;
    el.classList.remove('wig'); void el.offsetWidth; el.classList.add('wig');
    if (BY[id].lamp) el.classList.toggle('off');
    C.SND.play('boing'); C.vib(10);
    sel = id; renderPanel();
    document.querySelectorAll('#rm-layer .fu').forEach(function (x) { x.classList.toggle('sel', x === el); });
    var f = BY[id], b = boxOf(f, R().items[id]), pop = $('#rm-pop');
    pop.innerHTML = '<b>' + (C.nameOf ? C.nameOf(id) : f.name) + '</b>' + (C.canUp && C.canUp(id) ? '<button data-act="grow-item" data-id="' + id + '">올리기</button>' : '') + '<button data-ract="put" data-id="' + id + '">넣기</button>';
    pop.style.left = pct(clamp(b.cx, 1, COLS - 1), COLS); pop.style.top = pct(Math.max(0.1, b.top - 0.05), H);
    pop.hidden = false;
  }
  function hidePop() { var p = $('#rm-pop'); if (p) p.hidden = true; }
  function setSwatch(arg) {
    var p = String(arg).split(':'), kind = p[0], id = p[1], list = kind === 'wall' ? WALLS : FLOORS;
    var w = list.filter(function (x) { return x.id === id; })[0]; if (!w) return;
    if (ownCount() < w.need) { C.toast('가구를 ' + w.need + '개 모으면 열려요'); C.SND.play('nope'); return; }
    R()[kind] = id; C.persist(); C.SND.play('click');
    var room = $('#room');
    if (room) room.className = room.className.replace(kind === 'wall' ? /wp-\S+/ : /fl-\S+/, (kind === 'wall' ? 'wp-' : 'fl-') + id);
    renderPanel();
  }

  // ===================== 끌기 · 누르기 =====================
  var drag = null;
  function roomRect() { var r = $('#room'); return r ? r.getBoundingClientRect() : null; }
  function toCells(e) {
    var r = roomRect(); if (!r) return null;
    return { x: (e.clientX - r.left) / r.width * COLS, y: (e.clientY - r.top) / r.height * H, inRoom: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }
  function showPrev(id, p, ok) {
    var el = $('#rm-prev'); if (!el) return;
    var f = BY[id], top, hh;
    if (isWall(f)) { top = 0; hh = WALL; } else if (f.place === 'rug') { top = WALL + p.r; hh = 2; } else { top = WALL + p.r; hh = 1; }
    el.style.left = pct(p.c, COLS); el.style.width = pct(f.fp, COLS);
    el.style.top = pct(top, H); el.style.height = pct(hh, H);
    el.className = 'rm-prev ' + (ok ? 'ok' : 'bad'); el.hidden = false;
  }
  function hidePrev() { var el = $('#rm-prev'); if (el) el.hidden = true; }
  function onDown(e) {
    var fi = e.target.closest('[data-rfi]'), fu = e.target.closest('#rm-layer [data-fu]');
    var fr = e.target.closest('#rm-chars .fr');
    if (fr) { e.preventDefault(); hopChar(fr.dataset.ch); return; }
    if (!fi && !fu) return;
    e.preventDefault();
    var el = fi || fu, id = fi ? fi.dataset.rfi : fu.dataset.fu;
    drag = { id: id, from: fi ? 'list' : 'room', el: el, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, target: null };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    var r = roomRect(); if (!r) return;
    if (!drag.moved) {
      drag.moved = true; hidePop();
      var f = BY[drag.id], g = document.createElement('img');
      g.src = src(drag.id); g.className = 'rm-ghost'; g.alt = '';
      g.style.width = (f.sw / COLS * r.width) + 'px';
      document.body.appendChild(g); drag.ghost = g;
      drag.el.classList.add('dragging');
      C.SND.play('pick');
    }
    var f2 = BY[drag.id], w = f2.sw / COLS * r.width, hh = w * f2.a;
    // 손가락에 가리지 않게 그림은 손가락보다 조금 위에
    drag.ghost.style.transform = 'translate(' + (e.clientX - w / 2) + 'px,' + (e.clientY - hh - 14) + 'px)';
    var p = toCells(e);
    if (p && p.inRoom) {
      var cell = cellAt(drag.id, p.x, p.y), ok = canPlace(drag.id, cell);
      drag.target = ok ? cell : null; showPrev(drag.id, cell, ok);
    } else { drag.target = null; hidePrev(); }
    drag.out = p && !p.inRoom;
  }
  function onUp(e) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    var g = drag; drag = null; if (!g) return;
    hidePrev();
    if (g.ghost) g.ghost.remove();
    if (g.el) g.el.classList.remove('dragging');
    if (!g.moved) { if (g.from === 'list') setSel(g.id); else tapFurni(g.id); return; }
    if (g.target) { place(g.id, g.target); return; }
    if (g.from === 'room' && g.out) {
      var lst = $('#rm-panel').getBoundingClientRect();
      if (e && e.clientY >= lst.top) { putAway(g.id); C.toast('가구를 넣었어요'); return; }
    }
    if (e && e.type !== 'pointercancel') { var p = toCells(e); if (p && p.inRoom) { C.SND.play('nope'); C.toast('다른 가구가 있어서 놓을 수 없어요'); } }
  }
  function onClick(e) {
    var ra = e.target.closest('[data-ract]');
    if (ra) { if (ra.dataset.ract === 'put') { putAway(ra.dataset.id); } return; }
    var rt = e.target.closest('[data-rtab]');
    if (rt) { tab = rt.dataset.rtab; sel = null; hidePop(); renderPanel(); C.SND.play('click'); return; }
    var sw = e.target.closest('[data-rsw]');
    if (sw) { setSwatch(sw.dataset.rsw); return; }
    // 고른 가구가 있을 때 방의 빈 곳을 누르면 거기에 놓기
    if (e.target.closest('#room') && !e.target.closest('[data-fu]') && !e.target.closest('.fr') && !e.target.closest('#rm-pop')) {
      if (sel && !R().items[sel]) {
        var p = toCells(e); if (!p) return;
        place(sel, cellAt(sel, p.x, p.y));
      } else if (sel) { sel = null; hidePop(); renderPanel(); document.querySelectorAll('#rm-layer .fu.sel').forEach(function (x) { x.classList.remove('sel'); }); }
    }
  }
  function onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var fu = e.target.closest('#rm-layer [data-fu]');
    if (fu) { e.preventDefault(); tapFurni(fu.dataset.fu); }
  }

  // ===================== 칸 친구들 =====================
  var chars = [], raf = 0, lastT = 0;
  function friendIds() {
    var own = C.data.col.own, ids = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'].filter(function (id) { return id === 'f1' || own[id]; });
    return ids;
  }
  function spawnChars() {
    var box = $('#rm-chars'); if (!box) return;
    chars = friendIds().map(function (id, i) {
      var ch = { id: id, x: 0.7 + ((i * 1.37) % 4.6), y: WALL + 0.8 + ((i * 0.83) % 2.9), tx: 0, ty: 0, state: 'idle', t: 0.4 + Math.random() * 1.4, face: Math.random() < 0.5 ? -1 : 1, seat: null, el: null };
      var el = document.createElement('span');
      el.className = 'fr tr' + ((C.tierOf && C.tierOf(id)) || 1); el.dataset.ch = id;
      el.setAttribute('role', 'button'); el.setAttribute('aria-label', '칸 친구');
      el.innerHTML = '<span class="fr-sh"></span><span class="fr-in"><img src="' + Pixel.url(id, (C.tierOf && C.tierOf(id)) || 1) + '" alt="" draggable="false"></span>';
      box.appendChild(el); ch.el = el;
      return ch;
    });
    chars.forEach(draw);
  }
  function seatsFree() {
    var d = R(), o = [];
    Object.keys(d.items).forEach(function (id) {
      var f = BY[id]; if (!f || !f.seats || !owned(id)) return;
      f.seats.forEach(function (s, k) {
        if (chars.some(function (ch) { return ch.seat && ch.seat.id === id && ch.seat.k === k; })) return;
        o.push({ id: id, k: k });
      });
    });
    return o;
  }
  function seatPos(seat) {
    var f = BY[seat.id], p = R().items[seat.id]; if (!f || !p) return null;
    var b = boxOf(f, p), s = f.seats[seat.k];
    return { x: b.cx + s[0] * (f.sw / 2), y: b.bottom - s[1] * b.h, ground: b.bottom - 0.02, z: zOf(f, p) + 2 + seat.k };
  }
  function standUp(ch) {
    if (!ch.seat) return;
    var sp = seatPos(ch.seat);
    ch.seat = null; ch.state = 'idle'; ch.t = 0.6 + Math.random();
    ch.y = sp ? clamp(sp.ground + 0.12, WALL + 0.35, H - 0.05) : clamp(ch.y, WALL + 0.35, H - 0.05);
  }
  function think(ch) {
    var free = seatsFree();
    if (free.length && Math.random() < 0.4) {
      var seat = pick(free), sp = seatPos(seat);
      ch.goSeat = seat; ch.tx = sp.x; ch.ty = clamp(sp.ground + 0.08, WALL + 0.35, H - 0.05);
    } else {
      ch.goSeat = null;
      ch.tx = 0.5 + Math.random() * (COLS - 1); ch.ty = WALL + 0.4 + Math.random() * (ROWS - 0.5);
    }
    ch.state = 'walk';
  }
  function step(ch, dt) {
    if (ch.state === 'hop') { ch.t -= dt; if (ch.t <= 0) { ch.state = ch.seat ? 'sit' : 'idle'; ch.t = ch.seat ? 2 + Math.random() * 3 : 0.8 + Math.random(); } return; }
    if (ch.state === 'sit') {
      ch.t -= dt;
      if (!seatPos(ch.seat)) { standUp(ch); return; }
      if (ch.t <= 0) standUp(ch);
      return;
    }
    if (ch.state === 'idle') { ch.t -= dt; if (ch.t <= 0) think(ch); return; }
    // walk
    var dx = ch.tx - ch.x, dy = ch.ty - ch.y, dist = Math.hypot(dx, dy), sp = 0.9 * dt;
    if (Math.abs(dx) > 0.02) ch.face = dx < 0 ? -1 : 1;
    if (dist <= sp) {
      ch.x = ch.tx; ch.y = ch.ty;
      if (ch.goSeat && seatPos(ch.goSeat) && !chars.some(function (o) { return o !== ch && o.seat && o.seat.id === ch.goSeat.id && o.seat.k === ch.goSeat.k; })) {
        ch.seat = ch.goSeat; ch.goSeat = null; ch.state = 'sit'; ch.t = 3 + Math.random() * 4;
        ch.el.classList.remove('land'); void ch.el.offsetWidth; ch.el.classList.add('land');
      } else { ch.goSeat = null; ch.state = 'idle'; ch.t = 1 + Math.random() * 2.5; }
      return;
    }
    ch.x += dx / dist * sp; ch.y += dy / dist * sp;
  }
  function draw(ch) {
    var x = ch.x, y = ch.y, z = Math.round(ch.y * 100) + 1, el = ch.el;
    if (ch.seat) { var sp = seatPos(ch.seat); if (sp) { x = sp.x; y = sp.y; z = sp.z; } }
    el.style.left = pct(x - FS / 2, COLS); el.style.top = pct(y - FS, H); el.style.width = pct(FS, COLS);
    el.style.zIndex = z;
    el.style.setProperty('--face', ch.face);
    el.classList.toggle('walk', ch.state === 'walk');
    el.classList.toggle('sit', !!ch.seat);
  }
  function hopChar(id) {
    var ch = chars.filter(function (c) { return c.id === id; })[0]; if (!ch) return;
    ch.el.classList.remove('hop'); void ch.el.offsetWidth; ch.el.classList.add('hop');
    if (ch.state !== 'sit') { ch.state = 'hop'; ch.t = 0.55; }
    else ch.t += 1.5;
    C.SND.play('hop'); C.vib(12);
    var r = ch.el.getBoundingClientRect();
    C.FX.burst(r.left + r.width / 2, r.top + r.height * 0.3, ['#ff7eb6', '#fff', C.FX.color('y')], 8, 0.5);
  }
  function loop(t) {
    var scr = $('#scr-room');
    if (!scr || scr.hidden) { raf = 0; lastT = 0; return; }
    var dt = Math.min(0.05, ((t - (lastT || t)) / 1000)); lastT = t;
    if (!C.FX.reduce) chars.forEach(function (ch) { step(ch, dt); });
    chars.forEach(draw);
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } }

  // ===================== 저장 준비 =====================
  function ensure() {
    var d = C.data;
    if (!d.room) d.room = {};
    var r = d.room;
    r.items = r.items || {}; r.seen = r.seen || {};
    if (!WALLS.some(function (w) { return w.id === r.wall; })) r.wall = 'cream';
    if (!FLOORS.some(function (w) { return w.id === r.floor; })) r.floor = 'wood';
    if (!r.started) {
      r.started = true;
      Object.keys(STARTER).forEach(function (id) { d.col.own[id] = true; if (!r.items[id]) r.items[id] = STARTER[id]; });
    }
    // 잠긴 벽지·바닥이면 기본으로
    var n = ownCount();
    WALLS.forEach(function (w) { if (w.id === r.wall && n < w.need) r.wall = 'cream'; });
    FLOORS.forEach(function (w) { if (w.id === r.floor && n < w.need) r.floor = 'wood'; });
  }
  function init(ctx) {
    C = ctx; ensure();
    var root = $('#scr-room');
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
  }
  function preload() {} // v0.10: 도트 그림은 코드로 바로 그려서 미리 불러올 것이 없다

  return {
    FURNI: FURNI, BY: BY, init: init, setup: setup, miniHTML: miniHTML, ownCount: ownCount, preload: preload,
    unseen: function () { var d = C.data.room || { seen: {} }; return FURNI.filter(function (f) { return owned(f.id) && !(d.seen || {})[f.id]; }).length; },
    placedCount: function () { var d = C.data.room || { items: {} }; return Object.keys(d.items || {}).filter(function (id) { return owned(id); }).length; },
    _test: { canPlace: canPlace, cellAt: cellAt, boxOf: boxOf, freeSpot: freeSpot }
  };
})();
