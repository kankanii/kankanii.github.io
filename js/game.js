/*
 * 한칸 쌓기 (90초 크레인)
 * 크레인에 매달려 흔들리는 칸을 탭해서 떨어뜨려 1분 30초 동안 높이 쌓는 게임.
 * 하트를 다 쓰거나 시간이 끝나면 끝. 이어하기는 한 판에 한 번(광고).
 * 난이도가 오르면 판 중간에 방해 요소가 켜져요: 탑 흔들림, 블럭 크기 변형, 블럭 모양 변형,
 * 참새 떼(화면 앞을 가로지름), 구름 구간(25~35층, 탑 꼭대기를 가림).
 */
(function () {
  'use strict';

  // ---------- 설정 ----------
  const CFG = {
    W: 360,            // 논리 가로 크기
    GAME_TIME: 90,     // 초 (1분 30초)
    LIVES: 3,          // 기본 하트 (난이도별로 lives가 있으면 그 값)
    FOG_FROM: 25, FOG_TO: 35, // 구름 구간 (탑 층수)
    MIN_TOP: 24,       // 모양 칸 윗면의 최소 너비(px)
    BW: 92,            // 칸 너비
    BH: 32,            // 칸 높이
    ROPE: 86,          // 크레인 줄 길이
    GRAVITY: 1900,
    CONTINUE_TIME: 10, // 시간 끝 이어하기: +10초
    CONTINUE_LIVES: 1, // 목숨 끝 이어하기: 하트 1개
    HOF_SIZE: 5,       // 명예의 전당 난이도별 칸 수
    // 점수: 올라가면 10점, 아슬아슬 +10, 완벽 +20.
    // 완벽·아슬아슬이 이어지면 다음 점수에 배율: 2번째 ×1.5, 3번째 ×2, 4번째 ×2.5, 5번째부터 ×3
    PTS_LAND: 10, PTS_EDGE: 20, PTS_PERFECT: 30,
    EDGE_FROM: 0.32,   // 칸 너비의 이 비율보다 더 벗어나 버티면 '아슬아슬'
    MULT_STEP: 0.5, MULT_MAX: 3
  };

  // 난이도. 흔들림 속도(speed), 흔들림 폭(amp), 크레인이 옆으로 움직이기 시작하는 층(trolleyFrom),
  // 착지 범위(land: 아래 칸 중심에서 칸 너비의 이 비율까지 벗어나도 버팀. 0.5 = 무게중심이 모서리),
  // 완벽 판정 거리(perfect, px)
  // 탑 흔들림(quake): 판이 시작하고 quakeFrom초가 지나면 쌓인 칸이 덜덜 떨리며
  // quakeEvery초마다 탑 꼭대기가 대략 quakeAmp(px) 안팎으로 밀려요(높이와 상관없이).
  // 블럭 크기 변형(sizeFrom초부터): 칸 너비를 sizes의 [칸 수, 확률%]대로 골라요 (3 = 원래 너비, 2 = 2/3, 1 = 1/3)
  // 블럭 모양 변형(shapeFrom초부터): shapeRate 확률로 각진 모양 칸이 나와요.
  // 참새 떼(birdFrom초부터 birdEvery초 간격), 구름 구간(fog: 가리는 진하기, 0이면 없음)
  // 시간은 모두 '판 시작 후 지난 시간(초)'이에요.
  const NEVER = Infinity;
  const LEVELS = {
    easy:    { name: '쉬움',     lives: 4, speed: 2.0, speedUp: 0.045, speedMax: 1.4, amp: 0.42, ampUp: 0.014, ampMax: 0.30, trolleyFrom: 18, trolleyUp: 3, trolleyMax: 36, land: 0.55, perfect: 7,
               quakeFrom: NEVER, sizeFrom: NEVER, shapeFrom: NEVER, birdFrom: NEVER, fog: 0 },
    normal:  { name: '보통',     lives: 3, speed: 2.6, speedUp: 0.07,  speedMax: 2.2, amp: 0.50, ampUp: 0.020, ampMax: 0.40, trolleyFrom: 10, trolleyUp: 4, trolleyMax: 52, land: 0.50, perfect: 6,
               quakeFrom: 70, quakeEvery: 2.2, quakeAmp: 4, sizeFrom: 75, sizes: [[2, 40], [3, 60]], shapeFrom: NEVER,
               birdFrom: 17.5, birdEvery: [15, 20], fog: 0.95 },
    hard:    { name: '어려움',   lives: 3, speed: 3.3, speedUp: 0.09,  speedMax: 2.7, amp: 0.58, ampUp: 0.024, ampMax: 0.44, trolleyFrom: 4,  trolleyUp: 5, trolleyMax: 66, land: 0.45, perfect: 5,
               quakeFrom: 50, quakeEvery: 1.5, quakeAmp: 6, sizeFrom: 60, sizes: [[1, 15], [2, 40], [3, 45]], shapeFrom: 65, shapeRate: 0.5,
               birdFrom: 12.5, birdEvery: [10, 14], fog: 0.96 },
    extreme: { name: '익스트림', lives: 3, speed: 3.8, speedUp: 0.10,  speedMax: 3.0, amp: 0.62, ampUp: 0.026, ampMax: 0.46, trolleyFrom: 2,  trolleyUp: 6, trolleyMax: 76, land: 0.42, perfect: 4,
               quakeFrom: 30, quakeEvery: 1.2, quakeAmp: 7, sizeFrom: 40, sizes: [[1, 25], [2, 60], [3, 15]], shapeFrom: 50, shapeRate: 0.7,
               birdFrom: 7.5, birdEvery: [6.5, 9.5], fog: 1 }
  };
  const LEVEL_KEYS = ['easy', 'normal', 'hard', 'extreme'];

  // 블럭 모양. 모든 칸은 바닥과 윗면이 평평해서 쌓을 수 있어요.
  // bw: 바닥 너비, tw: 윗면 너비, off: 윗면 가운데가 바닥 가운데에서 벗어난 거리 (다음 칸은 윗면 위에 올려야 해요)
  // kind: box(네모) · trap(사다리꼴 계열: 사다리꼴, 역사다리꼴, 기울어진 칸) · tee(T자) · bump(凸, 한쪽 턱)
  const SHAPES = [
    function (w) { return { kind: 'trap', name: '사다리꼴', bw: w, tw: w * 0.58, off: 0 }; },
    function (w) { return { kind: 'trap', name: '역사다리꼴', bw: w * 0.6, tw: w, off: 0 }; },
    function (w, s) { return { kind: 'trap', name: '기울어진 칸', bw: w, tw: w, off: s * w * 0.26 }; },
    function (w) { return { kind: 'tee', name: 'T자', bw: Math.max(CFG.MIN_TOP, w * 0.42), tw: w, off: 0 }; },
    function (w) { return { kind: 'bump', name: '볼록', bw: w, tw: w * 0.46, off: 0 }; },
    function (w, s) { return { kind: 'bump', name: '계단', bw: w, tw: w * 0.55, off: s * w * 0.225 }; }
  ];
  function boxShape(w) { return { kind: 'box', bw: w, tw: w, off: 0 }; }

  const COLORS = ['#FF9B54', '#FFD166', '#7BD3A8', '#6EC1E4', '#B79CED', '#F28DB2'];
  const BASE_COLOR = '#35618C';
  const FONT = '"HankanDisplay","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';

  // 높이에 따라 하늘이 낮 → 노을 → 저녁 → 밤으로 바뀌어요.
  // [층, 위쪽 HSL, 아래쪽 HSL] 색상값(hue)은 일부러 360을 넘겨 보라·분홍을 거쳐 가게 했어요.
  const SKY = [
    [0, [200, 75, 66], [193, 70, 89]],
    [10, [205, 70, 63], [200, 62, 87]],
    [20, [385, 82, 67], [398, 100, 85]],
    [32, [260, 32, 50], [340, 80, 76]],
    [46, [210, 58, 14], [212, 46, 31]]
  ];

  // ---------- 화면 ----------
  const stage = document.getElementById('stage');
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const safeProbe = document.getElementById('safeProbe');
  const V = { W: CFG.W, H: 640, scale: 1, S: 1, safeTop: 0 };

  function resize() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    V.H = Math.round(Math.min(820, Math.max(560, V.W * vh / vw)));
    V.scale = Math.min(vw / V.W, vh / V.H);
    const cssW = V.W * V.scale;
    const cssH = V.H * V.scale;
    stage.style.width = cssW + 'px';
    stage.style.height = cssH + 'px';
    stage.style.setProperty('--u', V.scale);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    V.S = cv.width / V.W;
    const top = (vh - cssH) / 2;
    const inset = safeProbe ? safeProbe.offsetHeight : 0;
    V.safeTop = Math.max(0, inset - top) / V.scale;
    stage.style.setProperty('--safe', V.safeTop * V.scale + 'px');
    layout();
  }

  const L = {};
  function layout() {
    L.GY = V.H - 42;                         // 땅 높이(화면)
    L.craneY = V.safeTop + 188;              // 크레인 대들보
    const hangBottom = L.craneY + CFG.ROPE + 8 + CFG.BH;
    const room = L.GY - hangBottom;
    L.towerTop = hangBottom + Math.max(90, Math.min(220, room * 0.55)); // 탑 꼭대기가 머무는 화면 높이
  }

  // ---------- 유틸 ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function mixHsl(a, b, t) {
    const h = lerp(a[0], b[0], t) % 360, sa = lerp(a[1], b[1], t), l = lerp(a[2], b[2], t);
    return 'hsl(' + h.toFixed(1) + ',' + sa.toFixed(1) + '%,' + l.toFixed(1) + '%)';
  }
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 고정 난수 (별, 구름, 건물 배치를 매번 같게)
  function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  const rnd = seeded(42);
  const STARS = Array.from({ length: 60 }, function () { return { x: rnd() * 360, y: rnd() * 820, r: 0.6 + rnd() * 1.4, p: rnd() * 6 }; });
  const CLOUDS = Array.from({ length: 9 }, function (_, i) { return { x: rnd() * 420 - 30, wy: 260 + i * 170 + rnd() * 80, s: 0.7 + rnd() * 0.7, v: 4 + rnd() * 8 }; });
  const SKYLINE = (function () {
    const r = seeded(7), out = []; let x = -10;
    while (x < 380) { const w = 22 + r() * 34; out.push({ x: x, w: w, h: 30 + r() * 70 }); x += w + 2 + r() * 6; }
    return out;
  })();

  // ---------- 게임 상태 ----------
  function newGame(demo, level) {
    const key = LEVELS[level] ? level : 'normal';
    const lv = LEVELS[key];
    const lives = lv.lives || CFG.LIVES;
    return {
      demo: !!demo,
      level: key, L: lv,
      t: 0, score: 0, floors: 0, perfects: 0, edges: 0, streak: 0, bestStreak: 0,
      elapsed: 0, quake: false, quakeT: 0, sizeOn: false, shapeOn: false,
      birds: [], birdT: lv.birdFrom, birdSeen: false, fog: 0, fogSeen: false,
      tower: [{ x: 0, s: { kind: 'base', bw: CFG.BW, tw: CFG.BW, off: 0 }, idx: 0 }],
      piece: boxShape(CFG.BW), fall: null, hang: true, wait: 0,
      ph: demo ? Math.random() * 6 : Math.PI / 2, a: 0, trolley: 0,
      time: CFG.GAME_TIME, lives: lives, maxLives: lives, lastTick: CFG.GAME_TIME,
      cam: 0, camX: 0, shake: 0,
      pops: [], parts: [], sparks: [], sparkT: 0,
      over: false, reason: null, continued: false,
      startMs: 0, playSec: 0, startedAt: Date.now()
    };
  }

  function difficulty(g) {
    const f = g.floors, lv = g.L;
    return {
      amp: lv.amp + Math.min(lv.ampMax, f * lv.ampUp),
      speed: lv.speed + Math.min(lv.speedMax, f * lv.speedUp),
      trolley: f >= lv.trolleyFrom ? Math.min(lv.trolleyMax, (f - lv.trolleyFrom + 1) * lv.trolleyUp) : 0
    };
  }

  function hook(g) {
    const px = V.W / 2 + g.trolley;
    const hx = px + CFG.ROPE * Math.sin(g.a);
    const hy = L.craneY + CFG.ROPE * Math.cos(g.a);
    return { px: px, hx: hx, hy: hy };
  }
  function hangingCenter(g) {
    const h = hook(g), d = 8 + CFG.BH / 2;
    return { x: h.hx + Math.sin(g.a) * d, y: h.hy + Math.cos(g.a) * d };
  }

  // 탑 꼭대기 칸의 윗면 (다음 칸이 올라갈 자리): 가운데 x와 너비
  function topOf(g) {
    const b = g.tower[g.tower.length - 1];
    return { cx: b.x + b.s.off, w: b.s.tw };
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  // 다음에 매달 칸: 크기 변형·모양 변형이 켜져 있으면 무작위로 바뀌어요
  // 얼굴 칸: 창문 대신 표정이 그려진 칸이 가끔 나와요. 착지 결과에 따라 표정이 바뀌어요.
  const FACES = ['smile', 'grin', 'wink', 'wow', 'sleepy', 'meh', 'cat'];
  const FACE_RATE = 0.3;
  function withFace(s) { if (Math.random() < FACE_RATE) s.face = pick(FACES); return s; }
  // [[값, 확률%], ...] 중 확률대로 하나
  function pickWeighted(list) {
    let r = Math.random() * list.reduce(function (a, e) { return a + e[1]; }, 0);
    for (let i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return list[i][0]; }
    return list[list.length - 1][0];
  }
  function nextPiece(g) { return withFace(basePiece(g)); }
  function basePiece(g) {
    const lv = g.L;
    let w = CFG.BW;
    if (g.sizeOn && lv.sizes) w = CFG.BW * pickWeighted(lv.sizes) / 3;
    if (g.shapeOn && Math.random() < (lv.shapeRate || 0)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const opts = SHAPES.map(function (f) { return f(w, side); })
        .filter(function (s) { return s.tw >= CFG.MIN_TOP && s.bw >= CFG.MIN_TOP; });
      if (opts.length) return pick(opts);
    }
    return boxShape(w);
  }

  function toScreenX(g, wx) { return wx - g.camX + V.W / 2; }
  function toScreenY(g, wy) { return L.GY + g.cam - wy; }

  function pop(g, text, wx, wy, color) { g.pops.push({ text: text, x: wx, wy: wy, t: 0, color: color || '#FFFFFF' }); }
  function burst(g, wx, wy, n, colors, power) {
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.1 + Math.random() * 0.8);
      const sp = (power || 220) * (0.4 + Math.random() * 0.8);
      g.parts.push({ x: wx, wy: wy, vx: Math.cos(ang) * sp * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(ang) * sp, life: 0.6 + Math.random() * 0.5, t: 0, col: colors[i % colors.length], s: 3 + Math.random() * 4, r: Math.random() * 6 });
    }
  }

  // 탭: 매달린 칸을 떨어뜨려요
  function drop(g) {
    if (!g.hang || g.over) return false;
    const c = hangingCenter(g);
    g.fall = {
      x: c.x - V.W / 2 + g.camX,
      wy: toScreenY(g, c.y + CFG.BH / 2),
      vy: 0, vx: 0, rot: -g.a, vr: 0, missed: false,
      s: g.piece, idx: g.floors + 1
    };
    g.hang = false;
    if (!g.demo) { Sound.drop(); Platform.haptic('tap'); }
    return true;
  }

  function update(g, dt) {
    g.t += dt;
    const D = difficulty(g);
    g.ph += D.speed * dt;
    g.a = D.amp * Math.sin(g.ph);
    g.trolley = D.trolley * Math.sin(g.t * 0.85);

    // 시간
    if (!g.demo && !g.over) {
      g.time -= dt;
      const sec = Math.ceil(g.time);
      if (sec < g.lastTick && sec <= 10 && sec >= 1) { Sound.tick(sec <= 3); }
      g.lastTick = sec;
      if (g.time <= 0) { g.time = 0; finish(g, 'time'); }
      g.elapsed += dt;
      const lv = g.L;
      if (!g.quake && g.elapsed >= lv.quakeFrom) {
        g.quake = true;
        g.quakeT = 0.4;
        App.onGimmick('탑이 흔들려요!');
      }
      if (g.quake) {
        // 크레인 불꽃: 흔들림이 시작된 뒤 시간이 지날수록 더 자주, 더 크게
        const k = craneHeat(g);
        g.sparkT -= dt;
        while (g.sparkT <= 0) {
          g.sparkT += 1 / (3 + 34 * k);
          spawnSpark(g, k);
        }
        g.quakeT -= dt;
        if (g.quakeT <= 0) { g.quakeT = lv.quakeEvery * (0.8 + Math.random() * 0.4); quakePulse(g); }
      }
      if (!g.sizeOn && g.elapsed >= lv.sizeFrom) { g.sizeOn = true; App.onGimmick('칸 크기가 바뀌어요!'); }
      if (!g.shapeOn && g.elapsed >= lv.shapeFrom) { g.shapeOn = true; App.onGimmick('칸 모양이 바뀌어요!'); }
      if (g.elapsed >= g.birdT) {
        g.birdT = g.elapsed + lv.birdEvery[0] + Math.random() * (lv.birdEvery[1] - lv.birdEvery[0]);
        spawnBirds(g);
        if (!g.birdSeen) { g.birdSeen = true; App.onGimmick('참새 떼!'); }
        Sound.chirp();
      }
      // 구름 구간: 다음에 쌓을 층이 25~35층이면 구름이 탑 꼭대기를 가려요
      const inFog = lv.fog > 0 && g.floors + 1 >= CFG.FOG_FROM && g.floors + 1 <= CFG.FOG_TO;
      if (inFog && !g.fogSeen) { g.fogSeen = true; App.onGimmick('구름 속으로!'); }
      g.fog += ((inFog ? 1 : 0) - g.fog) * Math.min(1, dt * 1.6);
    }

    // 참새 떼
    g.birds.forEach(function (f) { f.t += dt; f.x += f.dir * f.v * dt; });
    g.birds = g.birds.filter(function (f) { return f.dir > 0 ? f.x < V.W + 260 : f.x > -260; });

    // 떨어지는 칸
    const f = g.fall;
    if (f) {
      f.vy += CFG.GRAVITY * dt;
      f.wy -= f.vy * dt;
      f.x += f.vx * dt;
      if (!f.missed) f.rot *= Math.max(0, 1 - dt * 9);
      else f.rot += f.vr * dt;

      const n = g.tower.length;
      const topWy = n * CFG.BH;
      const top = topOf(g), tx = top.cx;
      if (!f.missed && f.wy <= topWy) {
        const dx = f.x - tx;
        const s = dx > 0 ? 1 : -1;
        // 무게중심이 아래 칸 윗면 안쪽(land 비율)이면 버텨요
        if (Math.abs(dx) <= top.w * g.L.land && !g.over) {
          land(g, f, dx, topWy, top);
        } else if (!g.over) {
          f.missed = true;
          if (f.s.face) f.s.face = 'dizzy';
          if (Math.abs(dx) < (top.w + f.s.bw) / 2) {
            // 모서리에 걸침: 무게중심이 밖이라 모서리를 축으로 기울며 떨어져요
            f.wy = topWy;
            f.vy = -60;
            f.vx = s * 90;
            f.vr = s * 5.5;
            g.shake = 5;
            pop(g, '걸쳐서 떨어짐', tx + dx * 0.5, topWy + 40, '#FFB4B4');
          } else {
            // 아예 빗나감: 그대로 떨어져요
            f.vr = s * 1.5;
            pop(g, '놓침', tx + dx * 0.5, topWy + 40, '#FFB4B4');
          }
          if (!g.demo) { Sound.miss(); Platform.haptic('miss'); }
          g.streak = 0;
        }
      }
      if (g.fall && f.missed && toScreenY(g, f.wy) - CFG.BH > V.H + 60) {
        g.fall = null;
        if (!g.demo) {
          g.lives -= 1;
          if (g.lives <= 0) { g.lives = 0; finish(g, 'lives'); }
          else g.wait = 0.25;
        } else g.wait = 0.25;
      }
    }
    if (!g.fall && !g.hang && !g.over) {
      g.wait -= dt;
      if (g.wait <= 0) { g.piece = nextPiece(g); g.hang = true; }
    }

    // 연출
    g.shake *= Math.exp(-dt * 9);
    g.pops.forEach(function (p) { p.t += dt; p.wy += 34 * dt; });
    g.pops = g.pops.filter(function (p) { return p.t < 1.1; });
    g.parts.forEach(function (p) { p.t += dt; p.vy -= 700 * dt; p.x += p.vx * dt; p.wy += p.vy * dt; p.r += 6 * dt; });
    g.parts = g.parts.filter(function (p) { return p.t < p.life; });
    g.sparks.forEach(function (p) { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    g.sparks = g.sparks.filter(function (p) { return p.t < p.life; });

    // 카메라
    let target = Math.max(0, g.tower.length * CFG.BH - (L.GY - L.towerTop));
    if (g.demo) target = Math.max(-(L.GY - App.sheetTop() + 6), g.tower.length * CFG.BH - (L.GY - L.towerTop));
    g.cam += (target - g.cam) * Math.min(1, dt * 5);
    g.camX += (topOf(g).cx - g.camX) * Math.min(1, dt * 3);
  }

  function spawnBirds(g) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const hangBottom = L.craneY + CFG.ROPE + 8 + CFG.BH;
    const flock = {
      dir: dir, x: dir > 0 ? -240 : V.W + 240, t: 0,
      y: lerp(hangBottom - 10, L.towerTop + 30, Math.random()),
      v: 125 + Math.random() * 45, birds: []
    };
    const n = 12 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      flock.birds.push({ dx: (Math.random() - 0.5) * 250, dy: (Math.random() - 0.5) * 150, p: Math.random() * 6, s: 16 + Math.random() * 10 });
    }
    g.birds.push(flock);
  }

  function multOf(streak) { return Math.min(CFG.MULT_MAX, 1 + CFG.MULT_STEP * Math.max(0, streak - 1)); }
  function fmtMult(m) { return '×' + (Math.round(m * 10) / 10); }

  function land(g, f, dx, topWy, top) {
    const perfect = Math.abs(dx) <= g.L.perfect;
    const edgy = !perfect && Math.abs(dx) > top.w * CFG.EDGE_FROM;
    const tx = top.cx;
    g.tower.push({ x: perfect ? tx : f.x, s: f.s, idx: f.idx });
    g.fall = null;
    g.floors += 1;
    g.wait = 0.28;
    g.shake = perfect ? 3 : edgy ? 14 : 6 + Math.min(6, Math.abs(dx) / 8);
    const popY = topWy + CFG.BH + 22;
    let pts = CFG.PTS_LAND;
    if (perfect || edgy) {
      g.streak += 1;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      const m = multOf(g.streak);
      pts = Math.round((perfect ? CFG.PTS_PERFECT : CFG.PTS_EDGE) * m);
      const label = (perfect ? '완벽' : '아슬아슬') + (m > 1 ? ' ' + fmtMult(m) : '') + '  +' + pts;
      if (perfect) {
        g.perfects += 1;
        if (f.s.face) f.s.face = 'love';
        burst(g, tx, topWy, 16, COLORS, 240);
        pop(g, label, tx, popY, '#FFE39A');
        if (!g.demo) { Sound.land(); Sound.perfect(g.streak); Platform.haptic('perfect'); }
      } else {
        g.edges += 1;
        if (f.s.face) f.s.face = 'sweat';
        burst(g, f.x + (dx > 0 ? -1 : 1) * f.s.bw * 0.5, topWy, 10, ['#FFB38A', '#FFFFFF', '#FF8FA3'], 180);
        pop(g, label, f.x, popY, '#FFC4A8');
        if (!g.demo) { Sound.land(); Sound.edge(g.streak); Platform.haptic('perfect'); }
      }
    } else {
      g.streak = 0;
      burst(g, f.x, topWy, 6, ['#FFFFFF', '#E6EEF5'], 90);
      pop(g, '+' + pts, f.x, popY);
      if (!g.demo) { Sound.land(); Platform.haptic('land'); }
    }
    g.score += pts;
  }

  // 탑 흔들림 한 번: 칸마다 아래 칸과의 간격을 조금씩 흔들어요. 위로 갈수록 밀린 거리가 쌓여요.
  function quakePulse(g) {
    const n = g.tower.length;
    if (n < 3) return;
    // 칸 수가 많아도 꼭대기 이동량이 비슷하도록 칸마다 흔드는 양을 나눠요
    const amp = g.L.quakeAmp / Math.sqrt(n - 1);
    const T = g.tower, rel = [];
    // rel: 각 칸 바닥 가운데가 아래 칸 윗면 가운데에서 벗어난 거리
    for (let i = 1; i < n; i++) rel.push(T[i].x - (T[i - 1].x + T[i - 1].s.off));
    const lean = Math.random() < 0.5 ? -1 : 1; // 이번 흔들림이 기우는 쪽
    for (let i = 0; i < rel.length; i++) {
      const lim = T[i].s.tw * g.L.land * 0.8;
      rel[i] = clamp(rel[i] + (Math.random() - 0.5 + lean * 0.2) * 2 * amp, -lim, lim);
    }
    for (let i = 1; i < n; i++) T[i].x = T[i - 1].x + T[i - 1].s.off + rel[i - 1];
    g.shake = Math.max(g.shake, 7);
    if (!g.demo) { Sound.rumble(); Platform.haptic('tap'); }
  }

  function finish(g, reason) {
    if (g.over) return;
    g.over = true;
    g.reason = reason;
    g.hang = false;
    if (g.fall && !g.fall.missed) g.fall = null;
    if (!g.demo) App.onFinish(g);
  }

  // ---------- 그리기 ----------
  function skyColors(g) {
    const h = g.cam / CFG.BH;
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (h <= b[0]) {
        const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
        return { top: mixHsl(a[1], b[1], t), bottom: mixHsl(a[2], b[2], t) };
      }
    }
    const last = SKY[SKY.length - 1];
    return { top: mixHsl(last[1], last[1], 0), bottom: mixHsl(last[2], last[2], 0) };
  }
  function nightness(g) { return clamp((g.cam / CFG.BH - 36) / 10, 0, 1); }

  function drawBackground(g) {
    const sky = skyColors(g);
    const gr = ctx.createLinearGradient(0, 0, 0, V.H);
    gr.addColorStop(0, sky.top);
    gr.addColorStop(1, sky.bottom);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, V.W, V.H);

    const night = nightness(g);
    if (night > 0) {
      STARS.forEach(function (s) {
        const y = (s.y + g.cam * 0.05) % V.H;
        ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin(g.t * 2 + s.p));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(s.x, y, s.r, s.r);
      });
      ctx.globalAlpha = 1;
    }

    // 구름 (천천히 흘러가요)
    ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * (1 - night)) + ')';
    CLOUDS.forEach(function (c) {
      const sy = L.GY + g.cam * 0.6 - c.wy;
      if (sy < -60 || sy > V.H + 60) return;
      const x = ((c.x + g.t * c.v) % 440) - 40;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, sy, 30 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 20 * s, sy - 8 * s, 20 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 18 * s, sy - 4 * s, 16 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 먼 도시
    const gy = L.GY + g.cam;
    const cityY = L.GY + g.cam * 0.55;
    if (cityY - 110 < V.H) {
      ctx.fillStyle = mix('#8FB3CC', '#1B3550', clamp(g.cam / CFG.BH / 30, 0, 1));
      SKYLINE.forEach(function (b) { ctx.fillRect(b.x, cityY - b.h, b.w, b.h + 2); });
    }
    // 땅
    if (gy < V.H) {
      ctx.fillStyle = '#243B52';
      ctx.fillRect(0, gy, V.W, V.H - gy + 2);
      ctx.fillStyle = '#2F4C68';
      ctx.fillRect(0, gy, V.W, 4);
    }
  }

  function drawFloorMarks(g) {
    ctx.save();
    ctx.font = '700 11px ' + FONT;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (let k = 10; ; k += 10) {
      const sy = toScreenY(g, (k + 1) * CFG.BH);
      if (sy < -12) break;
      if (sy > V.H + 12) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.moveTo(0, sy + 0.5); ctx.lineTo(V.W, sy + 0.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.textAlign = 'right';
      ctx.fillText(k + '층', V.W - 8, sy - 6);
    }
    ctx.restore();
  }

  // 칸 모양 경로. cx: 바닥 가운데, y: 윗면 높이(화면)
  function shapePath(cx, y, s) {
    const h = CFG.BH, bw = s.bw, tw = s.tw, o = s.off, m = h * 0.45;
    if (s.kind === 'box') { rr(cx - bw / 2, y, bw, h, 5); return; }
    ctx.beginPath();
    if (s.kind === 'trap') {
      ctx.moveTo(cx + o - tw / 2, y); ctx.lineTo(cx + o + tw / 2, y);
      ctx.lineTo(cx + bw / 2, y + h); ctx.lineTo(cx - bw / 2, y + h);
    } else if (s.kind === 'tee') {
      ctx.moveTo(cx - tw / 2, y); ctx.lineTo(cx + tw / 2, y); ctx.lineTo(cx + tw / 2, y + m);
      ctx.lineTo(cx + bw / 2, y + m); ctx.lineTo(cx + bw / 2, y + h); ctx.lineTo(cx - bw / 2, y + h);
      ctx.lineTo(cx - bw / 2, y + m); ctx.lineTo(cx - tw / 2, y + m);
    } else { // bump: 아래는 넓고 위에 좁은 턱
      ctx.moveTo(cx + o - tw / 2, y); ctx.lineTo(cx + o + tw / 2, y); ctx.lineTo(cx + o + tw / 2, y + m);
      ctx.lineTo(cx + bw / 2, y + m); ctx.lineTo(cx + bw / 2, y + h); ctx.lineTo(cx - bw / 2, y + h);
      ctx.lineTo(cx - bw / 2, y + m); ctx.lineTo(cx + o - tw / 2, y + m);
    }
    ctx.closePath();
  }

  // 얼굴 표정. (x, y): 얼굴 가운데, k: 크기 비율(좁은 칸은 작게)
  function drawFace(x, y, face, k, night) {
    const e = 11 * Math.max(0.55, k), ink = night > 0.5 ? 'rgba(10,20,32,.85)' : 'rgba(15,36,56,.8)';
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ey = -3.5, dot = function (dx) { ctx.beginPath(); ctx.arc(dx, ey, 2.4, 0, Math.PI * 2); ctx.fill(); };
    const line = function (x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const blush = function () {
      ctx.fillStyle = 'rgba(255,110,130,.45)';
      ctx.beginPath(); ctx.ellipse(-e - 4, 3, 4, 2.4, 0, 0, Math.PI * 2); ctx.ellipse(e + 4, 3, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink;
    };
    if (face === 'smile') { dot(-e); dot(e); ctx.beginPath(); ctx.arc(0, 1, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); blush(); }
    else if (face === 'grin') {
      ctx.beginPath(); ctx.arc(-e, ey + 1.5, 3, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(e, ey + 1.5, 3, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, 2); ctx.arc(0, 2, 5, 0, Math.PI); ctx.closePath(); ctx.fill(); blush();
    } else if (face === 'wink') {
      dot(-e); line(e - 3, ey, e + 3, ey);
      ctx.beginPath(); ctx.arc(0, 1, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (face === 'wow') { dot(-e); dot(e); ctx.beginPath(); ctx.ellipse(0, 5, 2.8, 3.6, 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (face === 'sleepy') {
      line(-e - 3, ey, -e + 3, ey); line(e - 3, ey, e + 3, ey);
      ctx.beginPath(); ctx.arc(0, 5, 2, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '900 7px ' + FONT; ctx.fillText('z', e + 6, ey - 5);
    } else if (face === 'meh') { dot(-e); dot(e); line(-4, 5, 4, 5); }
    else if (face === 'cat') {
      dot(-e); dot(e);
      ctx.beginPath(); ctx.moveTo(-5, 3); ctx.quadraticCurveTo(-2.5, 6.5, 0, 3); ctx.quadraticCurveTo(2.5, 6.5, 5, 3); ctx.stroke(); blush();
    } else if (face === 'love') { // 완벽: 하트 눈
      [-e, e].forEach(function (dx) {
        ctx.fillStyle = '#E4435B';
        ctx.beginPath(); ctx.moveTo(dx, ey + 3); ctx.bezierCurveTo(dx - 5, ey - 1, dx - 2.5, ey - 5, dx, ey - 2);
        ctx.bezierCurveTo(dx + 2.5, ey - 5, dx + 5, ey - 1, dx, ey + 3); ctx.fill();
      });
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, 2); ctx.arc(0, 2, 5, 0, Math.PI); ctx.closePath(); ctx.fill(); blush();
    } else if (face === 'sweat') { // 아슬아슬: 식은땀
      dot(-e); dot(e);
      ctx.beginPath(); ctx.moveTo(-5, 5); ctx.quadraticCurveTo(-2.5, 2, 0, 5); ctx.quadraticCurveTo(2.5, 8, 5, 5); ctx.stroke();
      ctx.fillStyle = '#8FD3FF';
      ctx.beginPath(); ctx.moveTo(e + 7, ey - 6); ctx.quadraticCurveTo(e + 11, ey + 1, e + 7, ey + 2); ctx.quadraticCurveTo(e + 3, ey + 1, e + 7, ey - 6); ctx.fill();
    } else if (face === 'dizzy') { // 놓침: X 눈
      [-e, e].forEach(function (dx) { line(dx - 2.8, ey - 2.8, dx + 2.8, ey + 2.8); line(dx - 2.8, ey + 2.8, dx + 2.8, ey - 2.8); });
      ctx.beginPath(); ctx.ellipse(0, 5, 3, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlock(cx, y, s, idx, night) {
    const h = CFG.BH;
    if (idx === 0) {
      const w = CFG.BW, x = cx - w / 2;
      rr(x - 14, y, w + 28, h, 4);
      ctx.fillStyle = BASE_COLOR; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - 10, y + 3, w + 20, 3);
      return;
    }
    const col = COLORS[idx % COLORS.length];
    const left = Math.min(cx - s.bw / 2, cx + s.off - s.tw / 2);
    const right = Math.max(cx + s.bw / 2, cx + s.off + s.tw / 2);
    const span = right - left;
    shapePath(cx, y, s);
    ctx.fillStyle = col; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(left, y, span, 4);
    if (s.kind === 'tee' || s.kind === 'bump') { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(left, y + h * 0.45, span, 3); }
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(left, y + h - 5, span, 5);
    const wcx = s.kind === 'bump' ? cx : s.kind === 'trap' ? cx + s.off / 2 : cx;
    if (s.face) {
      const fy = s.kind === 'bump' ? y + h * 0.7 : s.kind === 'tee' ? y + h * 0.5 : y + h * 0.5;
      drawFace(wcx, fy, s.face, Math.min(1, Math.min(s.bw, s.tw) / 60), night);
    } else {
      // 창문: 밤이 되면 불이 켜져요 (칸 너비에 맞춰 개수가 달라져요)
      const wy = s.kind === 'bump' ? y + h - 17 : y + 9;
      const base = s.kind === 'bump' ? s.bw : s.kind === 'tee' ? s.tw : Math.min(s.bw, s.tw);
      const cnt = Math.max(1, Math.floor((base - 6) / 25));
      for (let k = 0; k < cnt; k++) {
        const wx = wcx - (cnt * 25 - 12) / 2 + k * 25;
        const lit = night > 0 && ((idx * 7 + k * 3) % 5 !== 0);
        ctx.fillStyle = lit ? 'rgba(255,224,138,' + (0.35 + 0.65 * night) + ')' : 'rgba(15,36,56,.3)';
        ctx.fillRect(wx, wy, 13, 12);
      }
    }
    ctx.restore();
    if (s.kind !== 'box') {
      shapePath(cx, y, s);
      ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(15,36,56,.35)'; ctx.stroke();
    }
  }

  function drawTower(g) {
    const n = g.tower.length, night = nightness(g);
    for (let i = 0; i < n; i++) {
      const sy = toScreenY(g, (i + 1) * CFG.BH);
      if (sy > V.H + 4 || sy < -CFG.BH - 4) continue;
      const k = i / Math.max(1, n - 1);
      const sh = g.shake * Math.sin(g.t * 48) * k + (g.quake && i > 0 ? Math.sin(g.t * 71 + i * 1.7) * 1.1 * Math.sqrt(k) : 0);
      const b = g.tower[i];
      drawBlock(toScreenX(g, b.x) + sh, sy, b.s, i, night);
    }
  }

  // 참새 떼: 모든 것 앞을 지나가며 화면을 가려요
  function drawBirds(g) {
    if (!g.birds.length) return;
    const night = nightness(g);
    const body = mix('#5A3E2B', '#2A1D14', night), wing = mix('#7A5538', '#3A2A1E', night);
    g.birds.forEach(function (f) {
      f.birds.forEach(function (b) {
        const x = f.x + b.dx, y = f.y + b.dy + Math.sin(f.t * 3 + b.p) * 5, s = b.s;
        const flap = Math.sin(f.t * 16 + b.p);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(f.dir, 1);
        // 날개 (뒤)
        ctx.fillStyle = wing;
        ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(s * 0.35, -s * (0.25 + 0.9 * flap)); ctx.lineTo(s * 0.55, 0); ctx.closePath(); ctx.fill();
        // 몸통
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.72, -s * 0.18, s * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.05); ctx.lineTo(-s * 1.25, -s * 0.3); ctx.lineTo(-s * 1.2, s * 0.15); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#E9C9A0';
        ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.16, s * 0.45, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F2A33A';
        ctx.beginPath(); ctx.moveTo(s * 1.0, -s * 0.22); ctx.lineTo(s * 1.25, -s * 0.12); ctx.lineTo(s * 1.0, -s * 0.05); ctx.closePath(); ctx.fill();
        // 날개 (앞)
        ctx.fillStyle = wing;
        ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.05); ctx.lineTo(s * 0.15, -s * (0.35 + 1.0 * flap)); ctx.lineTo(s * 0.4, -s * 0.05); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
    });
  }

  // 구름 구간: 크레인 아래부터 탑 꼭대기 아래까지 두꺼운 구름이 덮어요
  function drawFog(g) {
    const a = g.fog * g.L.fog * 0.85; // 10.1: 15% 더 투명하게
    if (a < 0.01) return;
    const top = L.craneY + CFG.ROPE + 8 + CFG.BH + 14;
    const bot = L.towerTop + 150;
    const night = nightness(g);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = mix('#F4F7FB', '#8E9CB0', night);
    // 한 번에 칠해서 겹치는 곳이 진해지지 않게 해요
    ctx.beginPath();
    ctx.rect(0, top + 12, V.W, bot - top - 24);
    for (let i = 0; i < 10; i++) {
      const x = ((i * 47 + g.t * (8 + (i % 3) * 5)) % 470) - 55;
      const r = 24 + (i % 4) * 7;
      ctx.moveTo(x + r, top + 14 + (i % 2) * 8);
      ctx.arc(x, top + 14 + (i % 2) * 8, r, 0, Math.PI * 2);
      const x2 = V.W - x;
      ctx.moveTo(x2 + r, bot - 12 - (i % 2) * 8);
      ctx.arc(x2, bot - 12 - (i % 2) * 8, r, 0, Math.PI * 2);
    }
    ctx.fill('nonzero');
    ctx.restore();
  }

  // 흔들림 시작 0 → 판 끝 1
  function craneHeat(g) {
    if (!g.quake) return 0;
    return clamp((g.elapsed - g.L.quakeFrom) / Math.max(1, CFG.GAME_TIME - g.L.quakeFrom), 0, 1);
  }
  function spawnSpark(g, k) {
    const h = hook(g);
    // 트롤리 바퀴 쪽이나 대들보 이음새에서 튀어요
    const onTrolley = Math.random() < 0.6;
    const x = onTrolley ? h.px + (Math.random() < 0.5 ? -14 : 14) : Math.random() * V.W;
    const y = L.craneY + (onTrolley ? 0 : -6);
    const n = 1 + Math.floor(Math.random() * (1 + 3 * k));
    for (let i = 0; i < n; i++) {
      const sp = 60 + Math.random() * (90 + 200 * k);
      const ang = Math.PI * (0.05 + Math.random() * 0.9);
      g.sparks.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp * 0.6, t: 0,
        life: 0.25 + Math.random() * (0.25 + 0.35 * k), s: 1.4 + Math.random() * (1.2 + 1.6 * k) });
    }
  }
  function drawSparks(g) {
    if (!g.sparks.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,120,30,.9)';
    ctx.shadowBlur = 6;
    g.sparks.forEach(function (p) {
      const f = 1 - p.t / p.life;
      ctx.strokeStyle = f > 0.6 ? 'rgba(255,214,90,' + Math.min(1, f + 0.2) + ')' : 'rgba(255,' + Math.round(90 + 90 * f) + ',30,' + Math.min(1, f + 0.2) + ')';
      ctx.lineWidth = p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawCrane(g) {
    // 흔들림이 시작되면 대들보와 트롤리도 덜덜 떨려요 (칸 위치는 그대로라 조준에는 영향 없음)
    const heat = craneHeat(g);
    const jit = g.quake ? (0.6 + 2.2 * heat) : 0;
    const jx = jit ? Math.sin(g.t * 63) * jit * 0.6 : 0;
    const y = L.craneY + (jit ? Math.sin(g.t * 57 + 1.3) * jit : 0);
    ctx.save();
    ctx.translate(jx, 0);
    const night = nightness(g);
    const steel = mix('#1B3550', '#7F9DBB', night);
    // 트러스 대들보
    ctx.fillStyle = steel;
    ctx.fillRect(0, y - 20, V.W, 3);
    ctx.fillRect(0, y - 6, V.W, 3);
    ctx.strokeStyle = steel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < V.W + 18; x += 18) {
      ctx.moveTo(x, y - 18); ctx.lineTo(x + 9, y - 5); ctx.lineTo(x + 18, y - 18);
    }
    ctx.stroke();
    const h = hook(g);
    // 트롤리
    rr(h.px - 16, y - 10, 32, 12, 3);
    ctx.fillStyle = heat > 0.5 ? mix('#FFD166', '#FF8A4C', (heat - 0.5) * 2) : '#FFD166'; ctx.fill();
    ctx.restore();
    // 줄
    ctx.strokeStyle = night > 0.5 ? 'rgba(220,230,240,.75)' : 'rgba(20,30,40,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(h.px, y + 2); ctx.lineTo(h.hx, h.hy); ctx.stroke();
    ctx.fillStyle = steel;
    ctx.beginPath(); ctx.arc(h.hx, h.hy, 4, 0, Math.PI * 2); ctx.fill();
    if (g.hang) {
      ctx.save();
      ctx.translate(h.hx, h.hy);
      ctx.rotate(-g.a);
      drawBlock(0, 8, g.piece, g.floors + 1, nightness(g));
      ctx.restore();
    }
  }

  function drawFalling(g) {
    const f = g.fall;
    if (!f) return;
    const sy = toScreenY(g, f.wy) - CFG.BH;
    ctx.save();
    ctx.translate(toScreenX(g, f.x), sy + CFG.BH / 2);
    ctx.rotate(f.rot);
    drawBlock(0, -CFG.BH / 2, f.s, f.idx, nightness(g));
    ctx.restore();
  }

  function drawFx(g) {
    g.parts.forEach(function (p) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      ctx.translate(toScreenX(g, p.x), toScreenY(g, p.wy));
      ctx.rotate(p.r);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 20px ' + FONT;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    g.pops.forEach(function (p) {
      const x = clamp(toScreenX(g, p.x), 110, V.W - 110), y = toScreenY(g, p.wy);
      ctx.globalAlpha = clamp(1.1 - p.t, 0, 1);
      ctx.strokeStyle = 'rgba(15,36,56,.55)';
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
    });
    ctx.restore();
  }

  function heart(x, y, s, filled) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
    ctx.closePath();
    if (filled) { ctx.fillStyle = '#FF6B6B'; ctx.fill(); }
    ctx.lineWidth = 2; ctx.strokeStyle = filled ? '#FF6B6B' : 'rgba(255,255,255,.8)'; ctx.stroke();
  }

  function drawHud(g) {
    const top = V.safeTop;
    // 남은 시간
    const sec = Math.ceil(g.time);
    const urgent = sec <= 10;
    const pw = 78, ph = 30, py = top + 14;
    const pulse = urgent ? 1 + 0.06 * Math.max(0, Math.sin(g.t * 12)) : 1;
    ctx.save();
    ctx.translate(V.W / 2, py + ph / 2);
    ctx.scale(pulse, pulse);
    rr(-pw / 2, -ph / 2, pw, ph, 15);
    ctx.fillStyle = urgent ? '#E4572E' : 'rgba(15,36,56,.6)';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 17px ' + FONT;
    const left = Math.max(0, sec);
    ctx.fillText(Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), 0, 1);
    ctx.restore();

    // 점수
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 54px ' + FONT;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(15,36,56,.35)';
    ctx.strokeText(g.score, V.W / 2, top + 100);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(g.score, V.W / 2, top + 100);
    // 콤보
    if (g.streak >= 1) {
      ctx.font = '900 14px ' + FONT;
      ctx.fillStyle = '#FFE39A';
      ctx.strokeStyle = 'rgba(15,36,56,.5)';
      ctx.lineWidth = 4;
      const t = '연속 ' + g.streak + ' · 다음 ' + fmtMult(multOf(g.streak + 1));
      ctx.strokeText(t, V.W / 2, top + 150);
      ctx.fillText(t, V.W / 2, top + 150);
    }
    ctx.restore();
    // 하트
    for (let i = 0; i < g.maxLives; i++) heart(V.W / 2 + (i - (g.maxLives - 1) / 2) * 24, top + 112, 16, i < g.lives);
    if (g.quake) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = '900 12px ' + FONT;
      const w = 64, x = V.W / 2 + 48, y = top + 16 + Math.sin(g.t * 40) * 0.8;
      rr(x, y, w, 26, 13);
      ctx.fillStyle = 'rgba(228,87,46,.85)';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText('흔들림', x + 14, y + 14);
      ctx.restore();
    }
  }

  function drawHint(g) {
    if (!App.showHint(g)) return;
    const c = hangingCenter(g);
    const tx = toScreenX(g, topOf(g).cx);
    const topY = toScreenY(g, g.tower.length * CFG.BH);
    ctx.save();
    // 착지 목표 표시
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    shapePath(tx, topY - CFG.BH, g.piece);
    ctx.stroke();
    ctx.setLineDash([]);
    const near = Math.abs(c.x - tx) < 10;
    ctx.textAlign = 'center';
    ctx.font = '900 18px ' + FONT;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    const msg = near ? '지금 탭!' : '점선 위에 왔을 때 탭';
    const y = topY - CFG.BH - 18 - (near ? 4 * Math.sin(g.t * 16) : 0);
    ctx.strokeStyle = 'rgba(15,36,56,.6)';
    ctx.strokeText(msg, V.W / 2, y);
    ctx.fillStyle = near ? '#FFE39A' : '#FFFFFF';
    ctx.fillText(msg, V.W / 2, y);
    ctx.restore();
  }

  function draw(g, withHud) {
    ctx.setTransform(V.S, 0, 0, V.S, 0, 0);
    drawBackground(g);
    drawFloorMarks(g);
    drawTower(g);
    drawFalling(g);
    drawFog(g);
    drawCrane(g);
    drawSparks(g);
    drawFx(g);
    drawBirds(g);
    if (withHud) { drawHint(g); drawHud(g); }
  }

  // ---------- 화면 흐름 ----------
  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    title: $('title'), result: $('result'), pause: $('pause'), banner: $('banner'), hof: $('hof'),
    start: $('startBtn'), again: $('againBtn'), home: $('homeBtn'), cont: $('contBtn'), contSub: $('contSub'),
    resume: $('resumeBtn'), quit: $('quitBtn'), pauseBtn: $('pauseBtn'), soundBtn: $('soundBtn'), musicBtn: $('musicBtn'),
    hofBtn: $('hofBtn'), hofClose: $('hofClose'), hofList: $('hofList'), hofLevel: $('hofLevel'),
    levelPick: $('levelPick'),
    tut: $('tut'), tutBtn: $('tutBtn'), tutPrev: $('tutPrev'), tutNext: $('tutNext'), tutDots: $('tutDots'),
    bestT: $('bestT'), bestLabel: $('bestLabel'), rReason: $('rReason'), rScore: $('rScore'), rNew: $('rNew'),
    rFloors: $('rFloors'), rPerf: $('rPerf'), rEdge: $('rEdge'), rStreak: $('rStreak'), rBest: $('rBest'), rBestLabel: $('rBestLabel')
  };

  // 명예의 전당: 난이도별 상위 5개 기록 (점수 → 층수 → 먼저 세운 기록 순)
  const HOF = {
    data: (function () {
      const d = Platform.storage.get('hof4', null) || {};
      LEVEL_KEYS.forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
      return d;
    })(),
    list: function (level) { return HOF.data[level] || []; },
    best: function (level) { const l = HOF.list(level); return l.length ? l[0].s : 0; },
    // 기록을 넣고 순위(1부터)를 돌려줘요. 순위 밖이면 0.
    add: function (level, rec) {
      if (rec.s <= 0) return 0;
      const l = HOF.list(level).slice();
      l.push(rec);
      l.sort(function (a, b) { return b.s - a.s || b.f - a.f || a.t - b.t; });
      const kept = l.slice(0, CFG.HOF_SIZE);
      HOF.data[level] = kept;
      Platform.storage.set('hof4', HOF.data);
      const i = kept.indexOf(rec);
      return i >= 0 ? i + 1 : 0;
    }
  };

  function dateLabel(ms) {
    const d = new Date(ms);
    return (d.getMonth() + 1) + '.' + d.getDate();
  }

  const App = {
    state: 'title', // title | play | ending | result | paused
    level: LEVELS[Platform.storage.get('level', 'normal')] ? Platform.storage.get('level', 'normal') : 'normal',
    game: null,
    endTimer: 0,
    stats: Platform.storage.get('stats', { plays: 0, totalSec: 0 }),

    sheetTop: function () {
      const el = App.state === 'result' ? ui.result : ui.title;
      if (!el || el.hidden) return L.GY;
      return V.H - el.offsetHeight / V.scale;
    },

    showHint: function (g) {
      return !g.demo && g.hang && !g.over && !App.stats.plays && g.floors < 3;
    },

    show: function (name) {
      ui.title.hidden = name !== 'title';
      ui.result.hidden = name !== 'result';
      ui.pause.hidden = name !== 'paused';
      ui.pauseBtn.hidden = name !== 'play';
      stage.dataset.state = name;
    },

    setLevel: function (level) {
      if (!LEVELS[level]) return;
      App.level = level;
      Platform.storage.set('level', level);
      ui.levelPick.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.level === level ? 'true' : 'false');
      });
      ui.bestLabel.textContent = LEVELS[level].name + ' 최고';
      ui.bestT.textContent = HOF.best(level);
      if (App.state === 'title') {
        const t = App.game ? App.game.t : 0, cam = App.game ? App.game.cam : 0;
        App.game = newGame(true, level);
        App.game.t = t; App.game.cam = cam;
      }
    },

    toTitle: function () {
      App.state = 'title';
      Music.stop();
      App.game = newGame(true, App.level);
      App.setLevel(App.level);
      App.show('title');
    },

    // 시작하기·다시 하기: 이어하기를 빼고는 늘 튜토리얼을 먼저 보여 줘요 (건너뛰기 가능)
    start: function () {
      App.openTut(true);
    },

    begin: function () {
      Sound.unlock();
      Sound.start();
      App.game = newGame(false, App.level);
      App.game.startMs = performance.now();
      App.state = 'play';
      App.show('play');
      Music.setIntensity(0, false);
      Music.start();
      flashBanner(LEVELS[App.level].name + ' · 시작!');
    },

    tap: function () {
      if (App.state === 'play') drop(App.game);
    },

    onGimmick: function (text) {
      flashBanner(text);
    },

    onFinish: function (g) {
      App.state = 'ending';
      App.endTimer = 1.0;
      g.playSec += (performance.now() - g.startMs) / 1000;
      Music.stop();
      Sound.end();
      Platform.haptic('end');
      flashBanner(g.reason === 'time' ? '시간 끝!' : '하트를 다 썼어요');
    },

    showResult: function () {
      const g = App.game;
      // 이어하기 전 기록은 결과 화면에 들어올 때마다 새로 계산하지 않도록 처음 한 번만 넣어요
      if (g.hofRec) {
        HOF.data[g.level] = HOF.list(g.level).filter(function (r) { return r !== g.hofRec && r.t !== g.hofRec.t; });
      }
      const prevBest = g.prevBest != null ? g.prevBest : HOF.best(g.level);
      g.prevBest = prevBest;
      g.hofRec = { s: g.score, f: g.floors, t: g.startedAt };
      const rank = HOF.add(g.level, g.hofRec);
      const isNewBest = rank === 1 && g.score > prevBest;

      ui.rReason.textContent = LEVELS[g.level].name + ' · ' + (g.reason === 'time' ? '시간 끝' : '하트를 다 썼어요');
      ui.rScore.textContent = g.score;
      ui.rNew.hidden = rank === 0;
      ui.rNew.textContent = isNewBest ? '새 기록!' : '명예의 전당 ' + rank + '위';
      ui.rFloors.textContent = g.floors + '층';
      ui.rPerf.textContent = g.perfects + '번';
      ui.rEdge.textContent = g.edges + '번';
      ui.rStreak.textContent = g.bestStreak >= 2 ? g.bestStreak + '번' : '–';
      ui.rBestLabel.textContent = LEVELS[g.level].name + ' 최고';
      ui.rBest.textContent = HOF.best(g.level);
      const canContinue = !g.continued && Platform.ads.rewardedAvailable();
      ui.cont.hidden = !canContinue;
      ui.contSub.textContent = g.reason === 'time' ? '+' + CFG.CONTINUE_TIME + '초 더' : '하트 1개로 계속';
      if (rank > 0) Sound.record();
      App.state = 'result';
      App.show('result');
    },

    // 판이 완전히 끝났을 때 한 번만 횟수 기록
    closeRound: function () {
      const g = App.game;
      if (!g || g.demo || g.closed) return;
      g.closed = true;
      App.stats.plays = (App.stats.plays || 0) + 1;
      App.stats.totalSec = (App.stats.totalSec || 0) + g.playSec;
      Platform.storage.set('stats', App.stats);
    },

    again: function () {
      App.closeRound();
      Platform.ads.maybeInterstitial(App.stats.plays).then(function () { App.openTut(true); });
    },

    home: function () { App.closeRound(); App.toTitle(); },

    continueWithAd: function () {
      const g = App.game;
      ui.cont.disabled = true;
      Platform.ads.showRewarded().then(function (ok) {
        ui.cont.disabled = false;
        if (!ok) return;
        g.continued = true;
        g.over = false;
        if (g.reason === 'time') { g.time = CFG.CONTINUE_TIME; g.lastTick = CFG.CONTINUE_TIME + 1; }
        else { g.lives = CFG.CONTINUE_LIVES; }
        g.reason = null;
        g.hang = true;
        g.fall = null;
        g.startMs = performance.now();
        App.state = 'play';
        App.show('play');
        Music.start();
        flashBanner('이어서!');
      });
    },

    pause: function () {
      if (App.state !== 'play') return;
      App.state = 'paused';
      App.game.playSec += (performance.now() - App.game.startMs) / 1000;
      Music.stop();
      App.show('paused');
    },
    resume: function () {
      if (App.state !== 'paused') return;
      App.state = 'play';
      App.game.startMs = performance.now();
      App.show('play');
      Sound.unlock();
      Music.start();
    },

    // 튜토리얼 (여러 쪽). fromStart면 마지막 쪽 버튼이 '시작하기'
    tutPage: 0, tutFromStart: false,
    openTut: function (fromStart) {
      App.tutFromStart = !!fromStart;
      App.tutPage = 0;
      ui.tut.hidden = false;
      App.renderTut();
    },
    renderTut: function () {
      const pages = ui.tut.querySelectorAll('.tut-page');
      const n = pages.length, p = App.tutPage;
      pages.forEach(function (el, i) { el.hidden = i !== p; });
      ui.tutDots.innerHTML = Array.from({ length: n }, function (_, i) { return '<i' + (i === p ? ' class="on"' : '') + '></i>'; }).join('');
      ui.tutPrev.textContent = p === 0 ? '건너뛰기' : '이전';
      ui.tutNext.textContent = p < n - 1 ? '다음' : (App.tutFromStart ? '시작하기' : '닫기');
    },
    tutMove: function (d) {
      const n = ui.tut.querySelectorAll('.tut-page').length;
      if (d < 0 && App.tutPage === 0) { App.closeTut(); return; }
      if (d > 0 && App.tutPage === n - 1) { App.closeTut(); return; }
      App.tutPage = clamp(App.tutPage + d, 0, n - 1);
      App.renderTut();
    },
    closeTut: function () {
      ui.tut.hidden = true;
      Platform.storage.set('tutSeen', true);
      if (App.tutFromStart) { App.tutFromStart = false; App.begin(); }
    },

    openHof: function (level) {
      ui.hof.hidden = false;
      App.renderHof(level || App.level);
    },
    renderHof: function (level) {
      ui.hofLevel.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.level === level ? 'true' : 'false');
      });
      const l = HOF.list(level);
      let html = '';
      for (let i = 0; i < CFG.HOF_SIZE; i++) {
        const r = l[i];
        html += '<li class="' + (r ? '' : 'empty') + '"><span class="rank">' + (i + 1) + '</span>' +
          (r ? '<span class="pts">' + r.s + '<small>점</small></span><span class="fl">' + r.f + '층</span><span class="dt">' + dateLabel(r.t) + '</span>'
             : '<span class="pts">–</span><span class="fl"></span><span class="dt"></span>') + '</li>';
      }
      ui.hofList.innerHTML = html;
    }
  };
  window.App = App;

  let bannerTimer = null;
  function flashBanner(text) {
    ui.banner.textContent = text;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { ui.banner.classList.remove('show'); }, 900);
  }

  // 타이틀 화면의 자동 시연
  function demoAI(g, dt) {
    if (g.over) return;
    if (g.hang) {
      const c = hangingCenter(g);
      const tx = toScreenX(g, topOf(g).cx);
      g.aim = g.aim == null ? (Math.random() < 0.6 ? 3 : 14) : g.aim;
      if (Math.abs(c.x - tx) < g.aim && Math.random() < dt * 20) { drop(g); g.aim = null; }
    }
    if (g.floors >= 7 && !g.fall && g.hang) {
      g.reset = (g.reset || 0) + dt;
      if (g.reset > 1.2) { const t = g.t, cam = g.cam; App.game = newGame(true, App.level); App.game.t = t; App.game.cam = cam; }
    }
  }

  // ---------- 입력 ----------
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button') || e.target.closest('.cover')) return;
    if (App.state === 'play') {
      e.preventDefault();
      Sound.unlock();
      App.tap();
    }
  });
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.key !== 'Enter') return;
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (!ui.hof.hidden) return;
    if (!ui.tut.hidden) { e.preventDefault(); if (!e.repeat) App.tutMove(1); return; }
    e.preventDefault();
    if (e.repeat) return;
    if (App.state === 'play') App.tap();
    else if (App.state === 'title') App.start();
    else if (App.state === 'result') App.again();
    else if (App.state === 'paused') App.resume();
  });

  function bind(btn, fn) {
    btn.addEventListener('click', function (e) { e.stopPropagation(); Sound.unlock(); Sound.click(); fn(e); });
  }
  bind(ui.start, App.start);
  bind(ui.again, App.again);
  bind(ui.home, App.home);
  bind(ui.cont, App.continueWithAd);
  bind(ui.resume, App.resume);
  bind(ui.quit, function () { App.game.over = true; App.home(); });
  bind(ui.pauseBtn, App.pause);
  bind(ui.hofBtn, function () { App.openHof(); });
  bind(ui.hofClose, function () { ui.hof.hidden = true; });
  bind(ui.tutBtn, function () { App.openTut(false); });
  bind(ui.tutPrev, function () { App.tutMove(-1); });
  bind(ui.tutNext, function () { App.tutMove(1); });
  ui.levelPick.querySelectorAll('button').forEach(function (b) { bind(b, function () { App.setLevel(b.dataset.level); }); });
  ui.hofLevel.querySelectorAll('button').forEach(function (b) { bind(b, function () { App.renderHof(b.dataset.level); }); });

  function syncSound() {
    ui.soundBtn.setAttribute('aria-pressed', Sound.isMuted() ? 'true' : 'false');
    ui.soundBtn.setAttribute('aria-label', Sound.isMuted() ? '효과음 켜기' : '효과음 끄기');
    ui.musicBtn.setAttribute('aria-pressed', Sound.isMusicMuted() ? 'true' : 'false');
    ui.musicBtn.setAttribute('aria-label', Sound.isMusicMuted() ? '배경음악 켜기' : '배경음악 끄기');
  }
  bind(ui.soundBtn, function () { Sound.setMuted(!Sound.isMuted()); syncSound(); });
  bind(ui.musicBtn, function () { Sound.setMusicMuted(!Sound.isMusicMuted()); syncSound(); });
  syncSound();

  // 앱이 뒤로 가면 자동 일시정지
  document.addEventListener('visibilitychange', function () { if (document.hidden) { App.pause(); Music.stop(); } });
  window.addEventListener('blur', function () { App.pause(); });

  // ---------- 루프 ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const g = App.game;
    if (App.state === 'title') { update(g, dt); demoAI(g, dt); }
    else if (App.state === 'play') {
      update(g, dt);
      // 배경음악: 판 시간이 흐를수록 빨라지고, 마지막 10초는 한 단계 더 긴박하게
      const played = clamp(1 - g.time / CFG.GAME_TIME, 0, 1);
      Music.setIntensity(g.continued ? 1 : played, g.time <= 10);
    }
    else if (App.state === 'ending') {
      update(g, dt * 0.5);
      App.endTimer -= dt;
      if (App.endTimer <= 0) App.showResult();
    } else if (App.state === 'result') update(g, dt * 0.5);
    draw(App.game, App.state === 'play' || App.state === 'paused' || App.state === 'ending');
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  App.toTitle();
  window.HOF = HOF;
  const go = function () { requestAnimationFrame(loop); };
  if (document.fonts && document.fonts.load) {
    Promise.race([document.fonts.load('900 20px HankanDisplay'), new Promise(function (r) { setTimeout(r, 1200); })]).then(go, go);
  } else go();
})();
