/*
 * 한칸 찾기 · sound.js — 효과음과 배경음 (모든 스토어 공통)
 * 지금은 Web Audio로 직접 합성한다. 음원 파일을 쓰게 되면
 * Sound.useFiles({ title: 'audio/bgm-title.mp3', play: 'audio/bgm-play.mp3' }) 로 바꿔 끼운다.
 * v0.4: 소리 +50%(효과음 버스 1.5, 배경음 0.75) + 끝단 압축기(찢어짐 방지).
 *       배경음 3종(basic·orgel·chip), 효과음 2종(basic·sparkle) — 꾸미기 아이템으로 바꾼다.
 */
window.Sound = (function () {
  'use strict';
  var ac = null, master, comp, sfxBus, musicBus, rev, noiseBuf;
  var sfxOn = true, musicOn = true, mode = 'off', ducked = false;
  var MUSIC_VOL = 0.75; // v0.3 0.5 → +50%
  var SFX_VOL = 1.5;    // v0.3 1.0 → +50%
  var bgmId = 'basic', sfxSet = 'basic';

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function impulse(sec) {
    var len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }
  function init() {
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -8; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = 0.9; master.connect(comp);
      sfxBus = ac.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      rev = ac.createConvolver(); rev.buffer = impulse(2.2);
      var rg = ac.createGain(); rg.gain.value = 0.32; rev.connect(rg); rg.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { ac = null; return false; }
  }

  // ---------- 소리 재료 ----------
  function tone(f, t, dur, o) {
    o = o || {};
    var osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    var a = o.attack || 0.004, v = o.gain || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = g;
    if (o.lp) { var f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; g.connect(f2); out = f2; }
    osc.connect(g);
    out.connect(o.bus || sfxBus);
    if (o.wet) out.connect(rev);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(t, dur, o) {
    o = o || {};
    var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.05, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    if (o.wet) g.connect(rev);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function now() { return ac.currentTime + 0.005; }
  function ready() { return ac && sfxOn && ac.state === 'running'; }

  // ---------- 효과음 ----------
  var PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];
  var lastDeal = 0;
  var SFX = {
    click: function (t) { tone(1046, t, 0.06, { gain: 0.08 }); tone(1568, t + 0.012, 0.05, { gain: 0.04 }); },
    deal: function (t) {
      if (t - lastDeal < 0.035) return; lastDeal = t;
      tone(1300 + Math.random() * 500, t, 0.04, { type: 'triangle', gain: 0.035 });
      noise(t, 0.025, { type: 'highpass', freq: 3500, gain: 0.02 });
    },
    correct: function (t, combo) {
      var s = Math.min(combo || 0, 6);
      [0, 2, 4].forEach(function (k, i) {
        var f = mtof(PENTA[s + k]);
        tone(f, t + i * 0.05, 0.35, { gain: 0.09, wet: true });
        tone(f * 2, t + i * 0.05, 0.12, { type: 'triangle', gain: 0.025 });
      });
      noise(t, 0.08, { type: 'highpass', freq: 6000, gain: 0.03 });
    },
    wrong: function (t) {
      tone(170, t, 0.24, { glide: 80, gain: 0.22 });
      tone(120, t, 0.18, { type: 'square', gain: 0.03, lp: 500 });
      noise(t, 0.12, { type: 'lowpass', freq: 700, gain: 0.12 });
    },
    tick: function (t) { tone(880, t, 0.07, { type: 'triangle', gain: 0.1 }); noise(t, 0.03, { freq: 2600, q: 4, gain: 0.04 }); },
    go: function (t) {
      [60, 64, 67, 72].forEach(function (m, i) { tone(mtof(m), t + i * 0.03, 0.5, { type: 'triangle', gain: 0.06, wet: true }); });
      tone(mtof(84), t + 0.12, 0.4, { gain: 0.05, wet: true });
    },
    whoosh: function (t) { noise(t, 0.32, { freq: 300, sweep: 2600, q: 0.8, gain: 0.07, attack: 0.12 }); },
    end: function (t) { [76, 72, 67].forEach(function (m, i) { tone(mtof(m), t + i * 0.13, 0.32, { type: 'triangle', gain: 0.09, wet: true }); }); },
    best: function (t) {
      [72, 76, 79, 84, 88, 91].forEach(function (m, i) { tone(mtof(m), t + i * 0.07, 0.45, { gain: 0.07, wet: true }); });
      noise(t + 0.3, 0.6, { type: 'highpass', freq: 7000, gain: 0.03, attack: 0.2 });
    },
    low: function (t) { tone(1760, t, 0.04, { gain: 0.05 }); },
    count: function (t, k) { tone(mtof(PENTA[(k || 0) % PENTA.length]), t, 0.06, { type: 'triangle', gain: 0.05 }); },
    heart: function (t) {
      tone(660, t, 0.12, { type: 'triangle', gain: 0.08 });
      tone(440, t + 0.1, 0.25, { type: 'triangle', glide: 300, gain: 0.08 });
    },
    coin: function (t) { tone(1318.5, t, 0.08, { type: 'square', gain: 0.03, lp: 4000 }); tone(1975.5, t + 0.07, 0.25, { type: 'square', gain: 0.03, lp: 4000, wet: true }); },
    hint: function (t) {
      [84, 88, 91, 96].forEach(function (m, i) { tone(mtof(m), t + i * 0.04, 0.3, { gain: 0.04, wet: true }); });
      noise(t, 0.4, { type: 'highpass', freq: 6000, gain: 0.025, attack: 0.1 });
    },
    clear: function (t) {
      [67, 72, 76, 79].forEach(function (m, i) { tone(mtof(m), t + i * 0.09, 0.4, { type: 'triangle', gain: 0.08, wet: true }); });
      [72, 76, 79, 84].forEach(function (m) { tone(mtof(m), t + 0.4, 0.8, { gain: 0.035, wet: true }); });
    },
    fail: function (t) { [67, 63, 60, 55].forEach(function (m, i) { tone(mtof(m), t + i * 0.14, 0.3, { type: 'triangle', gain: 0.08, wet: true }); }); },
    open: function (t) { tone(520, t, 0.1, { glide: 900, gain: 0.05 }); noise(t, 0.08, { freq: 1800, gain: 0.025 }); },
    // v0.4: 카드팩 · 조합
    rip: function (t) {
      noise(t, 0.28, { type: 'bandpass', freq: 1200, sweep: 5200, q: 0.7, gain: 0.16, attack: 0.02 });
      noise(t + 0.05, 0.2, { type: 'highpass', freq: 4000, gain: 0.06 });
      tone(300, t, 0.2, { glide: 900, type: 'triangle', gain: 0.04 });
    },
    slice: function (t) { noise(t, 0.06, { type: 'highpass', freq: 5000, gain: 0.025 }); },
    flip: function (t, k) {
      noise(t, 0.09, { freq: 2200, sweep: 600, q: 1.2, gain: 0.05 });
      tone(mtof(PENTA[(k || 0) + 3]), t + 0.04, 0.3, { gain: 0.07, wet: true });
    },
    newcard: function (t) { [79, 84, 88].forEach(function (m, i) { tone(mtof(m), t + i * 0.06, 0.4, { gain: 0.06, wet: true }); }); },
    snap: function (t) {
      tone(220, t, 0.08, { type: 'triangle', glide: 140, gain: 0.14 });
      noise(t, 0.04, { type: 'lowpass', freq: 1500, gain: 0.08 });
      tone(mtof(84), t + 0.05, 0.3, { gain: 0.05, wet: true });
    },
    nope: function (t) { tone(240, t, 0.14, { type: 'triangle', glide: 180, gain: 0.08 }); },
    pick: function (t) { tone(880, t, 0.05, { type: 'triangle', gain: 0.05 }); },
    // v0.9 한칸 방: 친구가 콩 뛰기 · 가구 통통
    hop: function (t) { tone(520, t, 0.16, { type: 'triangle', glide: 1180, gain: 0.07 }); tone(1568, t + 0.1, 0.12, { gain: 0.03, wet: true }); },
    boing: function (t) { tone(300, t, 0.2, { type: 'triangle', glide: 520, gain: 0.07 }); tone(620, t + 0.06, 0.14, { type: 'triangle', glide: 380, gain: 0.04 }); }
  };
  // ---------- 효과음 묶음: 반짝 (실로폰·종) ----------
  function bell(f, t, dur, v) {
    tone(f, t, dur, { gain: v, wet: true });
    tone(f * 2.76, t, dur * 0.4, { gain: v * 0.3 });
    tone(f * 5.4, t, dur * 0.2, { gain: v * 0.12 });
  }
  var SETS = {
    basic: {},
    sparkle: {
      click: function (t) { bell(2093, t, 0.16, 0.05); },
      correct: function (t, combo) {
        var s = Math.min(combo || 0, 6);
        [0, 2, 4, 7].forEach(function (k, i) { bell(mtof(PENTA[Math.min(PENTA.length - 1, s + k)]), t + i * 0.045, 0.5, 0.06); });
        noise(t, 0.3, { type: 'highpass', freq: 7000, gain: 0.03, attack: 0.05 });
      },
      wrong: function (t) { tone(330, t, 0.3, { type: 'triangle', glide: 200, gain: 0.15 }); bell(185, t, 0.45, 0.06); },
      coin: function (t) { bell(1568, t, 0.25, 0.06); bell(2637, t + 0.07, 0.45, 0.05); },
      clear: function (t) {
        [72, 76, 79, 84, 88].forEach(function (m, i) { bell(mtof(m), t + i * 0.08, 0.7, 0.05); });
        noise(t + 0.3, 0.7, { type: 'highpass', freq: 7500, gain: 0.03, attack: 0.25 });
      },
      deal: function (t) { if (t - lastDeal < 0.035) return; lastDeal = t; bell(2400 + Math.random() * 800, t, 0.06, 0.018); },
      snap: function (t) { bell(1318.5, t, 0.3, 0.06); tone(200, t, 0.06, { type: 'triangle', gain: 0.08 }); },
      tick: function (t) { bell(1760, t, 0.12, 0.06); }
    }
  };
  function play(name, arg) {
    if (!ready()) return;
    var f = (SETS[sfxSet] && SETS[sfxSet][name]) || SFX[name];
    try { f(now(), arg); } catch (e) {}
  }

  // ---------- 배경음 (생성형 루프) ----------
  // basic: 92 BPM, Am7 – Fmaj7 – Cmaj7 – G6 (8분음표 단위)
  var STEP = 60 / 92 / 2;
  var PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 64]];
  var ROOT = [45, 41, 48, 43];
  var ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  var stepIdx = 0, nextT = 0, timer = 0, fileEl = null, files = null;

  function marimba(f, t, v) {
    tone(f, t, 0.5, { gain: v, bus: musicBus, wet: true });
    tone(f * 4, t, 0.05, { gain: v * 0.18, bus: musicBus });
  }
  function pad(chord, t, len) {
    chord.forEach(function (m) {
      [-7, 7].forEach(function (dt) {
        tone(mtof(m), t, len, { type: 'triangle', gain: 0.022, attack: 0.5, detune: dt, lp: 900, bus: musicBus, wet: true });
      });
    });
  }
  function playStep(s, t) {
    var bar = Math.floor(s / 8) % 4, pos = s % 8, ch = PROG[bar];
    var play = mode === 'play' || mode === 'hurry';
    if (pos === 0) { pad(ch, t, STEP * 8.5); tone(mtof(ROOT[bar]), t, STEP * 3, { gain: 0.11, bus: musicBus, lp: 400 }); }
    if (play && pos === 4) tone(mtof(ROOT[bar] + 7), t, STEP * 2, { gain: 0.07, bus: musicBus, lp: 400 });
    var p = mode === 'title' ? 0.5 : 0.85;
    if (Math.random() < p) marimba(mtof(ch[ARP[pos]] + 12), t, pos % 2 ? 0.035 : 0.05);
    if (play && (pos === 0 || pos === 4)) tone(110, t, 0.14, { glide: 45, gain: 0.12, bus: musicBus });
    if (play && pos % 2) noise(t, 0.035, { type: 'highpass', freq: 7500, gain: 0.018, bus: musicBus });
    if (mode === 'hurry' && pos % 2 === 0) noise(t, 0.03, { type: 'highpass', freq: 8000, gain: 0.014, bus: musicBus });
  }
  // orgel: 오르골 — 76 BPM, Fmaj7 – Em7 – Dm7 – Cmaj7, 북 없음
  var PROG_O = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]];
  var ARP_O = [0, 2, 1, 3, 2, 1, 0, 2];
  function playStepOrgel(s, t) {
    var bar = Math.floor(s / 8) % 4, pos = s % 8, ch = PROG_O[bar];
    var play = mode === 'play' || mode === 'hurry';
    if (pos === 0) {
      ch.forEach(function (m) { tone(mtof(m - 12), t, STEP * 8.5, { type: 'sine', gain: 0.018, attack: 0.6, lp: 800, bus: musicBus, wet: true }); });
      tone(mtof(ch[0] - 24), t, STEP * 4, { gain: 0.07, bus: musicBus, lp: 300 });
    }
    if (Math.random() < (play ? 0.92 : 0.7)) {
      var f = mtof(ch[ARP_O[pos]] + 12), v = pos % 2 ? 0.035 : 0.05;
      tone(f, t, 1.3, { gain: v, bus: musicBus, wet: true });
      tone(f * 3, t, 0.25, { gain: v * 0.12, bus: musicBus });
    }
    if (play && pos % 4 === 2) noise(t, 0.03, { type: 'highpass', freq: 9000, gain: 0.012, bus: musicBus });
  }
  // chip: 통통 8비트 — 118 BPM, C – G – Am – F, 네모파
  var PROG_C = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  var ROOT_C = [48, 43, 45, 41];
  function playStepChip(s, t) {
    var bar = Math.floor(s / 8) % 4, pos = s % 8, ch = PROG_C[bar];
    var play = mode === 'play' || mode === 'hurry';
    if (Math.random() < (play ? 1 : 0.65)) tone(mtof(ch[pos % 3] + 12 + (pos >= 4 ? 12 : 0)), t, STEP * 0.85, { type: 'square', gain: 0.022, lp: 3200, bus: musicBus });
    if (pos % 2 === 0) tone(mtof(ROOT_C[bar]), t, STEP * 0.9, { type: 'triangle', gain: 0.1, bus: musicBus });
    if (play && (pos === 0 || pos === 4)) tone(150, t, 0.12, { glide: 50, gain: 0.13, bus: musicBus });
    if (play && (pos === 2 || pos === 6)) noise(t, 0.08, { type: 'highpass', freq: 2200, gain: 0.04, bus: musicBus });
    if (play && pos % 2) noise(t, 0.02, { type: 'highpass', freq: 8500, gain: 0.014, bus: musicBus });
  }
  var BGMS = {
    basic: { step: 60 / 92 / 2, fn: function (s, t) { playStep(s, t); } },
    orgel: { step: 60 / 76 / 2, fn: playStepOrgel },
    chip: { step: 60 / 118 / 2, fn: playStepChip }
  };
  function scheduler() {
    if (!ac || mode === 'off') return;
    var spd = mode === 'hurry' ? 0.82 : 1;
    var B = BGMS[bgmId] || BGMS.basic;
    STEP = B.step;
    while (nextT < ac.currentTime + 0.15) { B.fn(stepIdx, nextT); nextT += B.step * spd; stepIdx++; }
  }
  function musicGain() {
    if (!ac) return;
    var v = musicOn && mode !== 'off' && !ducked ? MUSIC_VOL : 0;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setTargetAtTime(v, ac.currentTime, 0.25);
    if (fileEl) fileEl.volume = v;
  }
  function setMode(m) {
    if (m === mode) return;
    var was = mode; mode = m;
    if (files) return playFile();
    if (!ac) return;
    if (was === 'off' && m !== 'off') { nextT = ac.currentTime + 0.1; stepIdx = 0; }
    if (!timer) timer = setInterval(scheduler, 25);
    musicGain();
  }
  // 나중에 AI로 만든 음악 파일을 쓸 때
  function useFiles(map) { files = map; playFile(); }
  function playFile() {
    if (!files) return;
    var key = mode === 'hurry' ? 'play' : mode, src = files[key];
    if (!src || !musicOn || mode === 'off') { if (fileEl) fileEl.pause(); return; }
    if (!fileEl) { fileEl = new Audio(); fileEl.loop = true; }
    if (fileEl.dataset.src !== src) { fileEl.src = src; fileEl.dataset.src = src; }
    fileEl.volume = ducked ? 0 : MUSIC_VOL;
    var p = fileEl.play(); if (p && p.catch) p.catch(function () {});
  }

  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    if (!timer && !files) { nextT = ac.currentTime + 0.1; stepIdx = 0; timer = setInterval(scheduler, 25); }
    musicGain();
    if (files) playFile();
  }
  document.addEventListener('visibilitychange', function () {
    if (!ac) return;
    if (document.hidden) { ac.suspend(); if (fileEl) fileEl.pause(); }
    else { ac.resume(); if (files) playFile(); }
  });

  return {
    unlock: unlock, play: play, setMode: setMode, useFiles: useFiles,
    duck: function (on) { ducked = !!on; musicGain(); if (files) playFile(); },
    setSfx: function (on) { sfxOn = !!on; },
    setBgm: function (id) { if (!BGMS[id] || id === bgmId) return; bgmId = id; if (ac) { stepIdx = 0; nextT = ac.currentTime + 0.12; } },
    setSfxSet: function (id) { if (SETS[id]) sfxSet = id; },
    setMusic: function (on) { musicOn = !!on; musicGain(); if (files) playFile(); }
  };
})();
