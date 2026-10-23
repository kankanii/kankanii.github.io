/*
 * 한칸 찾기 · onestore.js — 원스토어 H5 Game SDK 부팅 (웹 /find/ 전용) · 출시 1.0.0
 * 순서: createSDK → (이벤트 등록) → initializeAsync → setLoadingProgress → startGameAsync
 * 광고·결제는 쓰지 않음. 원스토어 앱 밖(보통 브라우저)에서는 초기화가 실패해도 게임은 그대로 돈다.
 */
import { createSDK } from 'https://h5sdk.onestore.net/lib/v1.1.0/onestore-h5-sdk.min.js';

var sdk = null;
try { sdk = createSDK(); } catch (e) { sdk = null; }

function snd(fn) { try { if (window.SND && SND.duck) fn(SND); } catch (e) {} }
// 게임의 저장(saveRun)은 pagehide에 묶여 있으므로 같은 이벤트로 저장시킨다
function saveNow() { try { window.dispatchEvent(new Event('pagehide')); } catch (e) {} }
function progress(n) { try { if (sdk) sdk.setLoadingProgress(n); } catch (e) {} }

if (sdk) {
  // 이벤트는 초기화 전에 등록 (가이드 03)
  try {
    sdk.on('pause', function () { saveNow(); snd(function (s) { s.duck(true); }); });
    sdk.on('resume', function () { snd(function (s) { s.duck(false); }); });
    sdk.on('exit', function () { saveNow(); });
  } catch (e) {}

  var started = false;
  function start() {
    if (started) return; started = true;
    progress(100);
    try { Promise.resolve(sdk.startGameAsync()).catch(function () {}); } catch (e) {}
  }
  function whenLoaded() {
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  try {
    Promise.resolve(sdk.initializeAsync()).then(function (r) {
      if (r && r.err) return;            // 원스토어 앱 밖: 그냥 웹으로 실행
      progress(document.readyState === 'complete' ? 90 : 50);
      whenLoaded();
    }).catch(function () {});
  } catch (e) {}
  progress(10);
}
