/*
 * 한칸 쌓기 · 배경음악
 * 소리 파일 없이 Web Audio로 그 자리에서 연주해요.
 * 가 단조 Am → F → C → G 네 마디를 계속 돌고, 판이 흐를수록 템포와 악기가 늘어나요.
 *   0~9초   : 킥(1·3박) + 베이스            (96 BPM 부근)
 *   9초~    : 킥 네 박 모두
 *   18초~   : 하이햇(엇박)
 *   27초~   : 박수(2·4박)
 *   36초~   : 아르페지오(8분음표)
 *   48초~   : 아르페지오·하이햇 16분음표
 *   마지막 10초: 한 음(온음) 올리고 템포를 더 올리고, 두 마디마다 스네어 몰아치기
 * 악기 구성은 마디 첫 박에서만 바뀌어서 음악이 어색하게 끊기지 않아요.
 */
window.Music = (function () {
  'use strict';

  // 마디별 [베이스 뿌리음, 아르페지오 세 음] (MIDI 번호)
  const BARS = [
    [45, [69, 72, 76]], // Am
    [41, [69, 72, 77]], // F
    [48, [67, 72, 76]], // C
    [43, [67, 71, 74]]  // G
  ];
  const BASS_STEPS = [0, 0, 12, 0, 7, 0, 12, 0]; // 8분음표마다 뿌리음에서 올릴 반음 수
  const ARP_ORDER = [0, 1, 2, 1, 0, 2, 1, 2];

  let ctx = null, out = null, bus = null;
  let timer = null, nextTime = 0, step = 0;
  let intensity = 0, urgent = false, bpm = 96;
  let layer = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function layersFor(i, u) {
    return {
      fourKick: i >= 0.15 || u,
      hat8: i >= 0.3 || u,
      clap: i >= 0.45 || u,
      arp8: i >= 0.6 || u,
      fast: i >= 0.8 || u,
      urgent: u,
      transpose: u ? 2 : 0
    };
  }

  // ---------- 악기 ----------
  function env(g, t, peak, attack, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    env(g, t, 0.9, 0.004, 0.24);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.3);
    // 폰 스피커에서도 들리도록 '톡' 하는 앞소리
    noiseHit(t, 0.012, 'highpass', 1800, 0.18);
  }

  function noiseHit(t, len, type, freq, vol, q) {
    const buf = Sound.noise();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, vol, 0.002, len);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.2); src.stop(t + len + 0.05);
  }

  function hat(t, vol, len) { noiseHit(t, len, 'highpass', 7200, vol); }

  function clap(t, vol) {
    noiseHit(t, 0.13, 'bandpass', 1700, vol, 0.9);
    noiseHit(t + 0.012, 0.1, 'bandpass', 2400, vol * 0.6, 1.2);
  }

  function bass(freq, t, dur, vol) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(1300, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    env(g, t, vol, 0.006, dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function pluck(freq, t, dur, vol) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    env(g, t, vol, 0.004, dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- 연주 ----------
  function playStep(s, t) {
    const pos = s % 16;              // 마디 안 16분음표 위치
    const barIdx = Math.floor(s / 16);
    if (pos === 0 || !layer) layer = layersFor(intensity, urgent);
    const bar = BARS[barIdx % 4];
    const tr = layer.transpose;
    const sixteenth = 60 / bpm / 4;

    // 킥
    if (pos % 4 === 0 && (layer.fourKick || pos % 8 === 0)) kick(t);

    // 베이스 (8분음표)
    if (pos % 2 === 0) {
      const n = bar[0] + BASS_STEPS[pos / 2] + tr;
      bass(mtof(n), t, sixteenth * 1.8, layer.urgent ? 0.26 : 0.22);
    }

    // 하이햇
    if (layer.fast && pos % 2 === 1) hat(t, 0.05, 0.03);
    if (layer.hat8 && pos % 4 === 2) hat(t, 0.1, 0.06);

    // 박수
    if (layer.clap && (pos === 4 || pos === 12)) clap(t, 0.32);

    // 마지막 10초: 두 마디마다 끝 두 박 스네어 몰아치기
    if (layer.urgent && barIdx % 2 === 1 && pos >= 8) {
      clap(t, 0.12 + (pos - 8) * 0.025);
    }

    // 아르페지오
    if (layer.arp8 && (pos % 2 === 0 || layer.fast)) {
      const k = layer.fast ? pos % 8 : (pos / 2) % 8;
      const note = bar[1][ARP_ORDER[k]] + tr;
      pluck(mtof(note), t, sixteenth * (layer.fast ? 0.9 : 1.6), layer.fast ? 0.045 : 0.055);
    }
  }

  function schedule() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.14) {
      playStep(step, nextTime);
      nextTime += 60 / bpm / 4;
      step += 1;
    }
  }

  return {
    start: function () {
      if (timer) return;
      ctx = Sound.context();
      out = Sound.musicOut();
      if (!ctx || !out) return;
      bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(out);
      step = 0;
      layer = null;
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(schedule, 25);
      schedule();
    },
    stop: function () {
      if (timer) { clearInterval(timer); timer = null; }
      if (bus && ctx) {
        const b = bus;
        b.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
        setTimeout(function () { try { b.disconnect(); } catch (e) { /* 무시 */ } }, 600);
        bus = null;
      }
    },
    // i: 0(시작)~1(60초), u: 마지막 10초
    setIntensity: function (i, u) {
      intensity = Math.max(0, Math.min(1, i));
      urgent = !!u;
      bpm = 96 + 44 * intensity + (urgent ? 14 : 0);
    },
    isPlaying: function () { return !!timer; },

    // 미리듣기 파일 만들기용: 60초 한 판(+끝 여유)을 오프라인 오디오에 통째로 연주해요.
    renderPreview: function (offCtx, seconds) {
      const saved = { ctx: ctx, bus: bus, noise: Sound.noise };
      ctx = offCtx;
      const comp = offCtx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(offCtx.destination);
      bus = offCtx.createGain(); bus.gain.value = 0.34 / 0.55 * 0.9; bus.connect(comp);
      const nb = offCtx.createBuffer(1, Math.floor(offCtx.sampleRate * 0.4), offCtx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      Sound.noise = function () { return nb; };
      let t = 0.05, s = 0;
      layer = null;
      while (t < seconds) {
        const played = Math.min(1, t / 60);
        this.setIntensity(played, t >= 50);
        playStep(s, t);
        t += 60 / bpm / 4;
        s += 1;
      }
      Sound.noise = saved.noise;
      ctx = saved.ctx; bus = saved.bus; layer = null;
      this.setIntensity(0, false);
    }
  };
})();
