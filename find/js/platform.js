/*
 * 한칸 찾기 · platform.js — 웹(원스토어 등급용 · GitHub Pages /find/) · 출시 1.0.0
 * 저장 · 진동 · 광고 · 결제 · 순위표는 이 파일에서만 처리한다. 게임 파일은 모든 스토어가 같이 쓴다.
 * 웹 버전: 광고 없음 · 현금 상품 없음 · 순위표 없음. 진행 기록은 이 기기 브라우저 안에만 저장.
 */
window.Platform = (function () {
  'use strict';
  var TARGET = 'web';
  var KEY = 'hankanfind.v1';

  // ---------- 저장 (이 기기 안에만) ----------
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  // ---------- 진동 ----------
  function vibrate(ms) { try { if (ms && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // ---------- 광고 · 결제 · 순위표: 웹에는 없음 ----------
  function showRewarded() { return Promise.resolve(false); }
  function showInterstitial() { return Promise.resolve(false); }
  function buy() { return Promise.resolve({ ok: false }); }
  function restore() { return Promise.resolve({ ok: false, restored: 0 }); }
  function hasNoAds() { return true; }
  function submitScore() { return Promise.resolve(false); }
  function openLeaderboard() { return Promise.resolve(false); }
  function onGrant() {}

  // ---------- 바깥 링크 (개인정보처리방침) ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-ext]'); if (!a) return;
    e.preventDefault();
    try { window.open(a.href, '_blank', 'noopener'); } catch (x) { location.href = a.href; }
  });

  return {
    target: TARGET,
    features: { ads: false, iap: false, restore: false, leaderboard: false },
    products: [],
    leaderboards: { timeattack: 'timeattack', stage: 'stage' },
    load: load, save: save, vibrate: vibrate,
    showRewarded: showRewarded, showInterstitial: showInterstitial,
    buy: buy, restore: restore, hasNoAds: hasNoAds,
    submitScore: submitScore, openLeaderboard: openLeaderboard, onGrant: onGrant
  };
})();
