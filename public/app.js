const API = "/api";

let currentWorkspace = null;
let currentProject = null;
let currentPreset = null;
let currentSession = null;

const breadcrumbEl = document.getElementById("breadcrumb");
const workspaceView = document.getElementById("workspace-view");
const projectView = document.getElementById("project-view");
const presetView = document.getElementById("preset-view");
const sessionListView = document.getElementById("session-list-view");
const sessionDetailView = document.getElementById("session-detail-view");
const archiveView = document.getElementById("archive-view");
const comicEditorView = document.getElementById("comic-editor-view");

const workspaceListEl = document.getElementById("workspace-list");
const projectListEl = document.getElementById("project-list");

const ALL_VIEWS = [workspaceView, projectView, presetView, sessionListView, sessionDetailView, archiveView, comicEditorView];
function hideAllViews() {
  ALL_VIEWS.forEach((v) => { v.hidden = true; });
}

function renderBreadcrumb() {
  const parts = [];
  parts.push(currentWorkspace
    ? `<button data-nav="workspace">${currentWorkspace.name}</button>`
    : `<span>Workspace</span>`);
  if (currentProject) {
    parts.push(">");
    parts.push(`<button data-nav="project">${currentProject.name}</button>`);
  }
  if (currentPreset) {
    parts.push(">");
    parts.push(`<button data-nav="preset">Preset Builder</button>`);
  }
  if (currentSession) {
    parts.push(">");
    parts.push(`<span>${currentSession.name}</span>`);
  }
  breadcrumbEl.innerHTML = parts.join(" ");
}

breadcrumbEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nav]");
  if (!btn) return;
  if (btn.dataset.nav === "workspace") {
    currentProject = null;
    currentPreset = null;
    currentSession = null;
    showWorkspaceView();
  } else if (btn.dataset.nav === "project") {
    currentPreset = null;
    currentSession = null;
    showProjectView();
  } else if (btn.dataset.nav === "preset") {
    currentSession = null;
    showPresetView();
  }
});

function showWorkspaceView() {
  hideAllViews();
  workspaceView.hidden = false;
  renderBreadcrumb();
  fetchWorkspaces();
}

function showProjectView() {
  hideAllViews();
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

function showComicEditorView() {
  hideAllViews();
  comicEditorView.hidden = false;
  renderBreadcrumb();
}

// ---------- Workspace ----------

async function fetchWorkspaces() {
  const res = await fetch(`${API}/workspaces`);
  const rows = await res.json();
  workspaceListEl.innerHTML = rows.length
    ? rows.map((w) => `
        <li class="card-item" data-id="${w.id}">
          <span class="name">${w.name}</span>
          <span class="meta">${new Date(w.created_at).toLocaleDateString("ko-KR")}</span>
        </li>
      `).join("")
    : `<p class="muted">아직 Workspace가 없습니다. "+ 새 Workspace"로 시작하세요.</p>`;
}

workspaceListEl.addEventListener("click", async (e) => {
  const item = e.target.closest(".card-item");
  if (!item) return;
  const res = await fetch(`${API}/workspaces`);
  const rows = await res.json();
  currentWorkspace = rows.find((w) => String(w.id) === item.dataset.id);
  showProjectView();
});

document.getElementById("new-workspace-btn").addEventListener("click", async () => {
  const name = prompt("Workspace 이름 (예: 마케팅팀 컷툰 스튜디오)");
  if (!name || !name.trim()) return;
  const res = await fetch(`${API}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (res.ok) fetchWorkspaces();
});

// ---------- Project ----------

async function fetchProjects() {
  const res = await fetch(`${API}/workspaces/${currentWorkspace.id}/projects`);
  const rows = await res.json();
  projectListEl.innerHTML = rows.length
    ? rows.map((p) => `
        <li class="card-item" data-id="${p.id}">
          <span class="name">${p.name}</span>
          <span class="meta">${new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
        </li>
      `).join("")
    : `<p class="muted">아직 Project가 없습니다. "+ 새 Project"로 시작하세요.</p>`;
}

projectListEl.addEventListener("click", async (e) => {
  const item = e.target.closest(".card-item");
  if (!item) return;
  const res = await fetch(`${API}/workspaces/${currentWorkspace.id}/projects`);
  const rows = await res.json();
  currentProject = rows.find((p) => String(p.id) === item.dataset.id);
  showPresetView();
});

document.getElementById("new-project-btn").addEventListener("click", async () => {
  const name = prompt("Project 이름 (예: 강사 모집 공감 컷툰)");
  if (!name || !name.trim()) return;
  const res = await fetch(`${API}/workspaces/${currentWorkspace.id}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (res.ok) fetchProjects();
});

// ---------- Preset Builder ----------

const step1Block = document.getElementById("step1-block");
const step2Block = document.getElementById("step2-block");
const step3Block = document.getElementById("step3-block");
const confirmedBlock = document.getElementById("confirmed-block");
const styleCardListEl = document.getElementById("style-card-list");
const candidateGridEl = document.getElementById("candidate-grid");

const CATEGORY_LABEL = { character: "캐릭터", style: "시각 스타일", scene: "장면 규칙", rule: "표현 규칙" };

async function fetchProjectDetail() {
  const res = await fetch(`${API}/projects/${currentProject.id}`);
  const data = await res.json();
  currentPreset = data.preset;
  renderPresetBuilder(data);
}

function renderPresetBuilder(data) {
  const { preset, cards, candidates } = data;

  if (preset.status === "confirmed") {
    step1Block.hidden = true;
    step2Block.hidden = true;
    step3Block.hidden = true;
    confirmedBlock.hidden = false;
    document.getElementById("confirmed-image").src = preset.confirmed_image_url;
    // 프리셋이 이미 확정된 프로젝트라면, Preset Builder를 다시 보여줄 필요 없이
    // 바로 Session Studio로 진입시킨다 (breadcrumb의 "Preset Builder" 버튼으로 언제든 되돌아올 수 있음).
    showSessionListView();
    return;
  }

  confirmedBlock.hidden = true;
  step1Block.hidden = false;
  document.getElementById("reference-note").value = preset.reference_note || "";

  if (preset.status === "building" || cards.length > 0) {
    step2Block.hidden = false;
    renderStyleCards(cards);
    step3Block.hidden = false;
    renderCandidates(candidates);
  } else {
    step2Block.hidden = true;
    step3Block.hidden = true;
  }
}

function renderStyleCards(cards) {
  styleCardListEl.innerHTML = cards.length
    ? cards.map((c) => `
        <li data-id="${c.id}">
          <input type="checkbox" ${c.selected ? "checked" : ""} class="card-toggle" />
          <span class="cat-badge">${CATEGORY_LABEL[c.category] || c.category}</span>
          <span>${c.content}</span>
          <span class="card-actions"><button class="delete-card" title="삭제">✕</button></span>
        </li>
      `).join("")
    : `<p class="muted">아직 스타일 카드가 없습니다.</p>`;
}

function renderCandidates(candidates) {
  candidateGridEl.innerHTML = candidates.map((c) => `
    <div class="candidate-card ${c.selected ? "selected" : ""}" data-id="${c.id}">
      <img src="${c.image_url}" alt="대표 이미지 안" />
      <div class="pick-label">${c.selected ? "선택됨" : "이 안으로 확정"}</div>
    </div>
  `).join("");
}

document.getElementById("suggest-btn").addEventListener("click", async () => {
  const note = document.getElementById("reference-note").value;
  const res = await fetch(`${API}/presets/${currentPreset.id}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_note: note }),
  });
  const data = await res.json();
  if (res.ok) {
    step2Block.hidden = false;
    step3Block.hidden = false;
    renderStyleCards(data.cards);
    renderCandidates([]);
  }
});

styleCardListEl.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("card-toggle")) return;
  const li = e.target.closest("li");
  await fetch(`${API}/style-cards/${li.dataset.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected: e.target.checked }),
  });
});

styleCardListEl.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-card")) return;
  const li = e.target.closest("li");
  await fetch(`${API}/style-cards/${li.dataset.id}`, { method: "DELETE" });
  li.remove();
});

document.getElementById("add-card-btn").addEventListener("click", async () => {
  const category = document.getElementById("new-card-category").value;
  const contentInput = document.getElementById("new-card-content");
  const content = contentInput.value.trim();
  if (!content) return;
  const res = await fetch(`${API}/presets/${currentPreset.id}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, content }),
  });
  if (res.ok) {
    contentInput.value = "";
    fetchProjectDetail();
  }
});

document.getElementById("generate-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/presets/${currentPreset.id}/generate`, { method: "POST" });
  const data = await res.json();
  if (res.ok) renderCandidates(data.candidates);
  else alert(data.error);
});

candidateGridEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".candidate-card");
  if (!card) return;
  if (!confirm("이 대표 이미지로 프리셋을 확정할까요? 확정 후에는 이 화면으로 못 돌아옵니다.")) return;
  const res = await fetch(`${API}/presets/${currentPreset.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: Number(card.dataset.id) }),
  });
  if (res.ok) fetchProjectDetail();
});

// ---------- Session Studio ----------

const sessionListEl = document.getElementById("session-list");
const newSessionForm = document.getElementById("new-session-form");
const comicVariantListEl = document.getElementById("comic-variant-list");
const completedOutputsBlock = document.getElementById("completed-outputs-block");
const completedOutputsListEl = document.getElementById("completed-outputs-list");

async function fetchSessions() {
  const res = await fetch(`${API}/projects/${currentProject.id}/sessions`);
  const rows = await res.json();
  sessionListEl.innerHTML = rows.length
    ? rows.map((s) => `
        <li class="card-item" data-id="${s.id}">
          <span class="name">${s.name}</span>
          <span class="meta">${s.status === "completed" ? "완성" : "작성중"} · ${s.cut_count}컷</span>
        </li>
      `).join("")
    : `<p class="muted">아직 세션이 없습니다. "+ 새 세션"으로 시작하세요.</p>`;
}

// 소재를 처음부터 문장으로 쓰는 게 부담스럽다는 사용자 피드백(2026-08-16)으로 추가 —
// 완전한 예시 5개를 미리 써두고 클릭 한 번으로 채워 넣게 한다. 고른 뒤에도 직접 수정 가능.
// 다른 주제로 확장하고 싶으면 이 배열에 항목을 추가하면 됨.
const SESSION_TEMPLATES = [
  {
    label: "① 기본 공감형",
    hint: "감정이 서서히 바뀌는 흐름",
    text: "갱년기가 시작되며 몸이 예전 같지 않다고 느낀 엄마. 계단만 올라가도 숨이 차고 무릎이 시큰거렸다. 딸이 권한 운동을 처음엔 손사래치며 거절했다. 마지못해 트레이너와 첫 수업을 시작했다. 호흡법부터 차근차근 배우며 몸이 조금씩 달라지는 걸 느꼈다. 3주 후 계단을 오를 때 숨이 덜 찼다. 한 달 후엔 아침에 일어나는 게 한결 가벼워졌다. 이제는 스스로 운동 시간을 기다리게 됐다.",
  },
  {
    label: "② 거부→전환형",
    hint: "처음엔 싫다더니 바뀌는 이야기",
    text: "운동은 젊을 때나 하는 거라며 손사래치던 엄마. 딸의 성화에 못 이겨 억지로 첫 수업에 나갔다. 낯선 동작에 몸이 뻣뻣하게 굳었다. 트레이너가 \"천천히, 숨부터\"라고 다독였다. 두 번째 수업부터는 조금씩 따라 할 만해졌다. 몇 주가 지나자 앉았다 일어날 때 무릎이 편해졌다. 잠도 예전보다 푹 잘 수 있게 됐다. \"진작 할 걸 그랬다\"고 웃으며 말했다.",
  },
  {
    label: "③ 증상 중심형",
    hint: "무릎 통증 극복 서사",
    text: "몇 년째 무릎이 시큰거려 계단을 피해 다니던 엄마. 병원에서도 뾰족한 답을 못 들었다. 지인 소개로 시니어 전문 트레이너를 만났다. 무릎 대신 코어와 호흡부터 안정시키는 훈련을 시작했다. 처음엔 반신반의했지만 통증이 조금씩 줄어들었다. 두 달째, 계단을 오를 때 붙잡던 손잡이를 놓을 수 있었다. 이제는 동네를 산책하는 게 즐거워졌다. 무릎보다 마음이 먼저 가벼워진 느낌이라고 했다.",
  },
  {
    label: "④ 유머형",
    hint: "가볍고 웃긴 톤",
    text: "\"이 나이에 무슨 운동이냐\"며 딸에게 큰소리쳤던 엄마. 정작 화장실 갈 때마다 무릎에서 나는 소리가 신경 쓰였다. 결국 몰래 트레이너 수업을 예약했다. 첫날 숨이 턱까지 차서 딸에게 등짝을 맞았다고 놀렸다. 그래도 다음 날 또 나갔다. 한 달쯤 지나자 몸이 가벼워졌다며 딸 앞에서 괜히 으스댔다. \"내가 너보다 유연하다\"고 큰소리치기 시작했다. 요즘은 먼저 운동 가자고 딸을 재촉한다.",
  },
  {
    label: "⑤ 트레이너 시점형",
    hint: "전문성 강조, 실제 계정 톤과 가장 비슷",
    text: "평생 운동을 해보신 적 없는 어르신이었습니다. 무릎 통증으로 앉았다 일어나는 것조차 힘들어했다. 트레이너는 근력보다 호흡과 힘 전달 순서 인지에 먼저 집중했다. 배→엉덩이→다리 순서로 힘이 전달되는 감각을 매 수업마다 반복했다. 처음 몇 주는 동작 하나하나가 낯설고 어려웠다. 한 달이 지나자 회원은 평생 없던 엉덩이가 생겼다며 웃었다. 자세가 자연스럽게 교정되며 무릎 통증도 줄었다. 이 케이스는 시니어 트레이닝의 좋은 예로 남았다.",
  },
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

document.getElementById("new-session-btn").addEventListener("click", () => {
  newSessionForm.hidden = !newSessionForm.hidden;
});

document.getElementById("create-session-btn").addEventListener("click", async () => {
  const name = document.getElementById("session-name").value.trim();
  const materialText = document.getElementById("session-material").value.trim();
  const cutCount = document.getElementById("session-cut-count").value;
  if (!name || !materialText) { alert("세션 이름과 소재를 입력하세요."); return; }
  const res = await fetch(`${API}/projects/${currentProject.id}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, material_text: materialText, cut_count: cutCount }),
  });
  if (res.ok) {
    document.getElementById("session-name").value = "";
    document.getElementById("session-material").value = "";
    newSessionForm.hidden = true;
    fetchSessions();
  }
});

sessionListEl.addEventListener("click", async (e) => {
  const item = e.target.closest(".card-item");
  if (!item) return;
  await openSession(item.dataset.id);
});

async function openSession(sessionId) {
  const res = await fetch(`${API}/sessions/${sessionId}`);
  const data = await res.json();
  currentSession = data.session;
  showSessionDetailView();
  document.getElementById("session-detail-title").textContent = `Session: ${currentSession.name}`;
  comicVariantListEl.innerHTML = "";
  document.getElementById("edit-note").value = "";
  renderCompletedOutputs(data.outputs);
}

function renderCompletedOutputs(outputs) {
  if (!outputs.length) {
    completedOutputsBlock.hidden = true;
    return;
  }
  completedOutputsBlock.hidden = false;
  completedOutputsListEl.innerHTML = outputs.map((o) => `
    <div class="completed-version">
      <h4>버전 ${o.version_no}</h4>
      <div class="cut-strip">
        ${o.cuts.map((c) => `<div class="cut-item"><img src="${c.image_url}" alt="컷 ${c.index}" /><p>${c.caption}</p></div>`).join("")}
      </div>
      <button class="ghost-btn edit-output-btn" data-id="${o.id}">컷 편집</button>
      <button class="ghost-btn continue-btn" data-id="${o.session_id}">이 흐름으로 후속편 만들기</button>
    </div>
  `).join("");
}

function renderVariants(candidates) {
  comicVariantListEl.innerHTML = candidates.map((v) => `
    <div class="variant-block" data-variant="${v.variant}">
      <div class="variant-header">
        <h4>안 ${v.variant + 1} (${v.tone})</h4>
        <button class="primary-btn complete-variant-btn" data-variant="${v.variant}">이 안으로 완료</button>
      </div>
      <div class="cut-strip">
        ${v.cuts.map((c) => `<div class="cut-item"><img src="${c.image_url}" alt="컷 ${c.index}" /><p>${c.caption}</p></div>`).join("")}
      </div>
    </div>
  `).join("");
  comicVariantListEl.dataset.candidates = JSON.stringify(candidates);
}

document.getElementById("session-generate-btn").addEventListener("click", async () => {
  const res = await fetch(`${API}/sessions/${currentSession.id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (res.ok) renderVariants(data.candidates);
});

document.getElementById("session-regenerate-btn").addEventListener("click", async () => {
  const editNote = document.getElementById("edit-note").value.trim();
  const res = await fetch(`${API}/sessions/${currentSession.id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edit_note: editNote }),
  });
  const data = await res.json();
  if (res.ok) renderVariants(data.candidates);
});

comicVariantListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest(".complete-variant-btn");
  if (!btn) return;
  const candidates = JSON.parse(comicVariantListEl.dataset.candidates || "[]");
  const chosen = candidates.find((c) => String(c.variant) === btn.dataset.variant);
  if (!chosen) return;
  if (!confirm(`안 ${chosen.variant + 1}을 완성본으로 저장할까요?`)) return;
  const res = await fetch(`${API}/sessions/${currentSession.id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuts: chosen.cuts }),
  });
  if (res.ok) {
    alert("완성본으로 저장했습니다.");
    showSessionListView();
  }
});

completedOutputsListEl.addEventListener("click", async (e) => {
  const continueBtn = e.target.closest(".continue-btn");
  if (continueBtn) {
    const res = await fetch(`${API}/sessions/${continueBtn.dataset.id}/continue`, { method: "POST" });
    if (res.ok) {
      const newSession = await res.json();
      alert(`후속편 세션 "${newSession.name}"이 생성됐습니다. 세션 목록에서 확인하세요.`);
      showSessionListView();
    }
    return;
  }
  const editBtn = e.target.closest(".edit-output-btn");
  if (editBtn) {
    await openComicEditor(editBtn.dataset.id);
  }
});

// ---------- Comic Editor ----------

let editingCuts = [];
let editingSessionId = null;
let editingSourceVersion = null;
let editingOutputId = null;

const editorCutListEl = document.getElementById("editor-cut-list");

async function openComicEditor(outputId) {
  const res = await fetch(`${API}/outputs/${outputId}`);
  const data = await res.json();
  editingCuts = data.cuts.map((c) => ({ ...c }));
  editingSessionId = data.session_id;
  editingSourceVersion = data.version_no;
  editingOutputId = data.id;
  document.getElementById("editor-title").textContent = `Comic Editor — 버전 ${editingSourceVersion} 수정 중`;
  showComicEditorView();
  renderEditorCuts();
}

function renderEditorCuts() {
  editorCutListEl.innerHTML = editingCuts.map((c, i) => `
    <div class="editor-cut-card" data-pos="${i}">
      <img src="${c.image_url}" alt="컷 ${i + 1}" />
      <div class="editor-cut-body">
        <div class="editor-cut-label">컷 ${i + 1}</div>
        <textarea class="editor-cut-caption" rows="2">${c.caption}</textarea>
        <div class="editor-cut-actions">
          <button class="ghost-btn move-up-btn" ${i === 0 ? "disabled" : ""}>▲</button>
          <button class="ghost-btn move-down-btn" ${i === editingCuts.length - 1 ? "disabled" : ""}>▼</button>
          <button class="ghost-btn regenerate-cut-btn">재생성</button>
          <button class="ghost-btn delete-cut-btn">삭제</button>
        </div>
      </div>
    </div>
  `).join("");
}

editorCutListEl.addEventListener("change", (e) => {
  if (!e.target.classList.contains("editor-cut-caption")) return;
  const pos = Number(e.target.closest(".editor-cut-card").dataset.pos);
  editingCuts[pos].caption = e.target.value;
});

editorCutListEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".editor-cut-card");
  if (!card) return;
  const pos = Number(card.dataset.pos);

  if (e.target.classList.contains("move-up-btn") && pos > 0) {
    [editingCuts[pos - 1], editingCuts[pos]] = [editingCuts[pos], editingCuts[pos - 1]];
    renderEditorCuts();
  } else if (e.target.classList.contains("move-down-btn") && pos < editingCuts.length - 1) {
    [editingCuts[pos], editingCuts[pos + 1]] = [editingCuts[pos + 1], editingCuts[pos]];
    renderEditorCuts();
  } else if (e.target.classList.contains("delete-cut-btn")) {
    if (editingCuts.length <= 1) { alert("최소 1개 컷은 남아있어야 합니다."); return; }
    editingCuts.splice(pos, 1);
    renderEditorCuts();
  } else if (e.target.classList.contains("regenerate-cut-btn")) {
    const editNote = prompt("이 컷을 어떻게 바꿀까요? (예: 대사를 더 다정하게)") || "";
    const res = await fetch(`${API}/outputs/${editingOutputId}/regenerate-cut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cut_index: pos + 1, edit_note: editNote }),
    });
    if (res.ok) {
      const data = await res.json();
      editingCuts[pos] = { ...data.cut, index: pos + 1 };
      renderEditorCuts();
    }
  }
});

document.getElementById("editor-add-cut-btn").addEventListener("click", () => {
  editingCuts.push({ index: editingCuts.length + 1, caption: "새 컷 — 내용을 입력하세요", tone: "새 컷", image_url: editingCuts[0]?.image_url || "" });
  renderEditorCuts();
});

document.getElementById("editor-save-btn").addEventListener("click", async () => {
  const renumbered = editingCuts.map((c, i) => ({ ...c, index: i + 1 }));
  const res = await fetch(`${API}/sessions/${editingSessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuts: renumbered }),
  });
  if (res.ok) {
    alert("새 버전으로 저장했습니다.");
    await openSession(editingSessionId);
  }
});

document.getElementById("editor-back-btn").addEventListener("click", async () => {
  await openSession(editingSessionId);
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
          <h3>${g.root_name}</h3>
          ${g.items.map((item) => `
            <div class="archive-item">
              <div class="archive-item-header">
                <span class="episode-badge">${item.episode_no}화</span>
                <span class="meta">${item.session_name} · 버전 ${item.version_no} · ${new Date(item.created_at).toLocaleString("ko-KR")}</span>
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

showWorkspaceView();
