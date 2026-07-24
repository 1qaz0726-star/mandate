/**
 * 政策引擎圖文教學 — 簡報式 wizard + 一鍵演示
 */

const STORAGE_KEY = "mandate-policy-guide-v1";

const SLIDES = [
  {
    id: "what",
    title: "政策引擎教學",
    headline: "這裡是「規則怎麼判」的透明後台",
    sub: "AI 只能提議下一步；能不能做，由這裡的確定性規則決定。給評審／合規看，不用讀程式碼。",
    visual: () => `
      <div class="pg-vis-compare">
        <div class="pg-vis-box real">
          <strong>主控版 · 詳細控制</strong>
          真實操作<br/>會寫入 audit
        </div>
        <div class="pg-vis-box sandbox">
          <strong>政策引擎</strong>
          沙盒模擬<br/><em>不</em>寫 audit
        </div>
      </div>
    `,
  },
  {
    id: "columns",
    title: "三欄怎麼讀",
    headline: "左查規則 · 中看結果 · 右看現況",
    sub: "模擬跑完後，中間會亮起第幾步通過／哪一步擋下；右邊是當下 Mandate、是否已索取、是否撤銷。",
    visual: () => `
      <div class="pg-vis-cols">
        <div class="pg-vis-col"><strong>左</strong>政策目錄<br/>POL-* 規則</div>
        <div class="pg-vis-col mid"><strong>中</strong>六步管線<br/>+ 模擬結果</div>
        <div class="pg-vis-col"><strong>右</strong>即時上下文<br/>供應商狀態</div>
      </div>
    `,
  },
  {
    id: "pipeline",
    title: "六步管線",
    headline: "由上而下短路：先擋的先顯示",
    sub: "例如「只有噸數」會在第 ④ 步資料約束被 POL-CARB-001 拒收；Agent 不能 commit 會在第 ② 步擋下。",
    visual: () => `
      <div class="pg-vis-steps">
        <div class="pg-vis-step pass"><span class="n">✓</span>① 授權狀態</div>
        <div class="pg-vis-step pass"><span class="n">✓</span>② 拒絕清單</div>
        <div class="pg-vis-step pass"><span class="n">✓</span>③ 工具準入</div>
        <div class="pg-vis-step fail"><span class="n">✗</span>④ 資料約束 · POL-CARB-001</div>
        <div class="pg-vis-step skip"><span class="n">—</span>⑤ 人類確認（略過）</div>
        <div class="pg-vis-step skip"><span class="n">—</span>⑥ 全部通過（略過）</div>
      </div>
    `,
  },
  {
    id: "presets",
    title: "最快上手",
    headline: "先按左下「幕一：拒收噸數」",
    sub: "四顆按鈕對應 Demo 三幕 + Agent 禁 commit。按下去會自動填模擬器並執行，中間立刻看到管線。",
    visual: () => `
      <div class="pg-vis-presets">
        <span class="btn btn-sm btn-ghost highlight">幕一：拒收噸數</span>
        <span class="btn btn-sm btn-ghost">幕二：申請寫入</span>
        <span class="btn btn-sm btn-ghost">幕三：撤銷後取回</span>
        <span class="btn btn-sm btn-ghost">Agent 禁 commit</span>
      </div>
      <p class="pg-vis-arrow">↓</p>
      <div class="pg-vis-step fail" style="margin:0"><span class="n">✗</span>④ POL-CARB-001 · 缺 method／boundary…</div>
    `,
  },
  {
    id: "manual",
    title: "進階：自己填",
    headline: "底部模擬器可改工具、角色、供應商",
    sub: "想試別的情境：選工具 → 選 Agent／Human → 選供應商 →（可選 JSON）→ 按「執行模擬」。",
    visual: () => `
      <div class="pg-vis-box sandbox" style="text-align:left">
        <strong>工具</strong> ingest_pcf_payload<br/>
        <strong>角色</strong> Agent<br/>
        <strong>供應商</strong> 無證零件行<br/>
        <code style="font-size:0.75rem;display:block;margin-top:8px">{"supplierId":"…","tCO2e":8.1}</code>
      </div>
    `,
  },
  {
    id: "try",
    title: "立即試試",
    headline: "關閉後自動跑「幕一」給你看",
    sub: "真實操作的 audit 在「詳細控制」右欄；這裡只是解釋規則，不會改你的 Demo 狀態。",
    visual: () => `
      <div class="pg-demo-cta">
        <p class="pg-sub" style="margin-bottom:12px">按下方按鈕，教學結束後會自動演示拒收噸數。</p>
        <button type="button" class="btn btn-primary" id="pg-run-act1">演示：幕一拒收</button>
      </div>
    `,
  },
];

let current = 0;
let onComplete = null;
let runPresetFn = null;

function $(id) {
  return document.getElementById(id);
}

function hasSeenGuide() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function renderSlide() {
  const slide = SLIDES[current];
  $("pg-title").textContent = slide.title;
  $("pg-counter").textContent = `${current + 1} / ${SLIDES.length}`;
  $("pg-body").innerHTML = `
    <div class="pg-slide-visual">${slide.visual()}</div>
    <h3 class="pg-headline">${slide.headline}</h3>
    <p class="pg-sub">${slide.sub}</p>
  `;

  $("pg-run-act1")?.addEventListener("click", () => {
    closeGuide(true, "act1");
  });

  const dots = $("pg-dots");
  if (dots) {
    dots.innerHTML = SLIDES.map(
      (_, i) =>
        `<button type="button" class="pg-dot${i === current ? " active" : ""}" data-i="${i}" aria-label="第 ${i + 1} 頁"></button>`
    ).join("");
    dots.querySelectorAll(".pg-dot").forEach((b) => {
      b.addEventListener("click", () => goTo(Number(b.dataset.i)));
    });
  }

  $("pg-prev").hidden = current === 0;
  $("pg-skip").hidden = current === SLIDES.length - 1;
  $("pg-next").textContent = current === SLIDES.length - 1 ? "關閉並演示" : "下一頁";
}

function goTo(i) {
  current = Math.max(0, Math.min(SLIDES.length - 1, i));
  renderSlide();
}

function isOpen() {
  const o = $("policy-guide-overlay");
  return o && !o.hidden;
}

export function openPolicyGuide(options = {}) {
  const overlay = $("policy-guide-overlay");
  if (!overlay) return;
  current = options.step ?? 0;
  onComplete = options.onComplete ?? null;
  renderSlide();
  overlay.hidden = false;
  document.body.classList.add("policy-guide-open");
}

export function closeGuide(completed = false, runPreset) {
  const overlay = $("policy-guide-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("policy-guide-open");
  if (completed) {
    markSeen();
    const qs = document.getElementById("policy-quickstart");
    if (qs) qs.hidden = true;
    if (runPreset && runPresetFn) {
      setTimeout(() => runPresetFn(runPreset), 300);
    }
    onComplete?.();
    onComplete = null;
  }
}

export function maybeAutoOpenPolicyGuide() {
  if (hasSeenGuide()) return;
  openPolicyGuide();
}

export function initPolicyGuide({ runPreset }) {
  runPresetFn = runPreset;

  $("pg-close")?.addEventListener("click", () => closeGuide(true));
  $("pg-skip")?.addEventListener("click", () => closeGuide(true));
  $("pg-prev")?.addEventListener("click", () => goTo(current - 1));
  $("pg-next")?.addEventListener("click", () => {
    if (current >= SLIDES.length - 1) {
      closeGuide(true, "act1");
    } else {
      goTo(current + 1);
    }
  });
  $("policy-guide-overlay")?.addEventListener("click", (ev) => {
    if (ev.target.id === "policy-guide-overlay") closeGuide(true);
  });
  $("btn-policy-guide")?.addEventListener("click", () => openPolicyGuide());
  $("policy-quickstart-guide")?.addEventListener("click", () => openPolicyGuide());
  $("policy-quickstart-demo")?.addEventListener("click", () => runPresetFn?.("act1"));
}

export function handlePolicyGuideEscape() {
  if (isOpen()) {
    closeGuide(true);
    return true;
  }
  return false;
}
