/*
 * 한칸 쌓기 · 원스토어 H5 Game SDK 연결 (v1.1.0)
 * 원스토어 안에서 열리면: 초기화 → 로딩 100% → 게임 시작 알림, 일시정지·소리 끄기, 뒤로가기 처리.
 * 원스토어 밖(직접 접속 등)에서는 SDK가 응답하지 않아도 게임이 그대로 돌아가요.
 * 광고·결제는 나중에 이 파일과 platform.js에 붙여요.
 */
import { createSDK } from "https://h5sdk.onestore.net/lib/v1.1.0/onestore-h5-sdk.min.js";

const sdk = createSDK();
window.OneStore = sdk;

function audioCtx() { try { return window.Sound && Sound.context(); } catch (e) { return null; } }

sdk.on("pause", function () {
  if (window.Game) Game.pause();
  const c = audioCtx();
  if (c && c.state === "running") c.suspend().catch(function () {});
});
sdk.on("resume", function () {
  const c = audioCtx();
  if (c && c.state === "suspended") c.resume().catch(function () {});
});
sdk.on("exit", function () { /* 기록은 판이 끝날 때마다 이미 저장돼요 */ });

sdk.onBackPressed(function () {
  if (window.Game && Game.isPlaying()) { Game.pause(); return true; }
  return false;
});

function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load("900 20px HankanDisplay"),
    new Promise(function (r) { setTimeout(r, 1500); })
  ]).catch(function () {});
}

sdk.initializeAsync()
  .then(function (info) {
    if (info && info.err) { console.warn("원스토어 SDK 초기화 오류", info.err); return; }
    sdk.setLoadingProgress(50);
    return fontsReady().then(function () {
      sdk.setLoadingProgress(100);
      return sdk.startGameAsync();
    });
  })
  .catch(function (e) {
    console.warn("원스토어 SDK 연결 안 됨(원스토어 밖이면 정상)", e && (e.reason || e.message));
  });
