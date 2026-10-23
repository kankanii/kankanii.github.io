/*
 * 한칸 찾기 · medals.js — 규칙별 성장 메달 (v0.8, 모든 스토어 공통)
 * 경험치(XP)가 쌓이면 메달이 7단계로 자란다. 과하지 않게 한 단계마다 한 가지씩 더해진다.
 *  1 새싹  : 테두리만
 *  2 동    : 2/6 칠해짐
 *  3 은    : 4/6 칠해짐
 *  4 금    : 가득 칠해짐 + 아래 별 장식
 *  5 무지개: 겉면에 무지갯빛 테 (천천히 흐름)
 *  6 빛    : 뒤에 후광과 빛살 (천천히 돎)
 *  7 전설  : 반짝이 + 앞면을 스치는 빛
 */
window.Medals = (function () {
  'use strict';
  var TIERS = [
    { name: '없음', xp: 0 },
    { name: '새싹', xp: 10 },
    { name: '동', xp: 50 },
    { name: '은', xp: 120 },
    { name: '금', xp: 220 },
    { name: '무지개', xp: 360 },
    { name: '빛', xp: 550 },
    { name: '전설', xp: 800 }
  ];
  var COLOR = { dist: '#f5b82e', lines: '#4181f6', twin: '#ff7eb6', count: '#2cc271', lonely: '#5fc8f2', mirror: '#a78bfa', rule: '#f1535b', arrow: '#ff9a3c' };
  var n = 0;
  function uid() { return 'md' + (++n); }
  function tierOf(xp) { var t = 0; for (var i = 1; i < TIERS.length; i++) if (xp >= TIERS[i].xp) t = i; return t; }
  function progress(xp) {
    var t = tierOf(xp);
    if (t >= TIERS.length - 1) return { tier: t, pct: 1, need: 0 };
    var a = TIERS[t].xp, b = TIERS[t + 1].xp;
    return { tier: t, pct: (xp - a) / (b - a), need: b - xp };
  }
  function shade(hex, k) {
    var c = hex.replace('#', ''), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = parseInt(c.substr(i * 2, 2), 16);
      v = k > 0 ? Math.round(v + (255 - v) * k) : Math.round(v * (1 + k));
      o += ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }
    return o;
  }
  var RAINBOW = ['#ff5f6d', '#ffb347', '#ffe66d', '#5be49b', '#4fc3f7', '#9d7bff', '#ff5f6d'];
  // 메달 그림 (viewBox 0 0 100 124). tier 0 = 아직 없음(그림자)
  function svg(rule, tier) {
    var u = uid(), col = COLOR[rule] || '#f8c632', cx = 50, cy = 76, R = 34;
    if (!tier) {
      return '<svg class="medal t0" viewBox="0 0 100 124" aria-hidden="true">' +
        '<path d="M30 6h14l10 30H40zM70 6H56L46 36h14z" fill="currentColor" opacity=".35"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="currentColor" opacity=".35"/>' +
        '<svg x="32" y="58" width="36" height="36" viewBox="0 0 24 24" style="color:var(--board)"><use href="#ic-' + rule + '"/></svg></svg>';
    }
    var fill = tier === 1 ? 0 : tier === 2 ? 2 / 6 : tier === 3 ? 4 / 6 : 1;
    var lite = shade(col, 0.55), dark = shade(col, -0.35), h = '';
    var defs = '<linearGradient id="' + u + 'g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="' + lite + '"/><stop offset=".5" stop-color="' + col + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>' +
      '<clipPath id="' + u + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 3) + '"/></clipPath>' +
      '<linearGradient id="' + u + 'r" x1="0" y1="0" x2="1" y2="1">' + RAINBOW.map(function (c, i) { return '<stop offset="' + (i / 6).toFixed(3) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient>' +
      '<radialGradient id="' + u + 'h"><stop offset=".45" stop-color="#fff6c8" stop-opacity=".75"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + u + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
    // 6 빛: 후광 + 빛살
    if (tier >= 6) {
      var rays = '';
      for (var k = 0; k < 12; k++) {
        var a = k * Math.PI / 6, x1 = cx + Math.cos(a - 0.09) * 40, y1 = cy + Math.sin(a - 0.09) * 40, x2 = cx + Math.cos(a + 0.09) * 40, y2 = cy + Math.sin(a + 0.09) * 40,
          x3 = cx + Math.cos(a) * 49, y3 = cy + Math.sin(a) * 49;
        rays += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x3.toFixed(1) + ' ' + y3.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + 'z"/>';
      }
      h += '<circle cx="' + cx + '" cy="' + cy + '" r="48" fill="url(#' + u + 'h)" class="md-halo"/><g class="md-rays" fill="#ffd96a" opacity=".85">' + rays + '</g>';
    }
    // 리본
    var rib = tier >= 5 ? 'url(#' + u + 'r)' : tier === 1 ? '#9aa0c8' : col, ribD = tier === 1 ? '#6b7099' : dark;
    h += '<path d="M30 6h14l10 30H40z" fill="' + rib + '"/><path d="M70 6H56L46 36h14z" fill="' + rib + '"/>' +
      '<path d="M30 6h14l3 9H33z" fill="' + ribD + '" opacity=".35"/><path d="M70 6H56l-3 9h14z" fill="' + ribD + '" opacity=".35"/>';
    // 메달 몸통
    h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + (tier === 1 ? 'var(--board)' : shade(col, -0.55)) + '"/>';
    if (fill > 0) {
      var top = cy + (R - 3) - 2 * (R - 3) * fill;
      var wave = fill < 1 ? 'M10 ' + top + ' q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 V130 H10z' : 'M10 30 H90 V130 H10z';
      h += '<g clip-path="url(#' + u + 'c)"><path d="' + wave + '" fill="url(#' + u + 'g)"/>' +
        (fill === 1 ? '<ellipse cx="' + (cx - 11) + '" cy="' + (cy - 15) + '" rx="13" ry="7" fill="#fff" opacity=".35" transform="rotate(-30 ' + (cx - 11) + ' ' + (cy - 15) + ')"/>' : '') + '</g>';
    }
    // 테두리 (5부터 무지개)
    h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 1.5) + '" fill="none" stroke="' + (tier >= 5 ? 'url(#' + u + 'r)' : tier === 1 ? '#9aa0c8' : lite) + '" stroke-width="' + (tier >= 5 ? 5 : 3.5) + '"' + (tier >= 5 ? ' class="md-rim"' : '') + '/>';
    h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 7) + '" fill="none" stroke="' + (tier === 1 ? '#9aa0c8' : '#fff') + '" stroke-opacity="' + (tier === 1 ? '.5' : '.35') + '" stroke-width="1.5" stroke-dasharray="' + (tier === 1 ? '3 3' : 'none') + '"/>';
    // 규칙 아이콘
    h += '<svg x="' + (cx - 16) + '" y="' + (cy - 16) + '" width="32" height="32" viewBox="0 0 24 24" style="color:' + (tier === 1 ? '#c3c7ea' : fill === 1 ? '#fff' : '#fff') + '"><use href="#ic-' + rule + '"/></svg>';
    // 4 금: 아래 별
    if (tier >= 4) h += '<path d="M50 104.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#ffe27a" stroke="' + dark + '" stroke-width="1"/>';
    // 7 전설: 앞면을 스치는 빛 + 반짝이
    if (tier >= 7) {
      h += '<g clip-path="url(#' + u + 'c)"><rect x="-30" y="30" width="22" height="100" fill="url(#' + u + 's)" transform="rotate(20 50 76)" class="md-shine"/></g>' +
        '<g fill="#fff" class="md-spark"><path d="M14 40l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/><path d="M86 58l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z"/><path d="M80 104l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z"/></g>';
    }
    return '<svg class="medal t' + tier + '" viewBox="0 0 100 124" aria-hidden="true"><defs>' + defs + '</defs>' + h + '</svg>';
  }
  return { TIERS: TIERS, COLOR: COLOR, tierOf: tierOf, progress: progress, svg: svg };
})();
