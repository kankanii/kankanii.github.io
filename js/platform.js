/*
 * 한칸 찾기 · platform.js — 웹(원스토어 웹게임 · GitHub Pages /find/, SDK 부팅은 onestore.js) · 출시 1.0.0
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

  // ---------- 처음 한 번: 개인정보처리방침 동의 (웹/원스토어 전용) ----------
  var PRIVACY = 'https://kankanii.github.io/hankan-find/privacy.html';
  var CONSENT_KEY = 'hankanfind.consent';
  function consented() { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (e) { return false; } }
  function showConsent() {
    if (consented() || document.getElementById('pp-consent')) return;
    var css = '#pp-consent{position:fixed;inset:0;z-index:99999;background:rgba(10,12,34,.92);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"IBM Plex Sans KR",sans-serif;color:#eef0ff}' +
      '#pp-consent .bx{width:100%;max-width:400px;background:#1e2150;border:2px solid #343a7a;border-radius:20px;padding:22px 20px;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
      '#pp-consent h2{margin:0 0 10px;font:400 22px/1.3 "Black Han Sans",sans-serif}' +
      '#pp-consent p{margin:6px 0;font-size:14px;line-height:1.6;color:#c9cdf2}' +
      '#pp-consent ul{margin:8px 0 12px;padding-left:18px;font-size:14px;line-height:1.6;color:#c9cdf2}' +
      '#pp-consent a{color:#f1c84b}' +
      '#pp-consent label{display:flex;gap:10px;align-items:center;margin:14px 0;padding:12px;border-radius:12px;background:#151840;font-size:15px;font-weight:600;cursor:pointer}' +
      '#pp-consent input{width:22px;height:22px;accent-color:#f1c84b;flex:none}' +
      '#pp-consent button{width:100%;padding:14px;border:0;border-radius:14px;background:#f1c84b;color:#13163a;font:400 18px/1 "Black Han Sans",sans-serif;box-shadow:0 4px 0 #b8902a}' +
      '#pp-consent button:disabled{opacity:.4;box-shadow:none}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'pp-consent'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="bx"><h2>개인정보처리방침 안내</h2>' +
      '<p>한칸 찾기는 이름·전화번호·이메일 같은 개인정보를 모으지 않아요.</p>' +
      '<ul><li>게임 기록·설정은 이 기기 브라우저 안에만 저장돼요.</li>' +
      '<li>제작자에게 보내지 않고, 다른 곳에 주지 않아요.</li>' +
      '<li>브라우저 데이터를 지우면 함께 지워져요.</li></ul>' +
      '<p><a data-ext href="' + PRIVACY + '">개인정보처리방침 전문 보기</a></p>' +
      '<label><input type="checkbox" id="pp-ok">개인정보처리방침을 읽었고 동의해요</label>' +
      '<button type="button" id="pp-go" disabled>동의하고 시작하기</button></div>';
    document.body.appendChild(d);
    var ok = d.querySelector('#pp-ok'), go = d.querySelector('#pp-go');
    ok.addEventListener('change', function () { go.disabled = !ok.checked; });
    go.addEventListener('click', function () {
      if (!ok.checked) return;
      try { localStorage.setItem(CONSENT_KEY, '1'); } catch (e) {}
      d.remove(); st.remove();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showConsent); else showConsent();

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
