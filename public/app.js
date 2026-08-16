const API = "/api";

let currentWorkspace = null;
let currentProject = null;
let currentPreset = null;

const breadcrumbEl = document.getElementById("breadcrumb");
const workspaceView = document.getElementById("workspace-view");
const projectView = document.getElementById("project-view");
const presetView = document.getElementById("preset-view");

const workspaceListEl = document.getElementById("workspace-list");
const projectListEl = document.getElementById("project-list");

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
    parts.push(`<span>Preset Builder</span>`);
  }
  breadcrumbEl.innerHTML = parts.join(" ");
}

breadcrumbEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nav]");
  if (!btn) return;
  if (btn.dataset.nav === "workspace") {
    currentProject = null;
    currentPreset = null;
    showWorkspaceView();
  } else if (btn.dataset.nav === "project") {
    currentPreset = null;
    showProjectView();
  }
});

function showWorkspaceView() {
  workspaceView.hidden = false;
  projectView.hidden = true;
  presetView.hidden = true;
  renderBreadcrumb();
  fetchWorkspaces();
}

function showProjectView() {
  workspaceView.hidden = true;
  projectView.hidden = false;
  presetView.hidden = true;
  renderBreadcrumb();
  fetchProjects();
}

function showPresetView() {
  workspaceView.hidden = true;
  projectView.hidden = true;
  presetView.hidden = false;
  renderBreadcrumb();
  fetchProjectDetail();
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

showWorkspaceView();
