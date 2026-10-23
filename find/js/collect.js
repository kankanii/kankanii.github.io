/*
 * 한칸 찾기 · collect.js — 카드팩 · 카드 도감 · 한칸 방 가구 · 직소 퍼즐 · 꾸미기 (모든 스토어 공통)
 * - 카드팩은 단계 도전 5단계마다 1개, 무료로만 받는다. 돈·코인으로 팔지 않는다(무작위 보상은 무료 보상에만).
 * - 팩 1개 = 3장. 같은 것이 또 나오면 쌓여서 등급이 오른다(1개 → 3개 → 5개). 최고 등급 뒤에는 조각이 되고, 조각 10개 = 카드팩 1개.
 * - v0.10: 그림은 모두 도트(pixel.js)로 그린다.
 * - 도감·퍼즐을 다 붙이면 꾸미기 아이템(프로필·테두리·배경·배경음·효과음)이 열린다.
 * 게임 본체(game.js)가 Collect.init(ctx)로 도구를 넘겨준다.
 */
window.Collect = (function () {
  'use strict';
  var C = null;
  var uidN = 0;
  function uid() { return 'u' + (++uidN); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function $(s) { return document.querySelector(s); }

  // ===================== 그림: 칸 친구들 (v0.4.1: 입체 그라데이션·외곽선·광택·소품) =====================
  var FRIENDS = [
    { id: 'f1', name: '동글이', shape: 'circle', c: '#2cc271', e: '#14774a', mouth: 'smile', acc: 'sprout' },
    { id: 'f2', name: '세모', shape: 'tri', c: '#f1535b', e: '#a8262f', mouth: 'open' },
    { id: 'f3', name: '네모', shape: 'square', c: '#4181f6', e: '#2248a8', mouth: 'flat', eyes: 'happy', acc: 'antenna' },
    { id: 'f4', name: '마름이', shape: 'diamond', c: '#f8c632', e: '#c08a0a', mouth: 'o' },
    { id: 'f5', name: '별콩', shape: 'star', c: '#ff9a3c', e: '#c25e10', mouth: 'grin' },
    { id: 'f6', name: '몽실', shape: 'cloud', c: '#8fd8ff', e: '#3f8fc2', mouth: 'smile', eyes: 'happy', acc: 'drops' },
    { id: 'f7', name: '하트링', shape: 'heart', c: '#ff7eb6', e: '#c23f7c', mouth: 'open', acc: 'bow' },
    { id: 'f8', name: '육각', shape: 'hex', c: '#a78bfa', e: '#5f40c9', mouth: 'grin', eyes: 'wink', acc: 'sparkle' }
  ];
  function starPts(cx, cy, R, r) {
    var o = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      o.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
    }
    return o.join(' ');
  }
  // sw: 모서리를 둥글게 하려고 같은 색 테두리를 두르는 모양
  var SHAPE = {
    circle: { d: '<circle cx="50" cy="52" r="35"/>', fy: 0 },
    tri: { d: '<path d="M50 14Q55 14 58 20L88 76Q91 84 82 84H18Q9 84 12 76L42 20Q45 14 50 14Z"/>', fy: 10 },
    square: { d: '<rect x="16" y="18" width="68" height="68" rx="17"/>', fy: 0 },
    diamond: { d: '<path d="M50 12Q53 12 56 15L85 46Q89 51 85 56L56 88Q50 94 44 88L15 56Q11 51 15 46L44 15Q47 12 50 12Z"/>', fy: 0 },
    star: { d: '<polygon points="' + starPts(50, 56, 40, 20) + '"/>', fy: 4, sw: 8 },
    cloud: { d: '<path d="M28 81a16 16 0 0 1-3-32a21 21 0 0 1 39-11a18 18 0 0 1 13 31a12 12 0 0 1-8 12Z"/>', fy: 4 },
    heart: { d: '<path d="M50 88C21 69 10 54 10 39a19.5 19.5 0 0 1 40-7a19.5 19.5 0 0 1 40 7c0 15-11 30-40 49Z"/>', fy: 0 },
    hex: { d: '<polygon points="86,52 68,83 32,83 14,52 32,21 68,21"/>', fy: 0, sw: 7 }
  };
  var INK = '#1b1f4a';
  function rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b);
    return '#' + A.map(function (v, i) { return ('0' + Math.round(v + (B[i] - v) * t).toString(16)).slice(-2); }).join('');
  }
  function eye(x, y, kind) {
    if (kind === 'happy') return '<path d="M' + (x - 6.5) + ' ' + (y + 2) + 'q6.5-9 13 0" fill="none" stroke="' + INK + '" stroke-width="3.8" stroke-linecap="round"/>';
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="7.4" ry="8.8" fill="#fff" stroke="' + INK + '" stroke-width="1.8"/>' +
      '<ellipse cx="' + (x + 1) + '" cy="' + (y + 1.6) + '" rx="4.6" ry="5.5" fill="' + INK + '"/>' +
      '<circle cx="' + (x + 2.7) + '" cy="' + (y - 0.9) + '" r="2" fill="#fff"/><circle cx="' + (x - 0.7) + '" cy="' + (y + 4.2) + '" r=".95" fill="#fff"/>';
  }
  function mouth(y, kind) {
    var st = ' stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"';
    switch (kind) {
      case 'open': return '<path d="M42 ' + y + 'q8 12.5 16 0z" fill="#6a1630"' + st + '/><path d="M45.6 ' + (y + 5.6) + 'q4.4-3.4 8.8 0q-4.4 4-8.8 0z" fill="#ff7a99"/>';
      case 'flat': return '<path d="M44 ' + (y + 2) + 'q6 2 12 0" fill="none" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round"/>';
      case 'o': return '<ellipse cx="50" cy="' + (y + 3) + '" rx="4.4" ry="5" fill="#6a1630"' + st + '/>';
      case 'grin': return '<path d="M39 ' + y + 'q11 12 22 0z" fill="#fff"' + st + '/><path d="M44 ' + (y + 1) + 'v4M50 ' + (y + 1) + 'v5M56 ' + (y + 1) + 'v4" stroke="' + INK + '" stroke-width="1.2" opacity=".35"/>';
      default: return '<path d="M43 ' + y + 'q7 7.5 14 0" fill="none" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round"/>';
    }
  }
  function sparkle(x, y, r, col) {
    return '<path d="M' + x + ' ' + (y - r) + 'Q' + (x + r * 0.18) + ' ' + (y - r * 0.18) + ' ' + (x + r) + ' ' + y + 'Q' + (x + r * 0.18) + ' ' + (y + r * 0.18) + ' ' + x + ' ' + (y + r) +
      'Q' + (x - r * 0.18) + ' ' + (y + r * 0.18) + ' ' + (x - r) + ' ' + y + 'Q' + (x - r * 0.18) + ' ' + (y - r * 0.18) + ' ' + x + ' ' + (y - r) + 'Z" fill="' + col + '"/>';
  }
  var OL = ' stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"';
  var ACC = {
    sprout: '<path d="M50 18V9" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M50 10q-12-7-17 2q10 5 17-2z" fill="#6ee69b"' + OL + '/><path d="M50 10q11-9 17-1q-9 7-17 1z" fill="#8ff0b3"' + OL + '/>',
    antenna: '<path d="M50 19V8" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="7" r="5" fill="#f8c632"' + OL + '/><circle cx="48.4" cy="5.4" r="1.6" fill="#fff"/>',
    drops: '<path d="M30 92q-3 4 0 6q3-2 0-6z" fill="#8fd8ff"' + OL + '/><path d="M70 92q-3 4 0 6q3-2 0-6z" fill="#8fd8ff"' + OL + '/>',
    bow: '<g transform="rotate(-18 30 24)"><path d="M30 24l-11-7v14z" fill="#ff4d7e"' + OL + '/><path d="M30 24l11-7v14z" fill="#ff4d7e"' + OL + '/><circle cx="30" cy="24" r="3.6" fill="#ff86a6"' + OL + '/></g>',
    sparkle: sparkle(88, 18, 7, '#fff3a8') + sparkle(12, 30, 5, '#fff3a8') + sparkle(84, 88, 4, '#fff')
  };
  // v0.10: 칸 친구·가구는 도트 그림(pixel.js). 빈자리 그림자는 같은 그림의 모양만 한 색으로 칠한다.
  function friendArt(f, sil, tier) { return imgArt(Pixel.url(f.id, sil ? 2 : (tier || tierOf(f.id) || 1)), sil); }
  function imgArt(src, sil) {
    var st = ' style="image-rendering:pixelated"';
    if (!sil) return '<svg viewBox="0 0 100 100" aria-hidden="true"><image href="' + src + '" width="100" height="100"' + st + '/></svg>';
    var u = uid();
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="' + u + 'm" mask-type="alpha" style="mask-type:alpha"><image href="' + src + '" width="100" height="100"/></mask></defs>' +
      '<rect width="100" height="100" fill="currentColor" mask="url(#' + u + 'm)"/></svg>';
  }
  // v0.9: 보석 도감을 빼고 한칸 방 가구(img/furniture/r1~r24.png)로 바꿈
  function furniArt(f, sil, tier) { return imgArt(Pixel.url(f.id, sil ? 2 : (tier || tierOf(f.id) || 2)), sil); }


  // ===================== 그림: 직소 퍼즐 장면 (300×300) =====================
  function sceneSunset(u) {
    return '<defs><linearGradient id="' + u + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a4a"/><stop offset=".38" stop-color="#7a2f6b"/><stop offset=".68" stop-color="#f0675a"/><stop offset="1" stop-color="#ffc15e"/></linearGradient>' +
      '<radialGradient id="' + u + 'g"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="300" height="300" fill="url(#' + u + 's)"/>' +
      '<g fill="#fff" opacity=".85"><circle cx="30" cy="30" r="1.8"/><circle cx="80" cy="18" r="1.3"/><circle cx="130" cy="44" r="2"/><circle cx="252" cy="26" r="1.5"/><circle cx="276" cy="62" r="1.2"/><circle cx="190" cy="16" r="1.4"/><circle cx="56" cy="72" r="1.1"/></g>' +
      '<circle cx="205" cy="170" r="84" fill="url(#' + u + 'g)"/><circle cx="205" cy="170" r="40" fill="#ffe08a"/>' +
      '<g fill="#ffb3a7" opacity=".55"><ellipse cx="70" cy="122" rx="46" ry="9"/><ellipse cx="98" cy="111" rx="26" ry="9"/><ellipse cx="242" cy="96" rx="36" ry="7"/></g>' +
      '<g fill="none" stroke="#3a1838" stroke-width="3" stroke-linecap="round"><path d="M118 92q7-7 14 0q7-7 14 0"/><path d="M154 70q5-5 10 0q5-5 10 0"/></g>' +
      '<path d="M0 198Q60 160 130 188T300 172V300H0Z" fill="#a8456f"/>' +
      '<path d="M0 232Q90 190 170 226T300 214V300H0Z" fill="#6b2a5e"/>' +
      '<g><rect x="196" y="196" width="34" height="26" fill="#3c1a44"/><path d="M189 199 213 177 237 199Z" fill="#2a1233"/><rect x="208" y="204" width="9" height="9" fill="#ffd36b"/><rect x="222" y="181" width="6" height="12" fill="#2a1233"/></g>' +
      '<path d="M150 300Q168 268 212 224" stroke="#ffcf8a" stroke-width="6" fill="none" opacity=".45"/>' +
      '<path d="M0 262Q80 232 160 258T300 250V300H0Z" fill="#3a1840"/>' +
      '<rect x="58" y="226" width="7" height="24" fill="#24102a"/><circle cx="61" cy="218" r="17" fill="#2a1233"/><circle cx="50" cy="226" r="10" fill="#2a1233"/>' +
      '<g><circle cx="110" cy="276" r="4" fill="#ffd36b"/><circle cx="124" cy="282" r="3.5" fill="#ff8fb1"/><circle cx="250" cy="270" r="4" fill="#ffd36b"/><circle cx="266" cy="280" r="3.5" fill="#ff8fb1"/><circle cx="34" cy="284" r="3.5" fill="#ffd36b"/></g>';
  }
  function fish(x, y, s, col, flip) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')"><path d="M0 0q24-18 44 0q-20 18-44 0z" fill="' + col + '"/><path d="M44 0l15-11v22z" fill="' + col + '"/>' +
      '<circle cx="10" cy="-2" r="3.2" fill="#13163a"/><path d="M22-8q5 8 0 16" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6"/></g>';
  }
  function sceneSea(u) {
    return '<defs><linearGradient id="' + u + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd6f2"/><stop offset=".45" stop-color="#2a86c9"/><stop offset=".8" stop-color="#0c3f7a"/><stop offset="1" stop-color="#08285a"/></linearGradient></defs>' +
      '<rect width="300" height="300" fill="url(#' + u + 'w)"/>' +
      '<g fill="#fff" opacity=".09"><path d="M40 0H92L150 300H100Z"/><path d="M160 0H190L232 300H202Z"/><path d="M232 0H262L282 300H252Z"/></g>' +
      fish(70, 110, 1, '#ff9a3c') + fish(196, 164, 0.8, '#f8c632', true) + fish(150, 66, 0.6, '#ff7eb6') +
      '<g fill="none" stroke="#fff" stroke-width="2" opacity=".6"><circle cx="58" cy="80" r="5"/><circle cx="64" cy="60" r="3"/><circle cx="214" cy="122" r="6"/><circle cx="222" cy="98" r="4"/><circle cx="252" cy="58" r="3"/><circle cx="118" cy="186" r="4"/><circle cx="30" cy="190" r="3"/></g>' +
      '<path d="M0 250Q75 232 150 248T300 240V300H0Z" fill="#e2c58a"/>' +
      '<g fill="none" stroke-width="7" stroke-linecap="round"><path d="M30 262q-12-25 0-50q12-25 0-50" stroke="#2fbf71"/><path d="M48 262q10-20 0-40q-10-20 0-40" stroke="#2fbf71"/><path d="M268 256q-10-22 0-44q10-22 0-44" stroke="#1f9a5a"/><path d="M284 256q9-16 0-32" stroke="#1f9a5a"/></g>' +
      '<path d="M206 252v-30a6 6 0 0 1 12 0v12h6v-24a6 6 0 0 1 12 0v42z" fill="#ff7a9c"/>' +
      '<g><rect x="112" y="226" width="50" height="28" rx="3" fill="#8a4b22"/><path d="M112 227a25 15 0 0 1 50 0z" fill="#a65e2d"/><rect x="112" y="225" width="50" height="4" fill="#6b3816"/><rect x="133" y="224" width="8" height="12" rx="2" fill="#f8c632"/></g>' +
      '<g fill="#f8c632"><circle cx="104" cy="252" r="5"/><circle cx="170" cy="254" r="5"/><circle cx="176" cy="246" r="4"/></g>' +
      '<path d="M0 274Q90 260 170 274T300 268V300H0Z" fill="#c9a76a"/>' +
      '<polygon points="' + starPts(70, 278, 12, 5) + '" fill="#ff9a3c" stroke="#ff9a3c" stroke-width="3" stroke-linejoin="round"/>';
  }
  // v0.5.2: 퍼즐 장면도 Gemini 그림(img/scenes/*.jpg, 900px). 위 코드 그림은 예비로 남겨 둠
  // v0.10: 퍼즐 장면도 도트(30×30). 퍼즐 칸은 10×10 네모 9개
  function sceneImg(name) { return function () { return '<image href="' + Pixel.sceneURL(name) + '" width="300" height="300" preserveAspectRatio="none" style="image-rendering:pixelated"/>'; }; }
  var SCENES = { sunset: sceneImg('sunset'), sea: sceneImg('sea') };

  // ===================== 직소 조각 모양 =====================
  var CELL = 100, PAD = 8;
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return function () {
      h += 0x6D2B79F5; var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var edgeCache = {};
  function edgesOf(setId) {
    if (edgeCache[setId]) return edgeCache[setId];
    var R = seeded(setId), H = [], V = [];
    for (var r = 0; r < 2; r++) { H.push([]); for (var c = 0; c < 3; c++) H[r].push(0); } // v0.10: 네모 칸(혹 없음)
    for (r = 0; r < 3; r++) { V.push([]); for (c = 0; c < 2; c++) V[r].push(0); }
    return (edgeCache[setId] = { H: H, V: V });
  }
  function seg(px, py, qx, qy, sg) {
    if (!sg) return ' L' + qx + ' ' + qy;
    var s = Math.hypot(qx - px, qy - py), ux = (qx - px) / s, uy = (qy - py) / s, nx = uy, ny = -ux, h = 0.21 * s * sg;
    function P(a, b) { return (px + ux * a * s + nx * b).toFixed(1) + ' ' + (py + uy * a * s + ny * b).toFixed(1); }
    return ' L' + P(0.36, 0) + ' C' + P(0.41, h * 0.2) + ' ' + P(0.27, h * 1.05) + ' ' + P(0.5, h * 1.05) +
      ' C' + P(0.73, h * 1.05) + ' ' + P(0.59, h * 0.2) + ' ' + P(0.64, 0) + ' L' + qx + ' ' + qy;
  }
  function piecePath(setId, k) {
    var E = edgesOf(setId), r = Math.floor(k / 3), c = k % 3, x = c * CELL, y = r * CELL;
    var top = r ? -E.H[r - 1][c] : 0, right = c < 2 ? E.V[r][c] : 0, bottom = r < 2 ? E.H[r][c] : 0, left = c ? -E.V[r][c - 1] : 0;
    return 'M' + x + ' ' + y + seg(x, y, x + CELL, y, top) + seg(x + CELL, y, x + CELL, y + CELL, right) +
      seg(x + CELL, y + CELL, x, y + CELL, bottom) + seg(x, y + CELL, x, y, left) + 'Z';
  }
  function pieceSVG(setId, k) {
    var r = Math.floor(k / 3), c = k % 3, u = uid(), d = piecePath(setId, k);
    return '<svg viewBox="' + (c * CELL - PAD) + ' ' + (r * CELL - PAD) + ' ' + (CELL + PAD * 2) + ' ' + (CELL + PAD * 2) + '" aria-hidden="true">' +
      '<defs><clipPath id="' + u + 'c"><path d="' + d + '"/></clipPath></defs>' +
      '<path d="' + d + '" fill="#000" opacity=".25" transform="translate(0 5)"/>' +
      '<g clip-path="url(#' + u + 'c)">' + SCENES[setId](u) + '</g>' +
      '<path d="' + d + '" fill="none" stroke="#1b1d3a" stroke-width="3"/></svg>';
  }

  // ===================== 수집 목록 =====================
  var SETS = [
    { id: 'friends', type: 'album', name: '칸 친구들', items: FRIENDS.map(function (f) { return f.id; }) },
    { id: 'furni', type: 'room', name: '한칸 방 가구', items: Room.FURNI.map(function (f) { return f.id; }) },
    { id: 'sunset', type: 'jigsaw', name: '노을 언덕', items: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return 'sunset-' + k; }) },
    { id: 'sea', type: 'jigsaw', name: '깊은 바다', items: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (k) { return 'sea-' + k; }) }
  ];
  var ITEM = {}, ALL = [];
  SETS.forEach(function (st) {
    st.items.forEach(function (id, i) {
      var it = { id: id, set: st, no: i + 1 };
      if (st.id === 'friends') { it.art = FRIENDS[i]; it.name = FRIENDS[i].name; }
      else if (st.id === 'furni') { it.art = Room.FURNI[i]; it.name = Room.FURNI[i].name; }
      else { it.k = i; it.name = st.name + ' ' + (i + 1) + '번 칸'; }
      ITEM[id] = it; ALL.push(id);
    });
  });
  function setById(id) { return SETS.filter(function (s) { return s.id === id; })[0]; }

  // ===================== 등급 (v0.10) =====================
  // 같은 것이 또 나오면 dup에 쌓이고, 1개·3개·5개를 모으면 '등급 올리기'로 한 단계씩 오른다(최고 4).
  // 최고 등급(퍼즐 칸은 처음부터)에서 또 나오면 조각 +1. 조각 10개 = 카드팩 1개.
  var MAXT = 4, NEED = [0, 1, 3, 5], SHARD_PACK = 10;
  var TN = { furni: ['', '낡은', '일반', '고급', '반짝'], friends: ['', '새내기', '단짝', '멋쟁이', '반짝'] };
  function tiered(id) { var it = ITEM[id]; return !!it && (it.set.id === 'friends' || it.set.id === 'furni'); }
  function tierOf(id) { if (!C || !C.data.col.own[id]) return 0; return tiered(id) ? Math.max(1, Math.min(MAXT, C.data.col.tier[id] || 1)) : 1; }
  function dupOf(id) { return (C && C.data.col.dup[id]) || 0; }
  function needOf(id) { var t = tierOf(id); return tiered(id) && t && t < MAXT ? NEED[t] : 0; }
  function canUp(id) { var n = needOf(id); return n > 0 && dupOf(id) >= n; }
  function tierName(id, t) { var it = ITEM[id]; t = t || tierOf(id); return it && TN[it.set.id] ? TN[it.set.id][t] || '' : ''; }
  function nameOf(id, t) {
    var it = ITEM[id]; t = t || tierOf(id);
    if (it.set.id === 'furni' && t && t !== 2) return tierName(id, t) + ' ' + it.name;
    return it.name;
  }
  function readyList() { return ALL.filter(canUp); }
  function addDup(id) {
    var col = C.data.col;
    if (tiered(id) && tierOf(id) < MAXT) { col.dup[id] = dupOf(id) + 1; return { kind: 'dup', have: col.dup[id], need: needOf(id), ready: canUp(id) }; }
    col.shards = (col.shards || 0) + 1;
    return { kind: 'shard' };
  }
  function upgrade(id) {
    if (!canUp(id)) return false;
    var col = C.data.col, t = tierOf(id);
    col.dup[id] = dupOf(id) - NEED[t];
    col.tier[id] = t + 1;
    if (t + 1 >= MAXT && col.dup[id] > 0) { col.shards = (col.shards || 0) + col.dup[id]; col.dup[id] = 0; }
    return true;
  }
  function pips(t, max) {
    var h = '<span class="pips" aria-label="' + t + '등급">';
    for (var i = 1; i <= (max || MAXT); i++) h += '<i' + (i <= t ? ' class="on"' : '') + '></i>';
    return h + '</span>';
  }
  function artOf(it, sil, tier) {
    if (it.set.id === 'friends') return friendArt(it.art, sil, tier);
    if (it.set.id === 'furni') return furniArt(it.art, sil, tier);
    return pieceSVG(it.set.id, it.k);
  }
  function cardHTML(id) {
    var it = ITEM[id];
    var t = tierOf(id) || 1, tc = ' tr' + t;
    if (it.set.type === 'room') return '<span class="ccard furni' + tc + '" style="--cc:' + it.art.c + '"><span class="cc-tag">가구</span><span class="cc-art">' + artOf(it) + '</span><b>' + nameOf(id, t) + '</b>' + pips(t) + '</span>';
    if (it.set.type === 'jigsaw') return '<span class="ccard piece"><span class="cc-art">' + artOf(it) + '</span><b>' + it.set.name + '</b><small>' + it.no + '번 칸</small></span>';
    return '<span class="ccard ' + it.set.id + tc + '" style="--cc:' + it.art.c + '"><span class="cc-no">' + it.no + '</span><span class="cc-art">' + artOf(it) + '</span><b>' + it.name + '</b>' + pips(t) + '</span>';
  }

  // ===================== 꾸미기 아이템 =====================
  var LOOK = [
    { kind: 'avatar', title: '프로필 캐릭터', items: FRIENDS.map(function (f) { return { id: f.id, name: f.name, need: f.id === 'f1' ? null : 'friends' }; }) },
    { kind: 'frame', title: '프로필 테두리', items: [{ id: 'none', name: '기본' }, { id: 'bronze', name: '동', needLv: 10 }, { id: 'silver', name: '은', needLv: 20 },
      { id: 'gold', name: '금', needLv: 30 }, { id: 'rainbow', name: '무지개', needLv: 40 }, { id: 'gem', name: '반짝', need: 'furni' }] },
    { kind: 'theme', title: '배경', items: [{ id: 'night', name: '남색 밤' }, { id: 'sunset', name: '노을', need: 'sunset' }, { id: 'sea', name: '바다', need: 'sea' }] },
    { kind: 'bgm', title: '배경음', items: [{ id: 'basic', name: '기본' }, { id: 'orgel', name: '오르골', need: 'sunset' }, { id: 'chip', name: '통통 8비트', need: 'sea' }] },
    { kind: 'sfx', title: '효과음', items: [{ id: 'basic', name: '기본' }, { id: 'sparkle', name: '반짝', need: 'furni' }] }
  ];
  var LOOK_DEFAULT = { avatar: 'f1', frame: 'none', theme: 'night', bgm: 'basic', sfx: 'basic' };
  function lookItem(kind, id) {
    var g = LOOK.filter(function (l) { return l.kind === kind; })[0];
    return g && g.items.filter(function (i) { return i.id === id; })[0];
  }
  function unlocked(kind, id) {
    var it = lookItem(kind, id);
    if (it && it.needLv) return C.maxCleared() >= it.needLv; // v0.8 단계 클리어 보상
    if (!it) return false;
    if (!it.need) return true;
    var dn = C.data.col.done;
    return !!dn[it.need] || (it.need === 'furni' && !!dn.gems); // 예전에 보석 도감을 완성했으면 그대로 열림
  }
  function rewardsOf(setId) {
    var o = [];
    LOOK.forEach(function (g) { g.items.forEach(function (i) { if (i.need === setId) o.push({ kind: g.kind, title: g.title, item: i }); }); });
    return o;
  }
  function avatarHTML(look, cls) {
    var f = FRIENDS.filter(function (x) { return x.id === look.avatar; })[0] || FRIENDS[0];
    return '<span class="ava fr-' + (look.frame || 'none') + (cls ? ' ' + cls : '') + ' tr' + (tierOf(f.id) || 1) + '">' + friendArt(f) + '</span>';
  }
  function count() {
    var col = C.data.col, own = 0, placed = 0;
    var seen = (C.data.room && C.data.room.seen) || {};
    ALL.forEach(function (id) { if (col.own[id]) own++; if (ITEM[id].set.type === 'room' ? seen[id] && col.own[id] : col.placed[id]) placed++; });
    var ready = readyList().length;
    return { own: own, placed: placed, total: ALL.length, waiting: own - placed + ready, ready: ready };
  }

  // ===================== 카드팩 =====================
  function packHTML(cls) {
    return '<span class="pack ' + (cls || '') + '"' + (cls === 'big' ? ' id="pk"' : '') + '>' +
      '<span class="pk-top">' + (cls === 'big' ? '<span class="pk-cutline"></span><span class="pk-cut" id="pk-cut"></span>' : '') + '</span>' +
      '<span class="pk-body"><span class="pk-logo"><i class="c-g"></i><i class="c-y"></i><i class="c-b"></i><i class="c-r"></i></span>' +
      '<b>한칸 카드팩</b>' + (cls === 'big' ? '<small>카드 3장</small>' : '') + '</span><span class="pk-shine"></span></span>';
  }
  function rollPack() {
    var own = C.data.col.own, res = [], taken = {};
    for (var k = 0; k < 3; k++) {
      var fresh = ALL.filter(function (id) { return !own[id] && !taken[id]; });
      var any = ALL.filter(function (id) { return !taken[id]; });
      var id = fresh.length && Math.random() < 0.5 ? pick(fresh) : pick(any); // v0.10: 겹쳐도 등급이 오르니 반반
      taken[id] = true;
      res.push({ id: id, dup: !!own[id] });
    }
    return res;
  }
  var pk = null; // 지금 뜯는 팩 상태
  function openPack() {
    if (!(C.data.packs > 0)) { C.toast('뜯을 카드팩이 없어요'); return; }
    var h = '<div class="pack-wrap">' +
      '<p class="ps-kicker" id="pk-count">카드팩 ' + C.data.packs + '개</p>' +
      '<p class="pk-tip" id="pk-tip">윗부분 점선을 손가락으로 <b>쓱</b> 그어서 뜯어요</p>' +
      '<div class="pk-area"><div class="pk-stage" id="pk-stage">' + packHTML('big') + '<span class="pk-hand" aria-hidden="true"></span></div>' +
      '<div class="pk-cards" id="pk-cards"></div></div>' +
      '<div class="pk-btns" id="pk-btns" hidden></div>' +
      '<button class="btn ghost pk-skip" id="pk-skip" data-act="pack-tear">버튼으로 뜯기</button></div>';
    C.openModal(h, function () {}); // 바깥을 눌러도 닫히지 않게
    pk = { torn: false, down: false, minX: 0, maxX: 0, lastSnd: 0 };
    var box = $('#modal-box');
    box.addEventListener('pointerdown', onPkDown);
  }
  function pkRect() { var el = $('#pk'); return el ? el.getBoundingClientRect() : null; }
  function onPkDown(e) {
    if (!pk || pk.torn) return;
    var r = pkRect(); if (!r) return;
    if (e.clientY < r.top - 40 || e.clientY > r.top + r.height * 0.42) return;
    e.preventDefault();
    pk.down = true; pk.minX = pk.maxX = e.clientX;
    window.addEventListener('pointermove', onPkMove);
    window.addEventListener('pointerup', onPkUp);
    window.addEventListener('pointercancel', onPkUp);
  }
  function onPkMove(e) {
    if (!pk || !pk.down || pk.torn) return;
    var r = pkRect(); if (!r) return;
    if (e.clientY < r.top - 60 || e.clientY > r.top + r.height * 0.5) return;
    pk.minX = Math.min(pk.minX, e.clientX); pk.maxX = Math.max(pk.maxX, e.clientX);
    var left = Math.max(r.left, pk.minX), right = Math.min(r.right, pk.maxX);
    var k = Math.max(0, right - left) / r.width;
    var cut = $('#pk-cut');
    if (cut) { cut.style.left = ((left - r.left) / r.width * 100) + '%'; cut.style.width = (k * 100) + '%'; }
    var t = performance.now();
    if (t - pk.lastSnd > 70) { pk.lastSnd = t; C.SND.play('slice'); }
    if (k >= 0.62) tear();
  }
  function onPkUp() {
    window.removeEventListener('pointermove', onPkMove);
    window.removeEventListener('pointerup', onPkUp);
    window.removeEventListener('pointercancel', onPkUp);
    if (!pk || pk.torn) return;
    pk.down = false;
    var cut = $('#pk-cut'); if (cut) { cut.style.width = '0'; }
    var tip = $('#pk-tip'); if (tip) { tip.classList.remove('nudge'); void tip.offsetWidth; tip.classList.add('nudge'); }
  }
  function tear() {
    if (!pk || pk.torn) return;
    pk.torn = true; onPkUp();
    var d = C.data, res = rollPack(), anyReady = false, gotShard = 0;
    res.forEach(function (x) {
      if (!x.dup) { d.col.own[x.id] = true; if (tiered(x.id)) d.col.tier[x.id] = 1; return; }
      x.info = addDup(x.id);
      if (x.info.kind === 'shard') gotShard++; else if (x.info.ready) anyReady = true;
    });
    var fs = setById('furni');
    if (!d.col.done.furni && fs.items.every(function (id) { return d.col.own[id]; })) d.col.done.furni = true;
    var gotFurni = res.some(function (x) { return !x.dup && ITEM[x.id].set.type === 'room'; });
    var gotCard = res.some(function (x) { return !x.dup && ITEM[x.id].set.type !== 'room'; });
    d.packs = Math.max(0, d.packs - 1);
    C.persist();
    var el = $('#pk'), r = el.getBoundingClientRect();
    el.classList.add('torn');
    C.SND.play('rip'); C.vib(30);
    C.FX.burst(r.left + r.width / 2, r.top + 20, [C.FX.color('y'), '#fff', C.FX.color('r')], 26, 1.1);
    var tip = $('#pk-tip'); if (tip) tip.textContent = '무엇이 나왔을까요?';
    var pc = $('#pk-count'); if (pc) pc.textContent = d.packs ? '남은 카드팩 ' + d.packs + '개' : '카드팩을 다 뜯었어요';
    var skip = $('#pk-skip'); if (skip) skip.hidden = true;
    setTimeout(function () {
      var st = $('#pk-stage'); if (st) st.classList.add('gone');
      var box = $('#pk-cards');
      box.innerHTML = res.map(function (x, i) {
        return '<span class="flip" style="--i:' + i + '"><span class="flip-in"><span class="fback">' + packHTML('back') + '</span><span class="ffront">' + cardHTML(x.id) + '</span></span>' +
          '<em class="flag ' + (x.dup ? (x.info.kind === 'shard' ? 'dup' : x.info.ready ? 'up' : 'dup') : 'new') + '">' +
          (!x.dup ? '새로!' : x.info.kind === 'shard' ? '조각 +1' : x.info.ready ? '올릴 수 있어요!' : '겹침 ' + x.info.have + '/' + x.info.need) + '</em></span>';
      }).join('');
      var flips = Array.prototype.slice.call(box.querySelectorAll('.flip'));
      flips.forEach(function (f, i) {
        setTimeout(function () {
          f.classList.add('on');
          C.SND.play('flip', i);
          if (!res[i].dup) {
            setTimeout(function () { C.SND.play('newcard'); var rr = f.getBoundingClientRect(); C.FX.burst(rr.left + rr.width / 2, rr.top + rr.height / 2, null, 16, 0.8); }, 220);
          } else setTimeout(function () { C.SND.play(res[i].info.ready ? 'newcard' : 'coin'); }, 220);
        }, 380 + i * 520);
      });
      setTimeout(function () {
        var b = $('#pk-btns'); if (!b) return;
        var more = d.packs > 0;
        b.innerHTML = (anyReady ? '<button class="btn primary" data-act="grow-go">등급 올리러 가기</button>' : '') +
          (gotCard || (!gotFurni && !anyReady) ? '<button class="btn ' + (anyReady ? 'go' : 'primary') + '" data-act="col-go">붙이러 가기</button>' : '') +
          (gotFurni ? '<button class="btn ' + (gotCard ? 'go' : 'primary') + '" data-act="room-go">방에 놓으러 가기</button>' : '') +
          (more ? '<button class="btn go" data-act="pack-again">하나 더 뜯기 <small>' + d.packs + '개 남음</small></button>' : '') +
          '<button class="btn ghost" data-act="pack-done">닫기</button>';
        b.hidden = false;
        if (tip) tip.textContent = anyReady ? '같은 것이 모여서 등급을 올릴 수 있어요' : gotShard ? '최고 등급은 조각이 돼요 · 조각 10개 = 카드팩 1개' : res.some(function (x) { return x.dup; }) ? '겹친 것은 쌓여서 등급이 올라요' : gotFurni && !gotCard ? '새 가구는 한칸 방에 놓아요' : '수집 화면에서 제자리에 붙여요';
      }, 380 + res.length * 520 + 250);
    }, 420);
  }

  // ===================== 수집 화면 =====================
  function setupCol() {
    var d = C.data, h = '';
    var fn = Room.ownCount(), fnew = Room.unseen();
    h += '<button class="roomcard" data-act="room"><span class="rc-room">' + Room.miniHTML() + '</span><span class="rc-bar"><span class="rc-txt"><b>한칸 방</b><small>가구 ' + fn + '/' + Room.FURNI.length + ' · 방에 놓은 것 ' + Room.placedCount() + '</small></span>' +
      (fnew ? '<em class="cr-badge">새 가구 ' + fnew + '</em>' : '<em class="rc-go">꾸미러 가기</em>') + '</span></button>';
    h += C.medalsHTML ? C.medalsHTML() : '';
    h += '<h3 class="sec">카드팩</h3><div class="packbox">' + packHTML('mini') +
      '<div class="pb-txt"><b>카드팩 ' + d.packs + '개</b><small>단계 도전에서 5단계를 깰 때마다 1개씩 받아요. 카드·가구·퍼즐 칸이 나와요</small>' +
      '<button class="btn primary" data-act="pack-open"' + (d.packs > 0 ? '' : ' disabled') + '>뜯기</button></div></div>';
    var rl = readyList().length, sh = d.col.shards || 0, best = ALL.filter(tiered).filter(function (id) { return d.col.own[id]; }).sort(function (a, b) { return tierOf(b) - tierOf(a); })[0];
    h += '<h3 class="sec">등급 올리기</h3><div class="crows"><button class="crow" data-act="col-set" data-id="grow"><span class="cr-thumb album">' + (best ? artOf(ITEM[best]) : artOf(ITEM.f1, true)) + '</span>' +
      '<span class="cr-txt"><b>칸 친구 · 가구 등급</b><small>올릴 수 있는 것 ' + rl + ' · 조각 ' + sh + '/' + SHARD_PACK + '</small><i class="prog"><i style="width:' + Math.min(100, Math.round(sh / SHARD_PACK * 100)) + '%"></i></i></span>' +
      (rl ? '<em class="cr-badge">올리기 ' + rl + '</em>' : sh >= SHARD_PACK ? '<em class="cr-badge">조각 교환</em>' : '') + '</button></div>';
    ['album', 'jigsaw'].forEach(function (type) {
      h += '<h3 class="sec">' + (type === 'album' ? '카드 도감' : '직소 퍼즐') + '</h3><div class="crows">';
      SETS.filter(function (s) { return s.type === type; }).forEach(function (st) {
        var own = st.items.filter(function (id) { return d.col.own[id]; }).length;
        var placed = st.items.filter(function (id) { return d.col.placed[id]; }).length;
        var wait = own - placed, done = !!d.col.done[st.id];
        var thumb;
        if (type === 'album') {
          var first = st.items.filter(function (id) { return d.col.own[id]; })[0];
          thumb = first ? artOf(ITEM[first]) : artOf(ITEM[st.items[0]], true);
        } else {
          var u = uid();
          thumb = '<svg viewBox="0 0 300 300" aria-hidden="true"' + (done ? '' : ' style="opacity:' + (0.25 + 0.75 * placed / 9).toFixed(2) + '"') + '>' + SCENES[st.id](u) + '</svg>';
        }
        h += '<button class="crow" data-act="col-set" data-id="' + st.id + '"><span class="cr-thumb ' + type + (first || type === 'jigsaw' ? '' : ' sil') + '">' + thumb + '</span>' +
          '<span class="cr-txt"><b>' + st.name + '</b><small>모은 것 ' + own + '/' + st.items.length + ' · 붙인 것 ' + placed + '/' + st.items.length + '</small>' +
          '<i class="prog"><i style="width:' + Math.round(placed / st.items.length * 100) + '%"></i></i></span>' +
          (done ? '<em class="cr-badge done">완성</em>' : wait > 0 ? '<em class="cr-badge">붙일 것 ' + wait + '</em>' : '') + '</button>';
      });
      h += '</div>';
    });
    h += '<p class="sub small">다 붙이면 꾸미기 아이템이 열려요. 가구를 모두 모으면 테두리·효과음 \'반짝\'이 열려요. 같은 것이 또 나오면 쌓여서 등급이 올라요(1개 → 3개 → 5개). 최고 등급에서 또 나오면 조각이 되고, 조각 10개는 카드팩 1개로 바꿔요.</p>';
    $('#col-body').innerHTML = h;
  }

  // ===================== 조합 화면 (끌어다 붙이기) =====================
  var cur = null, sel = null;
  function setupBoard(setId) {
    var st = setId === 'grow' ? GROW : setById(setId); if (!st) return;
    cur = st; sel = null;
    $('#board-title').textContent = st.name;
    renderBoard();
  }
  function renderBoard() {
    var st = cur, d = C.data, h = '';
    if (st.type === 'grow') { $('#board-body').innerHTML = growHTML(); return; }
    if (st.type === 'album') {
      h += '<div class="album">' + st.items.map(function (id) {
        var it = ITEM[id];
        if (d.col.placed[id]) return '<span class="aslot on" data-pos="' + id + '">' + cardHTML(id) + '</span>';
        return '<span class="aslot" data-slot="' + id + '" role="button" tabindex="0" aria-label="' + it.no + '번 자리"><span class="as-no">' + it.no + '</span><span class="as-sil">' + artOf(it, true) + '</span></span>';
      }).join('') + '</div>';
    } else {
      var u = uid(), clip = '', outl = '';
      st.items.forEach(function (id, k) {
        var p = piecePath(st.id, k);
        if (d.col.placed[id]) clip += '<path d="' + p + '"/>';
        outl += '<path d="' + p + '" class="' + (d.col.placed[id] ? 'po on' : 'po') + '"/>';
      });
      h += '<div class="jig"><svg viewBox="0 0 300 300" aria-hidden="true"><defs><clipPath id="' + u + 'cp">' + (clip || '<rect width="0" height="0"/>') + '</clipPath></defs>' +
        '<g class="ghost">' + SCENES[st.id](u + 'g') + '</g>' +
        '<g clip-path="url(#' + u + 'cp)">' + SCENES[st.id](u + 'p') + '</g>' + outl + '</svg>' +
        st.items.map(function (id, k) {
          var r = Math.floor(k / 3), c = k % 3;
          var style = 'left:' + (c * 33.333) + '%;top:' + (r * 33.333) + '%';
          return d.col.placed[id] ? '<span class="jslot on" style="' + style + '"></span>'
            : '<span class="jslot" data-slot="' + id + '" style="' + style + '" role="button" tabindex="0" aria-label="' + (k + 1) + '번 자리"></span>';
        }).join('') + '</div>';
    }
    var wait = st.items.filter(function (id) { return d.col.own[id] && !d.col.placed[id]; });
    h += '<div class="ctray-wrap"><p class="ct-head">' + (wait.length ? '끌어서 제자리에 붙여요 · 눌러서 고른 뒤 자리를 눌러도 돼요' : d.col.done[st.id] ? '완성했어요!' : '카드팩을 뜯으면 ' + (st.type === 'album' ? '카드' : '퍼즐 칸') + '이 여기에 나와요') + '</p>' +
      '<div class="ctray t-' + st.type + '" id="ctray">' + wait.map(function (id) {
        return '<button class="titem" data-drag="' + id + '" aria-label="' + ITEM[id].name + '">' + (st.type === 'album' ? cardHTML(id) : '<span class="pc">' + artOf(ITEM[id]) + '</span>') + '</button>';
      }).join('') + '</div></div>';
    if (d.col.done[st.id]) h += rewardBox(st);
    $('#board-body').innerHTML = h;
  }
  function rewardBox(st) {
    return '<div class="rwd"><p class="ps-kicker">완성 보상</p>' + rewardsOf(st.id).map(function (r) {
      return '<span class="rw-it">' + r.title + ' · <b>' + r.item.name + '</b></span>';
    }).join('') + '<button class="btn small-btn" data-act="look">꾸미기에서 바꾸기</button></div>';
  }
  function place(id, slotEl) {
    var d = C.data, st = cur;
    d.col.placed[id] = true;
    var r = slotEl.getBoundingClientRect();
    C.SND.play('snap'); C.vib(15);
    C.FX.ring(r.left + r.width / 2, r.top + r.height / 2, C.FX.color('y'));
    var done = st.items.every(function (x) { return d.col.placed[x]; });
    if (done && !d.col.done[st.id]) d.col.done[st.id] = true;
    C.persist();
    renderBoard();
    var placedEl = document.querySelector('[data-pos="' + id + '"]');
    if (placedEl) placedEl.classList.add('snapin');
    if (done && !d.col.shown[st.id]) {
      d.col.shown[st.id] = true; C.persist();
      setTimeout(function () { completeModal(st); }, 450);
    }
    C.applyLook();
  }
  function completeModal(st) {
    C.SND.play('clear'); C.FX.confetti();
    var prev = st.type !== 'jigsaw' ? '<div class="cm-art album">' + st.items.slice(0, 4).map(function (id) { return artOf(ITEM[id]); }).join('') + '</div>'
      : '<div class="cm-art jig"><svg viewBox="0 0 300 300" aria-hidden="true">' + SCENES[st.id](uid()) + '</svg></div>';
    var kick = st.type === 'album' ? '카드 도감' : st.type === 'room' ? '한칸 방' : '직소 퍼즐';
    C.openModal('<p class="ps-kicker">' + kick + '</p><h2 class="ps-big">완성!</h2>' + prev +
      '<p class="ps-line">' + (st.type === 'room' ? '가구 <b>' + st.items.length + '개</b>를 모두 모았어요' : '<b>' + st.name + '</b>을(를) 모두 붙였어요') + '</p>' +
      '<div class="rwd">' + rewardsOf(st.id).map(function (r) { return '<span class="rw-it new">' + r.title + ' · <b>' + r.item.name + '</b> 열림</span>'; }).join('') + '</div>' +
      '<button class="btn primary" data-act="look">꾸미기에서 바꾸기</button><button class="btn ghost" data-act="modal-close">닫기</button>');
  }
  function miss(slotEl) {
    C.SND.play('nope'); C.vib(40);
    if (slotEl) { slotEl.classList.remove('nope'); void slotEl.offsetWidth; slotEl.classList.add('nope'); }
    C.toast('여기가 아니에요. 번호와 모양을 맞춰 봐요');
  }
  function setSel(id) {
    sel = sel === id ? null : id;
    document.querySelectorAll('#ctray .titem').forEach(function (b) { b.classList.toggle('sel', b.dataset.drag === sel); });
    document.querySelectorAll('#board-body [data-slot]').forEach(function (s) { s.classList.toggle('hint', !!sel); });
    if (sel) C.SND.play('pick');
  }
  function tryPlace(id, slotEl) {
    if (!slotEl) return;
    if (slotEl.dataset.slot === id) { sel = null; place(id, slotEl); } else miss(slotEl);
  }
  var drag = null;
  function bindBoard() {
    var root = $('#board-body');
    root.addEventListener('pointerdown', function (e) {
      var it = e.target.closest('.titem'); if (!it) return;
      e.preventDefault();
      var r = it.getBoundingClientRect();
      drag = { id: it.dataset.drag, el: it, x0: e.clientX, y0: e.clientY, r: r, moved: false, clone: null, over: null, pid: e.pointerId };
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragUp);
      window.addEventListener('pointercancel', onDragUp);
    });
    root.addEventListener('click', function (e) {
      var it = e.target.closest('.titem');
      if (it) { if (e.detail === 0) setSel(it.dataset.drag); return; }
      var slot = e.target.closest('[data-slot]');
      if (slot && sel) tryPlace(sel, slot);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var slot = e.target.closest('[data-slot]');
      if (slot && sel) { e.preventDefault(); tryPlace(sel, slot); }
    });
  }
  function onDragMove(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      var c = drag.el.cloneNode(true);
      c.className = 'titem drag-clone' + (cur && cur.type === 'jigsaw' ? ' jig' : '');
      c.style.left = drag.r.left + 'px'; c.style.top = drag.r.top + 'px'; c.style.width = drag.r.width + 'px'; c.style.height = drag.r.height + 'px';
      document.body.appendChild(c);
      drag.clone = c; drag.el.classList.add('dragging');
      drag.scale = 1.12;
      var jb = document.querySelector('#board-body .jig');
      if (jb && cur && cur.type === 'jigsaw') drag.scale = (jb.getBoundingClientRect().width / 3 * (CELL + PAD * 2) / CELL) / drag.r.width;
      C.SND.play('pick');
    }
    drag.clone.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + drag.scale + ') rotate(' + Math.max(-8, Math.min(8, dx / 30)) + 'deg)';
    var under = document.elementFromPoint(e.clientX, e.clientY);
    var slot = under && under.closest && under.closest('#board-body [data-slot]');
    if (slot !== drag.over) {
      if (drag.over) drag.over.classList.remove('over');
      drag.over = slot; if (slot) slot.classList.add('over');
    }
  }
  function onDragUp() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', onDragUp);
    var g = drag; drag = null;
    if (!g) return;
    if (!g.moved) { setSel(g.id); return; }
    if (g.over) g.over.classList.remove('over');
    if (g.over && g.over.dataset.slot === g.id) {
      g.clone.remove(); sel = null; place(g.id, g.over); return;
    }
    if (g.over) miss(g.over);
    var c = g.clone;
    c.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)';
    c.style.transform = 'translate(0,0) scale(1)';
    setTimeout(function () { c.remove(); g.el.classList.remove('dragging'); }, 290);
  }

  // ===================== 등급 올리기 화면 (v0.10) =====================
  var GROW = { id: 'grow', type: 'grow', name: '등급 올리기' };
  function growHTML() {
    var d = C.data, sh = d.col.shards || 0, h = '';
    h += '<div class="shardbox"><span class="sb-ic">' + shardIcon() + '</span><span class="sb-txt"><b>조각 ' + sh + '/' + SHARD_PACK + '</b><small>최고 등급에서 또 나오면 조각 +1 · 퍼즐 칸이 겹쳐도 조각</small>' +
      '<i class="prog"><i style="width:' + Math.min(100, Math.round(sh / SHARD_PACK * 100)) + '%"></i></i></span>' +
      '<button class="btn primary" data-act="shard-swap"' + (sh >= SHARD_PACK ? '' : ' disabled') + '>카드팩으로<br>바꾸기</button></div>';
    h += '<p class="ct-head">같은 것을 1개 → 3개 → 5개 모으면 한 단계씩 올라요</p>';
    [['friends', '칸 친구들'], ['furni', '한칸 방 가구']].forEach(function (g) {
      h += '<h3 class="sec">' + g[1] + '</h3><div class="ggrid">';
      setById(g[0]).items.forEach(function (id) {
        var it = ITEM[id], t = tierOf(id);
        if (!t) { h += '<span class="gtile sil"><span class="gt-art">' + artOf(it, true) + '</span><b>???</b></span>'; return; }
        var n = needOf(id), have = dupOf(id), ok = canUp(id);
        h += '<button class="gtile tr' + t + (ok ? ' ready' : '') + '" data-act="grow-item" data-id="' + id + '" style="--cc:' + it.art.c + '"><span class="gt-art">' + artOf(it) + '</span><b>' + nameOf(id) + '</b>' + pips(t) +
          (t >= MAXT ? '<small class="gt-max">최고 등급</small>' : '<i class="prog"><i style="width:' + Math.min(100, Math.round(have / n * 100)) + '%"></i></i><small>' + have + '/' + n + '</small>') +
          (ok ? '<em class="gt-up">올리기!</em>' : '') + '</button>';
      });
      h += '</div>';
    });
    return h;
  }
  function shardIcon() { return '<svg viewBox="0 0 10 10" aria-hidden="true" style="image-rendering:pixelated"><path d="M4 0h2v1h1v1h1v2h1v2h-1v2h-1v1h-1v1h-2v-1h-1v-1h-1v-2h-1v-2h1v-2h1v-1h1z" fill="#1b1d3a"/><path d="M4 1h2v1h1v2h1v2h-1v2h-1v1h-2v-1h-1v-2h-1v-2h1v-2h1z" fill="#a78bfa"/><path d="M4 2h1v1h1v1h-2z" fill="#e4dcff"/></svg>'; }
  function growModal(id) {
    var it = ITEM[id], t = tierOf(id); if (!t) return;
    var n = needOf(id), have = dupOf(id), ok = canUp(id), max = t >= MAXT;
    var h = '<div class="gm"><p class="ps-kicker">' + (it.set.id === 'friends' ? '칸 친구' : '한칸 방 가구') + ' · ' + tierName(id) + '</p>' +
      '<div class="gm-art tr' + t + '"><span class="gm-cur">' + artOf(it, false, t) + '</span>' +
      (max ? '' : '<span class="gm-arrow" aria-hidden="true">▶</span><span class="gm-next">' + artOf(it, false, t + 1) + '<small>' + tierName(id, t + 1) + '</small></span>') + '</div>' +
      '<h2 class="ps-big gm-name">' + nameOf(id) + '</h2>' + pips(t) +
      (max ? '<p class="ps-line">최고 등급이에요. 또 나오면 <b>조각 +1</b></p>'
        : '<p class="ps-line">겹친 것 <b>' + have + '/' + n + '</b>' + (ok ? ' · 지금 올릴 수 있어요' : ' · ' + (n - have) + '개 더 모아요') + '</p><i class="prog gm-prog"><i style="width:' + Math.min(100, Math.round(have / n * 100)) + '%"></i></i>') +
      (max ? '' : '<button class="btn primary" data-act="grow-up" data-id="' + id + '"' + (ok ? '' : ' disabled') + '>등급 올리기</button>') +
      '<button class="btn ghost" data-act="modal-close">닫기</button></div>';
    C.openModal(h);
  }
  function doUpgrade(id) {
    if (!upgrade(id)) return;
    C.persist(); C.applyLook();
    C.SND.play('clear'); C.vib(30);
    growModal(id);
    var a = document.querySelector('.gm-cur');
    if (a) { a.classList.add('gm-pop'); var r = a.getBoundingClientRect(); C.FX.burst(r.left + r.width / 2, r.top + r.height / 2, ['#f8c632', '#fff0a0', '#fff'], 28, 1); C.FX.ring(r.left + r.width / 2, r.top + r.height / 2, '#f8c632'); }
    if (cur && cur.type === 'grow') renderBoard();
  }
  function shardSwap() {
    var col = C.data.col;
    if ((col.shards || 0) < SHARD_PACK) { C.toast('조각 ' + SHARD_PACK + '개를 모으면 바꿀 수 있어요'); return; }
    col.shards -= SHARD_PACK; C.data.packs = (C.data.packs || 0) + 1;
    C.persist(); C.SND.play('newcard');
    C.toast('조각 ' + SHARD_PACK + '개를 카드팩 1개로 바꿨어요');
    if (cur && cur.type === 'grow') renderBoard();
  }

  // ===================== 꾸미기 화면 =====================
  var THEME_SW = { night: ['#13163a', '#272c69'], sunset: ['#2a1430', '#5a2c5f'], sea: ['#052338', '#12496b'] };
  function setupLook() {
    var d = C.data, L = d.look, n = count(), h = '';
    h += '<div class="look-top">' + avatarHTML(L, 'big') + '<div><b>나의 프로필</b><small>총 ' + (d.clearsTotal || 0) + '단계 · 수집 ' + n.own + '/' + n.total + '</small></div></div>';
    LOOK.forEach(function (g) {
      h += '<h3 class="sec">' + g.title + '</h3><div class="lgrid k-' + g.kind + '">';
      g.items.forEach(function (it) {
        var on = L[g.kind] === it.id, lock = !unlocked(g.kind, it.id), pv = '';
        if (g.kind === 'avatar') pv = '<span class="lp-ava' + (lock ? ' sil' : '') + '">' + friendArt(FRIENDS.filter(function (f) { return f.id === it.id; })[0], lock) + '</span>';
        else if (g.kind === 'frame') pv = avatarHTML({ avatar: L.avatar, frame: it.id }, 'sm');
        else if (g.kind === 'theme') pv = '<span class="lp-sw" style="background:linear-gradient(135deg,' + THEME_SW[it.id][0] + ' 50%,' + THEME_SW[it.id][1] + ' 50%)"></span>';
        else pv = '<span class="lp-ic">' + C.icon(g.kind === 'bgm' ? 'note' : 'bell') + '</span>';
        h += '<button class="lopt' + (on ? ' on' : '') + (lock ? ' locked' : '') + '" data-act="look-set" data-id="' + g.kind + ':' + it.id + '" aria-pressed="' + on + '">' + pv +
          '<span class="lo-name">' + it.name + '</span>' + (lock ? '<small>' + C.icon('lock') + (it.needLv ? '아무 규칙 ' + it.needLv + '단계' : it.need === 'furni' ? '가구 모두' : setById(it.need).name) + '</small>' : '') + '</button>';
      });
      h += '</div>';
    });
    h += '<p class="sub small">카드 도감·직소 퍼즐을 완성하거나 한칸 방 가구를 모두 모으면 새 아이템이 열려요.</p>';
    $('#look-body').innerHTML = h;
  }
  function setLook(arg) {
    var p = String(arg).split(':'), kind = p[0], id = p[1];
    if (!unlocked(kind, id)) {
      var it = lookItem(kind, id), st = it && setById(it.need);
      if (it && it.needLv) { C.toast('아무 규칙이나 ' + it.needLv + '단계를 깨면 열려요'); C.SND.play('nope'); return; }
      C.toast(st && st.type === 'room' ? '한칸 방 가구를 모두 모으면 열려요' : st ? '\'' + st.name + '\' ' + (st.type === 'album' ? '도감' : '퍼즐') + '을 완성하면 열려요' : '아직 잠겨 있어요');
      C.SND.play('nope');
      return;
    }
    C.data.look[kind] = id; C.persist(); C.applyLook();
    if (kind === 'sfx') C.SND.play('correct', 2); else C.SND.play('click');
    setupLook();
  }
  function fixLook() {
    var L = C.data.look;
    Object.keys(LOOK_DEFAULT).forEach(function (k) { if (!unlocked(k, L[k])) L[k] = LOOK_DEFAULT[k]; });
    return L;
  }

  function init(ctx) {
    C = ctx;
    var col = C.data.col;
    col.own = col.own || {}; col.placed = col.placed || {}; col.done = col.done || {}; col.shown = col.shown || {};
    col.tier = col.tier || {}; col.dup = col.dup || {}; col.shards = col.shards || 0; // v0.10 등급
    // v0.10.1: 동글이(기본 프로필·방에 늘 있는 친구)는 처음부터 가진 것으로, 도감 1번 칸도 채워 둔다
    if (!col.own.f1) { col.own.f1 = true; col.placed.f1 = true; col.tier.f1 = col.tier.f1 || 1; }
    // v0.9: 보석 도감을 뺐다. 갖고 있던 보석 카드는 1장당 코인 5개로 바꿔 준다(완성 보상은 그대로 열려 있음)
    var gems = Object.keys(col.own).filter(function (id) { return /^g[1-8]$/.test(id); });
    if (gems.length) {
      gems.forEach(function (id) { delete col.own[id]; delete col.placed[id]; });
      C.give({ coins: gems.length * 5 });
      var gc = gems.length * 5;
      setTimeout(function () { C.toast('보석 도감이 가구로 바뀌어서, 보석 카드를 코인 ' + gc + '개로 바꿨어요'); }, 3200);
    }
    C.checkFurniDone = function () {
      var st = setById('furni');
      if (col.done.furni && !col.shown.furni) { col.shown.furni = true; C.persist(); completeModal(st); }
    };
    C.tierOf = tierOf; C.canUp = canUp; C.nameOf = nameOf; C.pips = pips;
    Room.init(C);
    try { document.documentElement.style.setProperty('--nbg', 'url("' + Pixel.bgURL() + '")'); } catch (e) {}
    bindBoard();
  }

  return {
    init: init, setupCol: setupCol, setupBoard: setupBoard, setupLook: setupLook, setLook: setLook, fixLook: fixLook,
    openPack: openPack, tear: tear, packMini: function () { return packHTML('mini'); },
    growModal: growModal, upgrade: doUpgrade, shardSwap: shardSwap, tierOf: tierOf,
    avatarHTML: avatarHTML, count: count, unlocked: unlocked, refreshBoard: function () { if (cur) renderBoard(); },
    _test: { piecePath: piecePath, SETS: SETS, ALL: ALL }
  };
})();
