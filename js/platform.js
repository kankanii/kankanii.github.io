/*
 * 한칸 쌓기 · 플랫폼 연결부
 * 게임 코드는 저장, 진동, 광고를 전부 여기를 통해서만 써요.
 * 토스(앱인토스)·원스토어 빌드에서는 이 파일의 안쪽만 각 SDK로 바꾸면 돼요.
 */
window.Platform = (function () {
  'use strict';

  const PREFIX = 'hankan.';
  const mem = {};

  // 기록 저장. 저장이 막힌 환경에서도 게임은 그대로 돌아가요.
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw != null) return JSON.parse(raw);
      } catch (e) { /* 저장소 사용 불가 */ }
      return key in mem ? mem[key] : fallback;
    },
    set(key, value) {
      mem[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 무시 */ }
    }
  };

  // 진동. 토스 빌드에서는 토스 햅틱 API로 교체.
  const PATTERN = { tap: 8, land: 12, perfect: [10, 30, 14], miss: 40, end: [30, 40, 60] };
  function haptic(kind) {
    if (storage.get('haptic', true) === false) return;
    try { if (navigator.vibrate) navigator.vibrate(PATTERN[kind] || 8); } catch (e) { /* 무시 */ }
  }

  // 광고. 웹 미리보기에서는 3초짜리 '광고 자리' 화면으로 흉내만 내요.
  // 토스 빌드: showRewarded → 토스 보상형 광고, maybeInterstitial → 토스 전면 광고.
  const ads = {
    rewardedAvailable() { return true; },
    showRewarded() {
      return new Promise(function (resolve) {
        const box = document.getElementById('adtest');
        const count = document.getElementById('adCount');
        if (!box) { resolve(true); return; }
        let left = 3;
        count.textContent = left;
        box.hidden = false;
        const timer = setInterval(function () {
          left -= 1;
          count.textContent = left;
          if (left <= 0) {
            clearInterval(timer);
            box.hidden = true;
            resolve(true);
          }
        }, 1000);
      });
    },
    // 판이 끝나고 '다시 하기'를 누를 때 호출. 3판마다 한 번 전면 광고 자리.
    maybeInterstitial(playCount) {
      if (playCount > 0 && playCount % 3 === 0) {
        // 토스 빌드에서 전면 광고 호출
      }
      return Promise.resolve();
    }
  };

  return { name: 'web', storage: storage, haptic: haptic, ads: ads };
})();
