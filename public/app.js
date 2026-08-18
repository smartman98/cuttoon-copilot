const API = "/api";

let currentProject = null;
let currentPreset = null;
let currentSession = null;

const breadcrumbEl = document.getElementById("breadcrumb");
const projectView = document.getElementById("project-view");
const presetView = document.getElementById("preset-view");
const sessionListView = document.getElementById("session-list-view");
const sessionDetailView = document.getElementById("session-detail-view");
const archiveView = document.getElementById("archive-view");

const projectListEl = document.getElementById("project-list");

const ALL_VIEWS = [projectView, presetView, sessionListView, sessionDetailView, archiveView];
function hideAllViews() {
  ALL_VIEWS.forEach((v) => { v.hidden = true; });
}

function renderBreadcrumb() {
  const parts = [];
  parts.push(currentProject
    ? `<button data-nav="project">${currentProject.name}</button>`
    : `<span>Project</span>`);
  if (currentPreset) {
    parts.push(">");
    parts.push(`<button data-nav="preset">프리셋</button>`);
  }
  if (currentSession) {
    parts.push(">");
    parts.push(`<span>컷툰 만들기</span>`);
  }
  breadcrumbEl.innerHTML = parts.join(" ");
}

breadcrumbEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nav]");
  if (!btn) return;
  if (btn.dataset.nav === "project") {
    showProjectView();
  } else if (btn.dataset.nav === "preset") {
    currentSession = null;
    showPresetView();
  }
});

function showProjectView() {
  hideAllViews();
  currentProject = null;
  currentPreset = null;
  currentSession = null;
  projectView.hidden = false;
  renderBreadcrumb();
  fetchProjects();
}

function showPresetView() {
  hideAllViews();
  presetView.hidden = false;
  renderBreadcrumb();
  fetchProjectDetail();
}

function showSessionListView() {
  hideAllViews();
  sessionListView.hidden = false;
  document.getElementById("new-session-form").hidden = true;
  renderBreadcrumb();
  fetchSessions();
}

function showSessionDetailView() {
  hideAllViews();
  sessionDetailView.hidden = false;
  renderBreadcrumb();
}

function showArchiveView() {
  hideAllViews();
  archiveView.hidden = false;
  renderBreadcrumb();
  fetchArchive();
}

// ---------- Project ----------

async function fetchProjects() {
  const res = await fetch(`${API}/projects`);
  const rows = await res.json();
  projectListEl.innerHTML = rows.length
    ? rows.map((p) => `
        <li class="card-item" data-id="${p.id}">
          <span class="name">${p.name}</span>
          <span class="meta">${new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
          <button class="delete-item-btn" data-id="${p.id}" title="삭제">✕</button>
        </li>
      `).join("")
    : `<p class="muted">아직 Project가 없습니다. "+ 새 Project"로 시작하세요.</p>`;
}

projectListEl.addEventListener("click", async (e) => {
  const delBtn = e.target.closest(".delete-item-btn");
  if (delBtn) {
    if (!confirm("이 Project와 그 안의 프리셋/모든 세션/완성본을 전부 삭제할까요? 되돌릴 수 없습니다.")) return;
    await fetch(`${API}/projects/${delBtn.dataset.id}`, { method: "DELETE" });
    fetchProjects();
    return;
  }
  const item = e.target.closest(".card-item");
  if (!item) return;
  const res = await fetch(`${API}/projects`);
  const rows = await res.json();
  currentProject = rows.find((p) => String(p.id) === item.dataset.id);
  showPresetView();
});

document.getElementById("new-project-btn").addEventListener("click", async () => {
  const name = prompt("Project 이름 (예: 강사 모집 공감 컷툰)");
  if (!name || !name.trim()) return;
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (res.ok) fetchProjects();
});

// ---------- Preset ----------

const presetEmptyBlock = document.getElementById("preset-empty-block");
const presetProposedBlock = document.getElementById("preset-proposed-block");
const presetConfirmedBlock = document.getElementById("preset-confirmed-block");
const CHARACTER_SHEET_LABEL = { character: "캐릭터", style: "시각 스타일", scene: "장면 규칙", rule: "표현 규칙" };

async function fetchProjectDetail() {
  const res = await fetch(`${API}/projects/${currentProject.id}`);
  const data = await res.json();
  currentPreset = data.preset;
  renderPreset(data.preset);
}

function renderPreset(preset) {
  presetEmptyBlock.hidden = true;
  presetProposedBlock.hidden = true;
  presetConfirmedBlock.hidden = true;

  if (preset.status === "confirmed") {
    presetConfirmedBlock.hidden = false;
    document.getElementById("confirmed-image").src = preset.confirmed_image_url;
    showSessionListView(); // 프리셋 확정된 프로젝트는 바로 Session Studio로
    return;
  }

  if (preset.status === "proposed") {
    presetProposedBlock.hidden = false;
    document.getElementById("sheet-image").src = preset.draft_image_url;
    const sheet = preset.character_sheet ? preset.character_sheet : JSON.parse(preset.character_sheet_json || "{}");
    document.getElementById("sheet-list").innerHTML = Object.entries(sheet).map(([k, v]) => `
      <li><span class="cat-badge">${CHARACTER_SHEET_LABEL[k] || k}</span><span>${v}</span></li>
    `).join("");
    return;
  }

  presetEmptyBlock.hidden = false;
  document.getElementById("reference-note").value = preset.reference_note || "";
}

document.getElementById("analyze-btn").addEventListener("click", async () => {
  const note = document.getElementById("reference-note").value;
  const res = await fetch(`${API}/presets/${currentPreset.id}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_note: note }),
  });
  const data = await res.json();
  if (res.ok) { currentPreset = data; renderPreset(data); }
});

document.getElementById("reroll-preset-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/presets/${currentPreset.id}/reroll`, { method: "POST" });
  const data = await res.json();
  if (res.ok) { currentPreset = data; renderPreset(data); }
});

document.getElementById("confirm-preset-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/presets/${currentPreset.id}/confirm`, { method: "POST" });
  const data = await res.json();
  if (res.ok) { currentPreset = data; renderPreset(data); }
});

// ---------- Session Studio 목록 ----------

const sessionListEl = document.getElementById("session-list");
const newSessionForm = document.getElementById("new-session-form");

async function fetchSessions() {
  const res = await fetch(`${API}/projects/${currentProject.id}/sessions`);
  const rows = await res.json();
  sessionListEl.innerHTML = rows.length
    ? rows.map((s) => `
        <li class="card-item" data-id="${s.id}">
          <span class="name">${s.material_text.slice(0, 30)}${s.material_text.length > 30 ? "…" : ""}</span>
          <span class="meta">${s.status === "completed" ? "완성" : s.status === "covers" ? "표지 선택중" : "진행중"}</span>
          <button class="delete-item-btn" data-id="${s.id}" title="삭제">✕</button>
        </li>
      `).join("")
    : `<p class="muted">아직 세션이 없습니다. "+ 새 세션"으로 시작하세요.</p>`;
}

sessionListEl.addEventListener("click", async (e) => {
  const delBtn = e.target.closest(".delete-item-btn");
  if (delBtn) {
    if (!confirm("이 세션과 저장된 완성본을 전부 삭제할까요? 되돌릴 수 없습니다.")) return;
    await fetch(`${API}/sessions/${delBtn.dataset.id}`, { method: "DELETE" });
    fetchSessions();
    return;
  }
  const item = e.target.closest(".card-item");
  if (!item) return;
  await openSession(item.dataset.id);
});

document.getElementById("new-session-btn").addEventListener("click", () => {
  newSessionForm.hidden = !newSessionForm.hidden;
});

// 소재를 처음부터 문장으로 쓰는 게 부담스럽다는 사용자 피드백(2026-08-16)으로 추가 —
// 완전한 예시 5개를 미리 써두고 클릭 한 번으로 채워 넣는다. 고른 뒤에도 직접 수정 가능.
const SESSION_TEMPLATES = [
  { label: "① 기본 공감형", hint: "감정이 서서히 바뀌는 흐름",
    text: "갱년기가 시작되며 몸이 예전 같지 않다고 느낀 엄마. 계단만 올라가도 숨이 차고 무릎이 시큰거렸다. 딸이 권한 운동을 처음엔 손사래치며 거절했다. 마지못해 트레이너와 첫 수업을 시작했다." },
  { label: "② 거부→전환형", hint: "처음엔 싫다더니 바뀌는 이야기",
    text: "운동은 젊을 때나 하는 거라며 손사래치던 엄마. 딸의 성화에 못 이겨 억지로 첫 수업에 나갔다. 낯선 동작에 몸이 뻣뻣하게 굳었다. 트레이너가 \"천천히, 숨부터\"라고 다독였다." },
  { label: "③ 증상 중심형", hint: "무릎 통증 극복 서사",
    text: "몇 년째 무릎이 시큰거려 계단을 피해 다니던 엄마. 병원에서도 뾰족한 답을 못 들었다. 지인 소개로 시니어 전문 트레이너를 만났다. 무릎 대신 코어와 호흡부터 안정시키는 훈련을 시작했다." },
  { label: "④ 유머형", hint: "가볍고 웃긴 톤",
    text: "\"이 나이에 무슨 운동이냐\"며 딸에게 큰소리쳤던 엄마. 정작 화장실 갈 때마다 무릎에서 나는 소리가 신경 쓰였다. 결국 몰래 트레이너 수업을 예약했다. 첫날 숨이 턱까지 차서 딸에게 등짝을 맞았다고 놀렸다." },
  { label: "⑤ 트레이너 시점형", hint: "전문성 강조",
    text: "평생 운동을 해보신 적 없는 어르신이었습니다. 무릎 통증으로 앉았다 일어나는 것조차 힘들어했다. 트레이너는 근력보다 호흡과 힘 전달 순서 인지에 먼저 집중했다. 배→엉덩이→다리 순서로 힘이 전달되는 감각을 매 수업마다 반복했다." },
];

const templatePickerEl = document.getElementById("template-picker");
templatePickerEl.innerHTML = SESSION_TEMPLATES.map((t, i) => `
  <button type="button" class="template-btn" data-index="${i}">
    <span class="template-label">${t.label}</span>
    <span class="template-hint">${t.hint}</span>
  </button>
`).join("");

templatePickerEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".template-btn");
  if (!btn) return;
  const template = SESSION_TEMPLATES[Number(btn.dataset.index)];
  document.getElementById("session-material").value = template.text;
  templatePickerEl.querySelectorAll(".template-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

document.getElementById("create-session-btn").addEventListener("click", async () => {
  const materialText = document.getElementById("session-material").value.trim();
  if (!materialText) { alert("소재를 입력하세요."); return; }
  const res = await fetch(`${API}/projects/${currentProject.id}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ material_text: materialText }),
  });
  if (res.ok) {
    const session = await res.json();
    document.getElementById("session-material").value = "";
    newSessionForm.hidden = true;
    await openSession(session.id);
  }
});

// ---------- 세션 진행: 3턴 빈칸채우기 → 표지 3안 → 완성 ----------

const wizardBlock = document.getElementById("wizard-block");
const coversBlock = document.getElementById("covers-block");
const resultBlock = document.getElementById("result-block");
const wizardOptionsEl = document.getElementById("wizard-options");
const coverGridEl = document.getElementById("cover-grid");
const resultCutsEl = document.getElementById("result-cuts");

let wizardOptionsData = null;
const WIZARD_FIELDS = ["template", "angle", "cta"];
const WIZARD_TITLES = {
  template: "턴 1 — 어떤 이야기로 갈까요?",
  angle: "턴 2 — 어떤 각도로 풀까요?",
  cta: "턴 3 — 마지막 컷은 무엇으로?",
};

async function openSession(sessionId) {
  const res = await fetch(`${API}/sessions/${sessionId}`);
  const data = await res.json();
  currentSession = data.session;
  wizardOptionsData = data.wizardOptions;
  showSessionDetailView();

  wizardBlock.hidden = true;
  coversBlock.hidden = true;
  resultBlock.hidden = true;

  if (currentSession.status === "completed" && data.outputs.length) {
    renderResult(data.outputs[data.outputs.length - 1]);
  } else if (currentSession.status === "covers" || currentSession.turn > 3) {
    coversBlock.hidden = false;
    coverGridEl.innerHTML = "";
  } else {
    wizardBlock.hidden = false;
    renderWizardTurn();
  }
}

function renderWizardTurn() {
  const field = WIZARD_FIELDS[currentSession.turn - 1];
  document.getElementById("wizard-title").textContent = WIZARD_TITLES[field];
  wizardOptionsEl.innerHTML = wizardOptionsData[field].map((opt) => `
    <button type="button" class="wizard-option-btn" data-field="${field}" data-value="${opt}">${opt}</button>
  `).join("");
}

wizardOptionsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest(".wizard-option-btn");
  if (!btn) return;
  const res = await fetch(`${API}/sessions/${currentSession.id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field: btn.dataset.field, value: btn.dataset.value }),
  });
  currentSession = await res.json();
  if (currentSession.turn > 3) {
    wizardBlock.hidden = true;
    coversBlock.hidden = false;
  } else {
    renderWizardTurn();
  }
});

document.getElementById("skip-wizard-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/sessions/${currentSession.id}/skip`, { method: "POST" });
  currentSession = await res.json();
  wizardBlock.hidden = true;
  coversBlock.hidden = false;
});

document.getElementById("generate-covers-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/sessions/${currentSession.id}/generate-covers`, { method: "POST" });
  const data = await res.json();
  if (res.ok) renderCovers(data.variants);
});

function renderCovers(variants) {
  coverGridEl.innerHTML = variants.map((v) => `
    <div class="candidate-card" data-variant="${v.variant}" data-tone="${v.tone}">
      <img src="${v.cover.image_url}" alt="표지 안 ${v.variant + 1}" />
      <div class="pick-label">안 ${v.variant + 1} (${v.tone})</div>
    </div>
  `).join("");
}

coverGridEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".candidate-card");
  if (!card) return;
  const res = await fetch(`${API}/sessions/${currentSession.id}/pick-cover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant: Number(card.dataset.variant), tone: card.dataset.tone }),
  });
  const output = await res.json();
  if (res.ok) {
    coversBlock.hidden = true;
    renderResult(output);
  }
});

// 말풍선은 위치만 드래그로 조정 가능(크기/꼬리/글꼴은 자동 — 브리프 명시).
function renderResult(output) {
  resultBlock.hidden = false;
  resultCutsEl.dataset.outputId = output.id;
  resultCutsEl.innerHTML = output.cuts.map((c) => `
    <div class="cut-canvas" data-index="${c.index}">
      <img src="${c.image_url}" alt="컷 ${c.index}" />
      <div class="bubble" style="left:${c.bubble_x}%; top:${c.bubble_y}%;">${c.caption}</div>
    </div>
  `).join("");
  attachBubbleDrag();
}

function attachBubbleDrag() {
  resultCutsEl.querySelectorAll(".bubble").forEach((bubble) => {
    bubble.addEventListener("mousedown", (e) => {
      const canvas = bubble.closest(".cut-canvas");
      const rect = canvas.getBoundingClientRect();
      const onMove = (moveEvent) => {
        const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        bubble.style.left = `${Math.max(0, Math.min(100, x))}%`;
        bubble.style.top = `${Math.max(0, Math.min(100, y))}%`;
      };
      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        await fetch(`${API}/outputs/${resultCutsEl.dataset.outputId}/bubble`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cut_index: Number(canvas.dataset.index),
            x: parseFloat(bubble.style.left),
            y: parseFloat(bubble.style.top),
          }),
        });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });
  });
}

document.getElementById("continue-series-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/sessions/${currentSession.id}/continue`, { method: "POST" });
  if (res.ok) {
    const newSession = await res.json();
    alert("후속편 세션이 생성됐습니다. 세션 목록에서 확인하세요.");
    showSessionListView();
  }
});

// ---------- Export & Archive ----------

const archiveGroupsEl = document.getElementById("archive-groups");

document.getElementById("view-archive-btn").addEventListener("click", showArchiveView);
document.getElementById("back-to-sessions-btn").addEventListener("click", showSessionListView);

async function fetchArchive() {
  const res = await fetch(`${API}/projects/${currentProject.id}/outputs`);
  const groups = await res.json();
  archiveGroupsEl.innerHTML = groups.length
    ? groups.map((g) => `
        <div class="archive-group">
          <h3>${g.root_label}</h3>
          ${g.items.map((item) => `
            <div class="archive-item">
              <div class="archive-item-header">
                <span class="episode-badge">${item.episode_no}화</span>
                <span class="meta">${item.session_label} · 버전 ${item.version_no} · ${new Date(item.created_at).toLocaleString("ko-KR")}</span>
                <a class="ghost-btn" href="${API}/outputs/${item.id}/download">다운로드</a>
              </div>
              <div class="cut-strip">
                ${item.cuts.map((c) => `<div class="cut-item"><img src="${c.image_url}" alt="컷 ${c.index}" /><p>${c.caption}</p></div>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      `).join("")
    : `<p class="muted">아직 완성된 결과물이 없습니다. Session Studio에서 컷툰을 완료하면 여기 모입니다.</p>`;
}

showProjectView();
