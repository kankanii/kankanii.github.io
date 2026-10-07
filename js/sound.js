/*
 * 한칸 쌓기 · 효과음
 * 소리 파일 없이 Web Audio로 직접 만들어요. 첫 탭 이후에만 소리가 나요.
 */
window.Sound = (function () {
  'use strict';

  let ctx = null;
  let master = null;     // 효과음 볼륨
  let musicBus = null;   // 배경음악 볼륨
  let noiseBuf = null;
  let muted = Platform.storage.get('muted', false);
  let musicMuted = Platform.storage.get('musicMuted', false);
  const SFX_VOL = 0.66, MUSIC_VOL = 0.41; // 10.1: 전체 20% 올림

  // 도레미솔라 (펜타토닉). 콤보가 이어질수록 한 칸씩 올라가요.
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      // 전체 소리를 살짝 눌러 주는 압축기 (음악과 효과음이 겹쳐도 찢어지지 않게)
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = muted ? 0 : SFX_VOL;
      master.connect(comp);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicMuted ? 0 : MUSIC_VOL;
      musicBus.connect(comp);
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }

  function ready() { return ctx && !muted && ctx.state === 'running'; }

  function tone(freq, dur, opt) {
    if (!ready()) return;
    opt = opt || {};
    const t = ctx.currentTime + (opt.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(30, opt.to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.vol || 0.25, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dur, opt) {
    if (!ready()) return;
    opt = opt || {};
    const t = ctx.currentTime + (opt.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'lowpass';
    f.frequency.setValueAtTime(opt.freq || 800, t);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opt.vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  return {
    unlock: unlock,
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      Platform.storage.set('muted', muted);
      if (master) master.gain.value = muted ? 0 : SFX_VOL;
    },
    isMusicMuted: function () { return musicMuted; },
    setMusicMuted: function (m) {
      musicMuted = !!m;
      Platform.storage.set('musicMuted', musicMuted);
      if (musicBus) musicBus.gain.setTargetAtTime(musicMuted ? 0 : MUSIC_VOL, ctx.currentTime, 0.05);
    },
    // 배경음악(music.js)이 쓰는 연결부
    context: function () { return ctx; },
    musicOut: function () { return musicBus; },
    noise: function () { return noiseBuf; },
    click: function () { tone(880, 0.06, { type: 'triangle', vol: 0.12 }); },
    drop: function () { noise(0.22, { filter: 'bandpass', freq: 1800, to: 500, vol: 0.12 }); },
    land: function () {
      noise(0.12, { freq: 400, vol: 0.35 });
      tone(140, 0.14, { type: 'sine', to: 70, vol: 0.35 });
    },
    perfect: function (combo) {
      const i = Math.min(SCALE.length - 1, Math.max(0, combo - 1));
      tone(SCALE[i], 0.22, { type: 'triangle', vol: 0.22 });
      tone(SCALE[i] * 2, 0.16, { type: 'sine', vol: 0.08, delay: 0.04 });
    },
    // 아슬아슬: 삐걱이는 두 음
    edge: function (streak) {
      const up = Math.min(6, Math.max(0, streak - 1)) * 60;
      tone(420 + up, 0.09, { type: 'square', vol: 0.08, to: 520 + up });
      tone(560 + up, 0.14, { type: 'triangle', vol: 0.14, delay: 0.07, to: 700 + up });
    },
    // 탑 흔들림: 낮게 우르릉
    rumble: function () {
      noise(0.45, { freq: 220, to: 90, vol: 0.28 });
      tone(58, 0.4, { type: 'sine', vol: 0.25, to: 44 });
    },
    miss: function () {
      tone(300, 0.35, { type: 'sawtooth', to: 90, vol: 0.12 });
      noise(0.3, { freq: 600, to: 150, vol: 0.2, delay: 0.05 });
    },
    // 참새 떼: 짹짹 몇 번
    chirp: function () {
      [0, 0.09, 0.32, 0.41, 0.7].forEach(function (d, i) {
        tone(2900 + (i % 2) * 500, 0.06, { type: 'sine', vol: 0.05, delay: d, to: 3600 + (i % 2) * 400 });
      });
    },
    tick: function (last) { tone(last ? 1320 : 990, 0.05, { type: 'square', vol: 0.06 }); },
    end: function () {
      [659.25, 523.25, 392.0].forEach(function (f, i) { tone(f, 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.13 }); });
    },
    record: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.25, { type: 'triangle', vol: 0.18, delay: i * 0.09 }); });
    },
    start: function () {
      tone(660, 0.08, { type: 'triangle', vol: 0.14 });
      tone(990, 0.12, { type: 'triangle', vol: 0.14, delay: 0.08 });
    }
  };
})();
