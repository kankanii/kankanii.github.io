/*
 * 한칸 찾기 · fx.js — 화면 이펙트 (파티클, 화면 전환, 배경) · 모든 스토어 공통
 */
window.FX = (function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = getComputedStyle(document.documentElement);
  function tok(name) { return css.getPropertyValue(name).trim(); }
  var PALETTE = ['--g', '--r', '--b', '--y'].map(tok);

  // ---------- 파티클 ----------
  var cv = document.getElementById('fx-canvas'), ctx = cv.getContext('2d');
  var parts = [], raf = 0, dpr = 1;
  function resize(c) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  }
  resize(cv);
  addEventListener('resize', function () { resize(cv); resize(bg); drawBgOnce(); });

  function loop() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life > 0; });
    parts.forEach(function (p) {
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.kind === 'ring') {
        p.r += p.vr; p.vr *= 0.93;
        ctx.strokeStyle = p.color; ctx.lineWidth = 4 * p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        return;
      }
      p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      var s = p.size;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.25); else ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill(); ctx.restore();
    });
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function burst(x, y, colors, count, power) {
    if (reduce) return;
    colors = colors && colors.length ? colors : PALETTE;
    power = power || 1;
    for (var i = 0; i < (count || 18); i++) {
      var a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 5) * power;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3 * power, g: 0.25, size: 5 + Math.random() * 8,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1, decay: 0.016 + Math.random() * 0.014,
        color: colors[i % colors.length] });
    }
    kick();
  }
  function ring(x, y, color) {
    if (reduce) return;
    parts.push({ kind: 'ring', x: x, y: y, r: 10, vr: 9, life: 1, decay: 0.045, color: color || PALETTE[3] });
    kick();
  }
  function confetti() {
    if (reduce) return;
    for (var i = 0; i < 70; i++) {
      parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        g: 0.05, size: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 1,
        decay: 0.006 + Math.random() * 0.004, color: PALETTE[i % 4] });
    }
    kick();
  }
  function centerOf(el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

  // ---------- 화면 전환: 칸 모자이크 ----------
  var wipeEl = document.getElementById('wipe'), busy = false;
  function wipe(swap) {
    if (reduce || busy || !wipeEl.animate) { swap(); return Promise.resolve(); }
    busy = true;
    // v0.4.2: 칸 약 56px(가로 7칸) · 색 칸은 대각선 줄무늬로 규칙적으로.
    // 끊김을 막으려고 transform·opacity만 움직인다(둥근 모서리는 CSS에 고정).
    var cols = Math.max(6, Math.min(10, Math.round(innerWidth / 56))), size = Math.ceil(innerWidth / cols), rows = Math.ceil(innerHeight / size) + 1;
    wipeEl.style.gridTemplateColumns = 'repeat(' + cols + ',' + size + 'px)';
    wipeEl.style.gridAutoRows = size + 'px';
    var html = '', board = tok('--board');
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var k = r + c, col = k % 4 === 0 ? PALETTE[(k / 4) % 4] : board;
      html += '<i style="background:' + col + '" data-d="' + k + '"></i>';
    }
    wipeEl.innerHTML = html; wipeEl.hidden = false;
    var cells = Array.prototype.slice.call(wipeEl.children);
    var max = rows + cols, stepIn = 320 / max, stepOut = 300 / max;
    var IN = { duration: 280, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'both' };
    var ins = cells.map(function (el) {
      return el.animate([{ transform: 'scale(0) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.22) rotate(0)', opacity: 1 }],
        Object.assign({ delay: +el.dataset.d * stepIn }, IN)).finished;
    });
    return Promise.all(ins).then(function () {
      swap();
      var outs = cells.map(function (el) {
        return el.animate([{ transform: 'scale(1.22) rotate(0)', opacity: 1 }, { transform: 'scale(0) rotate(20deg)', opacity: 0 }],
          Object.assign({}, IN, { delay: (max - +el.dataset.d) * stepOut })).finished;
      });
      return Promise.all(outs);
    }).then(function () { wipeEl.hidden = true; wipeEl.innerHTML = ''; busy = false; }, function () { wipeEl.hidden = true; busy = false; });
  }

  // ---------- 배경: 천천히 떠다니는 칸 ----------
  var bg = document.getElementById('bg-canvas'), bctx = bg.getContext('2d'), floaters = [];
  resize(bg);
  for (var i = 0; i < 14; i++) {
    floaters.push({ x: Math.random(), y: Math.random(), s: 18 + Math.random() * 46, v: 0.00008 + Math.random() * 0.00016,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.002, a: 0.05 + Math.random() * 0.07, c: PALETTE[i % 4] });
  }
  function drawBg() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    floaters.forEach(function (f) {
      bctx.save(); bctx.globalAlpha = f.a; bctx.fillStyle = f.c;
      bctx.translate(f.x * innerWidth, f.y * innerHeight); bctx.rotate(f.rot);
      bctx.beginPath();
      if (bctx.roundRect) bctx.roundRect(-f.s / 2, -f.s / 2, f.s, f.s, f.s * 0.22); else bctx.rect(-f.s / 2, -f.s / 2, f.s, f.s);
      bctx.fill(); bctx.restore();
    });
  }
  function drawBgOnce() { drawBg(); }
  var lastT = 0;
  function bgLoop(t) {
    var dt = Math.min(50, t - (lastT || t)); lastT = t;
    floaters.forEach(function (f) {
      f.y -= f.v * dt; f.rot += f.vr * dt * 0.06;
      if (f.y < -0.1) { f.y = 1.1; f.x = Math.random(); }
    });
    drawBg();
    requestAnimationFrame(bgLoop);
  }
  if (reduce) drawBg(); else requestAnimationFrame(bgLoop);

  return { burst: burst, ring: ring, confetti: confetti, wipe: wipe, centerOf: centerOf, color: function (id) { return tok('--' + id); }, reduce: reduce };
})();
