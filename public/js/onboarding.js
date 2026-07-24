/**
 * Mandate 新手引導 — 簡報式逐頁 wizard（一頁一重點 · 圖文動畫）
 */

const STORAGE_KEY = "mandate-onboard-v3";

const ONBOARD_SLIDES = [
  {
    id: "cover",
    title: "Mandate",
    headline: "碳數據信任閘",
    sub: "讓 AI 跑供應商碳數據流程，申報前仍有人把關",
    visual: () => `
      <div class="vis-cover">
        <div class="vis-logo-ring" aria-hidden="true">
          <span class="vis-logo">M</span>
        </div>
        <div class="vis-cover-tags">
          <span class="vis-tag vis-tag-in">CBAM</span>
          <span class="vis-tag vis-tag-in">供應鏈</span>
          <span class="vis-tag vis-tag-in">AI Agent</span>
        </div>
      </div>
    `,
  },
  {
    id: "not-dashboard",
    title: "先釐清：不是什麼",
    headline: "不是算碳儀表板",
    sub: "不管怎麼省碳——只管數字夠不夠格寫進申報",
    visual: () => `
      <div class="vis-split">
        <div class="vis-split-no vis-pop">
          <span class="vis-split-icon vis-ico-chart" aria-hidden="true"></span>
          <strong>碳儀表板</strong>
          <span class="vis-x">✕</span>
        </div>
        <div class="vis-split-yes vis-pop vis-pop-delay">
          <span class="vis-split-icon vis-ico-shield" aria-hidden="true"></span>
          <strong>信任閘</strong>
          <span class="vis-ok">✓</span>
        </div>
      </div>
    `,
  },
  {
    id: "client",
    title: "商業情境",
    headline: "客戶催交碳數據",
    sub: "CBAM 申報需要上游供應商的 PCF，缺了就不能報",
    visual: () => `
      <div class="vis-scene">
        <div class="vis-bubble vis-bubble-eu vis-pop">
          <span class="vis-badge-eu">EU</span>
          <p>「零件的碳數據交來了嗎？」</p>
        </div>
        <div class="vis-arrow-down vis-draw"></div>
        <div class="vis-box vis-box-you vis-pop vis-pop-delay">
          <span>你 · 買方合規</span>
        </div>
      </div>
    `,
  },
  {
    id: "gate",
    title: "Mandate 的角色",
    headline: "AI 和申報之間的閘門",
    sub: "AI 只能提議；能不能做，由 Policy 決定",
    visual: () => `
      <div class="vis-gate-scene">
        <div class="vis-lane vis-lane-left vis-slide-left">
          <span>AI Agent</span>
          <small>索取 · 檢查 · 申請</small>
        </div>
        <div class="vis-gate vis-gate-pulse">
          <span class="vis-gate-m">M</span>
          <small>信任閘</small>
        </div>
        <div class="vis-lane vis-lane-right vis-slide-right">
          <span>CBAM 草稿</span>
          <small>須你點頭</small>
        </div>
      </div>
    `,
  },
  {
    id: "flow",
    title: "一條龍流程",
    headline: "① 索取 → ② 取回 → ③ 檢查 → ④ 寫入",
    sub: "主控版每張供應商卡，圓點停在第幾步就是卡在哪",
    visual: () => `
      <div class="vis-pipeline">
        <div class="vis-pipe-step vis-pipe-1"><span>①</span>索取</div>
        <div class="vis-pipe-line"></div>
        <div class="vis-pipe-step vis-pipe-2"><span>②</span>取回</div>
        <div class="vis-pipe-line"></div>
        <div class="vis-pipe-step vis-pipe-3"><span>③</span>檢查</div>
        <div class="vis-pipe-line"></div>
        <div class="vis-pipe-step vis-pipe-4"><span>④</span>寫入</div>
      </div>
    `,
  },
  {
    id: "act-chat",
    title: "你能做 ①",
    headline: "跟 AI 下指令",
    sub: "「向無證零件行索取並做品質檢查」— 或一鍵 Demo 三幕",
    visual: () => `
      <div class="vis-mock-chat vis-pop">
        <div class="vis-mock-input">向無證零件行索取碳數據並做品質檢查</div>
        <button type="button" class="vis-mock-send" tabindex="-1">送出</button>
      </div>
      <div class="vis-mock-demo vis-pop vis-pop-delay">AI 自動演三幕</div>
    `,
  },
  {
    id: "act-approve",
    title: "你能做 ②",
    headline: "核准才寫入草稿",
    sub: "品質合格後 AI 只能「申請」— 待核准橫幅必須你按確認",
    visual: () => `
      <div class="vis-mock-banner vis-pop">
        <p>青禾數據合格，申請寫入 CBAM 草稿</p>
        <div class="vis-mock-btns">
          <span class="vis-btn-ok">確認寫入</span>
          <span class="vis-btn-no">不同意</span>
        </div>
      </div>
    `,
  },
  {
    id: "act-revoke",
    title: "你能做 ③",
    headline: "撤銷就不能用",
    sub: "分享一撤，AI 不得再拿這批數字申報——即使還記得舊噸數",
    visual: () => `
      <div class="vis-revoke-scene">
        <div class="vis-data-chip vis-pop">8.1 tCO2e</div>
        <div class="vis-revoke-stamp vis-stamp-in">已撤銷</div>
        <div class="vis-block-bar vis-pop vis-pop-delay">POL-REV-010 · DENY</div>
      </div>
    `,
  },
  {
    id: "act-supplier",
    title: "你能做 ④",
    headline: "供應商自查 JSON",
    sub: "小廠貼資料看缺什麼欄位，不寫入正式申報",
    visual: () => `
      <div class="vis-mock-json vis-pop">
        <code>{ "tCO2e": 8.1 }</code>
        <span class="vis-json-warn vis-blink">缺 method</span>
      </div>
      <div class="vis-mock-check vis-pop vis-pop-delay">檢查能不能交</div>
    `,
  },
  {
    id: "compare",
    title: "為什麼需要",
    headline: "沒有閘門 vs 有 Mandate",
    sub: "降低 AI 亂填申報的法遵與客戶信任風險",
    visual: () => `
      <div class="vis-versus">
        <div class="vis-vs-col vis-vs-bad vis-slide-left">
          <strong>✕ 假數據寫進 CBAM</strong>
          <strong>✕ 出事難追溯</strong>
        </div>
        <div class="vis-vs-col vis-vs-good vis-slide-right">
          <strong>✓ 缺欄位拒收</strong>
          <strong>✓ policyId 稽核</strong>
        </div>
      </div>
    `,
  },
  {
    id: "acts",
    title: "三幕 Demo",
    headline: "30 秒看懂信任邊界",
    sub: "拒收假噸數 → 等你核准 → 撤銷後不能用",
    visual: () => `
      <div class="vis-acts">
        <div class="vis-act vis-act-1 vis-pop"><span>幕一</span>拒收</div>
        <div class="vis-act vis-act-2 vis-pop vis-pop-d1"><span>幕二</span>人審</div>
        <div class="vis-act vis-act-3 vis-pop vis-pop-d2"><span>幕三</span>撤銷</div>
      </div>
    `,
  },
  {
    id: "start",
    title: "從這裡開始",
    headline: "完整介面導覽 → 三幕 Demo",
    sub: "關閉後自動開始；隨時按 ？ 重看",
    visual: () => `
      <div class="vis-start-path">
        <div class="vis-path-step vis-pop"><span>1</span>介面導覽</div>
        <div class="vis-path-arrow vis-draw-short"></div>
        <div class="vis-path-step vis-pop vis-pop-d1"><span>2</span>三幕 Demo</div>
        <div class="vis-path-arrow vis-draw-short"></div>
        <div class="vis-path-step vis-pop vis-pop-d2"><span>3</span>自己試</div>
      </div>
    `,
  },
];

let currentStep = 0;
let onCompleteCallback = null;
let transitioning = false;

function $(id) {
  return document.getElementById(id);
}

function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function renderSlideContent() {
  const slide = ONBOARD_SLIDES[currentStep];
  const body = $("onboard-body");
  const title = $("onboard-title");
  const counter = $("onboard-counter");

  if (title) title.textContent = slide.title;
  if (counter) counter.textContent = `${currentStep + 1} / ${ONBOARD_SLIDES.length}`;

  if (body) {
    body.dataset.step = slide.id;
    body.innerHTML = `
      <article class="onboard-slide">
        <div class="slide-visual">${slide.visual()}</div>
        <div class="slide-copy">
          <h3 class="slide-headline">${slide.headline}</h3>
          <p class="slide-sub">${slide.sub}</p>
        </div>
      </article>
    `;
  }

  const dots = $("onboard-dots");
  if (dots) {
    dots.innerHTML = ONBOARD_SLIDES.map(
      (_, i) =>
        `<button type="button" class="onboard-dot${i === currentStep ? " active" : ""}" data-step="${i}" aria-label="第 ${i + 1} 頁"></button>`
    ).join("");
    dots.querySelectorAll(".onboard-dot").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(Number(btn.dataset.step)));
    });
  }

  const prev = $("onboard-prev");
  const next = $("onboard-next");
  const skip = $("onboard-skip");
  if (prev) prev.hidden = currentStep === 0;
  if (skip) skip.hidden = currentStep === ONBOARD_SLIDES.length - 1;
  if (next) {
    next.textContent =
      currentStep === ONBOARD_SLIDES.length - 1 ? "開始使用 Mandate" : "下一頁";
  }
}

function renderStep() {
  renderSlideContent();
  requestAnimationFrame(() => {
    $("onboard-body")?.classList.add("onboard-enter");
    requestAnimationFrame(() => {
      $("onboard-body")?.classList.remove("onboard-enter");
    });
  });
}

function goToStep(index) {
  const next = Math.max(0, Math.min(ONBOARD_SLIDES.length - 1, index));
  if (next === currentStep || transitioning) return;

  transitioning = true;
  const body = $("onboard-body");
  body?.classList.add("onboard-exit");

  setTimeout(() => {
    currentStep = next;
    renderSlideContent();
    body?.classList.remove("onboard-exit");
    body?.classList.add("onboard-enter");
    requestAnimationFrame(() => {
      body?.classList.remove("onboard-enter");
      transitioning = false;
    });
  }, 220);
}

function isOpen() {
  const overlay = $("onboard-overlay");
  return overlay && !overlay.hidden;
}

export function openOnboarding(options = {}) {
  const overlay = $("onboard-overlay");
  if (!overlay) return;
  transitioning = false;
  currentStep = options.step ?? 0;
  onCompleteCallback = options.onComplete ?? null;
  renderStep();
  overlay.hidden = false;
  document.body.classList.add("onboard-open");
  $("onboard-next")?.focus();
}

export function closeOnboarding(completed = false) {
  const overlay = $("onboard-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("onboard-open");
  if (completed) {
    markOnboardingSeen();
    if (typeof onCompleteCallback === "function") {
      onCompleteCallback();
      onCompleteCallback = null;
    }
  }
}

function finishOnboarding() {
  closeOnboarding(true);
}

export function maybeAutoOpenOnboarding(onComplete) {
  if (hasSeenOnboarding()) return;
  openOnboarding({ onComplete });
}

export function initOnboarding() {
  $("onboard-close")?.addEventListener("click", () => closeOnboarding(true));
  $("onboard-skip")?.addEventListener("click", () => closeOnboarding(true));
  $("onboard-prev")?.addEventListener("click", () => goToStep(currentStep - 1));
  $("onboard-next")?.addEventListener("click", () => {
    if (currentStep >= ONBOARD_SLIDES.length - 1) {
      finishOnboarding();
    } else {
      goToStep(currentStep + 1);
    }
  });
  $("onboard-overlay")?.addEventListener("click", (ev) => {
    if (ev.target.id === "onboard-overlay") closeOnboarding(true);
  });
}

export function handleOnboardingEscape() {
  if (isOpen()) {
    closeOnboarding(true);
    return true;
  }
  return false;
}

export function highlightDemoButton() {
  const btn = $("btn-demo");
  if (!btn) return;
  btn.classList.add("demo-highlight");
  setTimeout(() => btn.classList.remove("demo-highlight"), 1200);
}
