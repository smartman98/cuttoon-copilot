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
    const detailRes = await fetch(`${API}/sessions/${currentSession.id}`);
    const data = await detailRes.json();
    renderCompletedOutputs(data.outputs);
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
