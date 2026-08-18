const path = require("path");
const express = require("express");
const { ZipArchive } = require("archiver"); // v8부터 archiver('zip') 팩토리 대신 클래스 export로 바뀜
const db = require("./db");
const { analyzeReference, buildCharacterSheetImage } = require("./suggest");
const {
  CUT_COUNT,
  WIZARD_OPTIONS,
  defaultWizardValue,
  generateCoverVariants,
  continueRemainingCuts,
  regenerateCut,
} = require("./comic");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- 연쇄 삭제 헬퍼 ----------
// node:sqlite는 외래키 제약을 강제하지 않아서(PRAGMA 안 켬), 위→아래 순서로 직접 지운다.

function deleteSessionCascade(sessionId) {
  db.prepare("DELETE FROM comic_outputs WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

function deleteProjectCascade(projectId) {
  db.prepare("DELETE FROM presets WHERE project_id = ?").run(projectId);
  const sessions = db.prepare("SELECT id FROM sessions WHERE project_id = ?").all(projectId);
  for (const s of sessions) db.prepare("DELETE FROM comic_outputs WHERE session_id = ?").run(s.id);
  db.prepare("DELETE FROM sessions WHERE project_id = ?").run(projectId);
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
}

// ---------- Project (+ Preset 자동 생성) — Workspace 없이 최상위 ----------

app.get("/api/projects", (req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  res.json(rows);
});

app.post("/api/projects", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "이름이 필요합니다." });
  const info = db.prepare("INSERT INTO projects (name) VALUES (?)").run(name);
  const projectId = info.lastInsertRowid;
  db.prepare("INSERT INTO presets (project_id, status) VALUES (?, 'empty')").run(projectId);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  res.status(201).json(row);
});

app.delete("/api/projects/:id", (req, res) => {
  deleteProjectCascade(req.params.id);
  res.status(204).end();
});

// 프로젝트 상세 = 프리셋까지 한 번에
app.get("/api/projects/:id", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const preset = db.prepare("SELECT * FROM presets WHERE project_id = ?").get(req.params.id);
  res.json({ project, preset });
});

// ---------- Preset — 체크박스 없이: 업로드(설명) → 자동분석 → 확정/다시뽑기 ----------

app.post("/api/presets/:id/analyze", (req, res) => {
  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  if (!preset) return res.status(404).json({ error: "프리셋을 찾을 수 없습니다." });
  const note = String(req.body.reference_note || "").trim();

  const sheet = analyzeReference(note);
  const summary = Object.values(sheet).join(", ");
  const draftImage = buildCharacterSheetImage(1, summary);

  db.prepare(
    "UPDATE presets SET reference_note = ?, character_sheet_json = ?, draft_image_url = ?, status = 'proposed' WHERE id = ?"
  ).run(note, JSON.stringify(sheet), draftImage, preset.id);

  const row = db.prepare("SELECT * FROM presets WHERE id = ?").get(preset.id);
  res.json({ ...row, character_sheet: sheet });
});

// 다시 뽑기 — 선택지 고르기 없이 통째로 재시도(브리프: "마음에 안 들면 다시 뽑기").
app.post("/api/presets/:id/reroll", (req, res) => {
  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  if (!preset) return res.status(404).json({ error: "프리셋을 찾을 수 없습니다." });
  const sheet = analyzeReference(preset.reference_note);
  const summary = Object.values(sheet).join(", ");
  const draftImage = buildCharacterSheetImage(Math.floor(Math.random() * 1000), summary);

  db.prepare(
    "UPDATE presets SET character_sheet_json = ?, draft_image_url = ? WHERE id = ?"
  ).run(JSON.stringify(sheet), draftImage, preset.id);

  const row = db.prepare("SELECT * FROM presets WHERE id = ?").get(preset.id);
  res.json({ ...row, character_sheet: sheet });
});

app.post("/api/presets/:id/confirm", (req, res) => {
  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  if (!preset) return res.status(404).json({ error: "프리셋을 찾을 수 없습니다." });
  if (!preset.draft_image_url) return res.status(400).json({ error: "먼저 분석을 실행하세요." });
  db.prepare("UPDATE presets SET status = 'confirmed', confirmed_image_url = ? WHERE id = ?")
    .run(preset.draft_image_url, preset.id);
  const row = db.prepare("SELECT * FROM presets WHERE id = ?").get(preset.id);
  res.json(row);
});

function presetStyleSummary(projectId) {
  const preset = db.prepare("SELECT * FROM presets WHERE project_id = ?").get(projectId);
  if (!preset || !preset.character_sheet_json) return "";
  return Object.values(JSON.parse(preset.character_sheet_json)).join(", ");
}

// ---------- Session Studio — 3턴 빈칸채우기 → 표지 3안 → 이어서 4컷 ----------

app.get("/api/projects/:id/sessions", (req, res) => {
  const rows = db.prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

app.post("/api/projects/:id/sessions", (req, res) => {
  const materialText = String(req.body.material_text || "").trim();
  if (!materialText) return res.status(400).json({ error: "소재 내용이 필요합니다." });
  const info = db.prepare(
    "INSERT INTO sessions (project_id, material_text, turn, status) VALUES (?, ?, 1, 'wizard')"
  ).run(req.params.id, materialText);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.delete("/api/sessions/:id", (req, res) => {
  deleteSessionCascade(req.params.id);
  res.status(204).end();
});

app.get("/api/sessions/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const outputs = db.prepare("SELECT * FROM comic_outputs WHERE session_id = ? ORDER BY version_no").all(session.id);
  res.json({
    session,
    wizardOptions: WIZARD_OPTIONS,
    outputs: outputs.map((o) => ({ ...o, cuts: JSON.parse(o.cuts_json) })),
  });
});

// 3턴 중 하나에 답하고 다음 턴으로 — 소재에 이미 정보가 있으면 이 턴은 화면에서 안 보여줄 수도
// 있지만(브리프), 스텁에서는 항상 3턴을 보여주고 사용자가 직접 고르게 한다.
app.post("/api/sessions/:id/answer", (req, res) => {
  const { field, value } = req.body;
  if (!["template", "angle", "cta"].includes(field)) return res.status(400).json({ error: "잘못된 필드입니다." });
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const nextTurn = Math.min(session.turn + 1, 4);
  db.prepare(`UPDATE sessions SET ${field} = ?, turn = ? WHERE id = ?`).run(value, nextTurn, req.params.id);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  res.json(row);
});

// "알아서 해줘" — 남은 빈칸을 기본값으로 채우고 곧장 생성 단계로.
app.post("/api/sessions/:id/skip", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const template = session.template || defaultWizardValue("template");
  const angle = session.angle || defaultWizardValue("angle");
  const cta = session.cta || defaultWizardValue("cta");
  db.prepare("UPDATE sessions SET template = ?, angle = ?, cta = ?, turn = 4 WHERE id = ?")
    .run(template, angle, cta, req.params.id);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  res.json(row);
});

// 표지컷 3안 생성 — 저장은 안 하고 미리보기만(고른 뒤 pick-cover에서 나머지 이어서 생성+저장).
app.post("/api/sessions/:id/generate-covers", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const summary = presetStyleSummary(session.project_id);
  const template = session.template || defaultWizardValue("template");
  const angle = session.angle || defaultWizardValue("angle");
  const cta = session.cta || defaultWizardValue("cta");
  const variants = generateCoverVariants(session.material_text, template, angle, cta, summary);
  db.prepare("UPDATE sessions SET status = 'covers' WHERE id = ?").run(session.id);
  res.json({ variants });
});

// 표지 하나를 고르면, 그 톤을 이어받아 나머지 3컷까지 생성하고 완성본으로 저장.
app.post("/api/sessions/:id/pick-cover", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const { variant, tone } = req.body;
  const summary = presetStyleSummary(session.project_id);
  const cuts = continueRemainingCuts(session.material_text, variant, tone, summary);

  const info = db.prepare(
    "INSERT INTO comic_outputs (session_id, version_no, cuts_json) VALUES (?, 1, ?)"
  ).run(session.id, JSON.stringify(cuts));
  db.prepare("UPDATE sessions SET status = 'completed', cover_variant_index = ? WHERE id = ?").run(variant, session.id);

  const output = db.prepare("SELECT * FROM comic_outputs WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ ...output, cuts: JSON.parse(output.cuts_json) });
});

// 컷 편집(Comic Editor) — 완성본을 다시 고쳐서 새 버전으로 저장.
app.post("/api/sessions/:id/save-version", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const cuts = req.body.cuts;
  if (!Array.isArray(cuts) || cuts.length === 0) return res.status(400).json({ error: "저장할 컷 데이터가 없습니다." });
  const maxVersion = db.prepare("SELECT COALESCE(MAX(version_no), 0) AS m FROM comic_outputs WHERE session_id = ?").get(session.id).m;
  const info = db.prepare(
    "INSERT INTO comic_outputs (session_id, version_no, cuts_json) VALUES (?, ?, ?)"
  ).run(session.id, maxVersion + 1, JSON.stringify(cuts));
  const output = db.prepare("SELECT * FROM comic_outputs WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ ...output, cuts: JSON.parse(output.cuts_json) });
});

// 컷 하나만 다시 그리기(브리프: 후순위 기능이지만 데이터 형태는 미리 맞춰둠)
app.post("/api/sessions/:id/regenerate-cut", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const { cut_index, edit_note, source_caption } = req.body;
  const summary = presetStyleSummary(session.project_id);
  const cut = regenerateCut(cut_index, CUT_COUNT, edit_note, summary, source_caption);
  res.json({ cut });
});

// 말풍선 위치 저장(드래그 결과) — 이동만 가능, 크기/꼬리/글꼴은 자동(브리프 명시).
app.patch("/api/outputs/:id/bubble", (req, res) => {
  const output = db.prepare("SELECT * FROM comic_outputs WHERE id = ?").get(req.params.id);
  if (!output) return res.status(404).json({ error: "결과물을 찾을 수 없습니다." });
  const { cut_index, x, y } = req.body;
  const cuts = JSON.parse(output.cuts_json);
  const cut = cuts.find((c) => c.index === cut_index);
  if (!cut) return res.status(404).json({ error: "컷을 찾을 수 없습니다." });
  cut.bubble_x = x;
  cut.bubble_y = y;
  db.prepare("UPDATE comic_outputs SET cuts_json = ? WHERE id = ?").run(JSON.stringify(cuts), output.id);
  res.json({ ok: true });
});

// 연재 확장 — 완성본을 이어받는 새 세션을 만든다(브리프: 후순위 기능, 구조는 유지).
app.post("/api/sessions/:id/continue", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const newMaterial = `(이전 편에서 이어짐) ${session.material_text}`;
  const info = db.prepare(
    "INSERT INTO sessions (project_id, material_text, turn, status, parent_session_id) VALUES (?, ?, 1, 'wizard', ?)"
  ).run(session.project_id, newMaterial, session.id);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// ---------- Export & Archive ----------

function findRootSession(session, sessionMap) {
  let cur = session;
  while (cur.parent_session_id && sessionMap.has(cur.parent_session_id)) {
    cur = sessionMap.get(cur.parent_session_id);
  }
  return cur;
}

app.get("/api/projects/:id/outputs", (req, res) => {
  const sessions = db.prepare("SELECT * FROM sessions WHERE project_id = ?").all(req.params.id);
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  const outputs = db.prepare(`
    SELECT comic_outputs.*, sessions.material_text AS session_material
    FROM comic_outputs
    JOIN sessions ON sessions.id = comic_outputs.session_id
    WHERE sessions.project_id = ?
    ORDER BY comic_outputs.created_at ASC
  `).all(req.params.id);

  const groups = new Map();
  for (const o of outputs) {
    const session = sessionMap.get(o.session_id);
    const root = findRootSession(session, sessionMap);
    if (!groups.has(root.id)) {
      groups.set(root.id, { root_session_id: root.id, root_label: root.material_text.slice(0, 24), items: [] });
    }
    groups.get(root.id).items.push({
      id: o.id,
      session_id: o.session_id,
      session_label: o.session_material.slice(0, 24),
      version_no: o.version_no,
      created_at: o.created_at,
      cuts: JSON.parse(o.cuts_json),
    });
  }

  const result = [...groups.values()].map((g) => ({
    ...g,
    items: g.items.map((item, i) => ({ ...item, episode_no: i + 1 })),
  }));
  res.json(result);
});

app.get("/api/outputs/:id/download", (req, res) => {
  const output = db.prepare("SELECT * FROM comic_outputs WHERE id = ?").get(req.params.id);
  if (!output) return res.status(404).json({ error: "결과물을 찾을 수 없습니다." });
  const cuts = JSON.parse(output.cuts_json);

  res.attachment(`comic_output_v${output.version_no}.zip`);
  const archive = new ZipArchive();
  archive.on("error", (err) => res.status(500).end(String(err)));
  archive.pipe(res);

  const captionLines = [];
  cuts.forEach((cut, i) => {
    const match = /^data:image\/svg\+xml;base64,(.+)$/.exec(cut.image_url);
    if (match) {
      archive.append(Buffer.from(match[1], "base64"), { name: `cut_${String(i + 1).padStart(2, "0")}.svg` });
    }
    captionLines.push(`컷 ${i + 1}: ${cut.caption}`);
  });
  archive.append(captionLines.join("\n"), { name: "captions.txt" });
  archive.finalize();
});

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`컷툰 코파일럿 실행 중: http://localhost:${PORT}`);
});
