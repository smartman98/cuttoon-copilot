const path = require("path");
const express = require("express");
const db = require("./db");
const { suggestStyleCards, buildPlaceholderImage } = require("./suggest");
const { generateComicCandidates } = require("./comic");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Workspace ----------

app.get("/api/workspaces", (req, res) => {
  const rows = db.prepare("SELECT * FROM workspaces ORDER BY created_at DESC").all();
  res.json(rows);
});

app.post("/api/workspaces", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "이름이 필요합니다." });
  const info = db.prepare("INSERT INTO workspaces (name) VALUES (?)").run(name);
  const row = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// ---------- Project (+ Preset 자동 생성) ----------

app.get("/api/workspaces/:id/projects", (req, res) => {
  const rows = db.prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

app.post("/api/workspaces/:id/projects", (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "이름이 필요합니다." });
  const info = db.prepare("INSERT INTO projects (workspace_id, name) VALUES (?, ?)").run(req.params.id, name);
  const projectId = info.lastInsertRowid;
  db.prepare("INSERT INTO presets (project_id, status) VALUES (?, 'draft')").run(projectId);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  res.status(201).json(row);
});

// 프로젝트 상세 = 프리셋 + 스타일카드 + 대표이미지 후보까지 한 번에
app.get("/api/projects/:id", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
  const preset = db.prepare("SELECT * FROM presets WHERE project_id = ?").get(req.params.id);
  const cards = preset
    ? db.prepare("SELECT * FROM style_cards WHERE preset_id = ? ORDER BY sort_order, id").all(preset.id)
    : [];
  const candidates = preset
    ? db.prepare("SELECT * FROM preset_candidates WHERE preset_id = ? ORDER BY id").all(preset.id)
    : [];
  res.json({ project, preset, cards, candidates });
});

// ---------- Preset Builder ----------

// 1단계: 추출 및 제안 — 레퍼런스 설명을 받아 스타일 카드 제안을 만들어 누적한다(선택 상태로).
app.post("/api/presets/:id/suggest", (req, res) => {
  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  if (!preset) return res.status(404).json({ error: "프리셋을 찾을 수 없습니다." });
  const note = String(req.body.reference_note || "").trim();

  db.prepare("UPDATE presets SET reference_note = ?, status = 'building' WHERE id = ?").run(note, preset.id);

  const suggestions = suggestStyleCards(note);
  const insert = db.prepare(
    "INSERT INTO style_cards (preset_id, category, content, selected, sort_order) VALUES (?, ?, ?, 1, ?)"
  );
  suggestions.forEach((s, i) => insert.run(preset.id, s.category, s.content, i));

  const cards = db.prepare("SELECT * FROM style_cards WHERE preset_id = ? ORDER BY sort_order, id").all(preset.id);
  res.json({ cards });
});

// 2단계: 선택 및 누적 — 카드 추가(직접 입력) / 토글(선택 해제) / 삭제
app.post("/api/presets/:id/cards", (req, res) => {
  const category = String(req.body.category || "rule");
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "내용이 필요합니다." });
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM style_cards WHERE preset_id = ?").get(req.params.id).m;
  const info = db.prepare(
    "INSERT INTO style_cards (preset_id, category, content, selected, sort_order) VALUES (?, ?, ?, 1, ?)"
  ).run(req.params.id, category, content, maxOrder + 1);
  const row = db.prepare("SELECT * FROM style_cards WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.patch("/api/style-cards/:id", (req, res) => {
  const card = db.prepare("SELECT * FROM style_cards WHERE id = ?").get(req.params.id);
  if (!card) return res.status(404).json({ error: "카드를 찾을 수 없습니다." });
  const selected = req.body.selected ? 1 : 0;
  db.prepare("UPDATE style_cards SET selected = ? WHERE id = ?").run(selected, req.params.id);
  res.json({ ...card, selected });
});

app.delete("/api/style-cards/:id", (req, res) => {
  db.prepare("DELETE FROM style_cards WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// 3단계: 생성 및 확정 — 선택된 카드들을 요약해서 대표 이미지 3안(플레이스홀더) 생성
app.post("/api/presets/:id/generate", (req, res) => {
  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  if (!preset) return res.status(404).json({ error: "프리셋을 찾을 수 없습니다." });
  const selectedCards = db.prepare("SELECT * FROM style_cards WHERE preset_id = ? AND selected = 1 ORDER BY sort_order").all(preset.id);
  if (selectedCards.length === 0) return res.status(400).json({ error: "선택된 스타일 카드가 없습니다." });

  db.prepare("DELETE FROM preset_candidates WHERE preset_id = ?").run(preset.id);
  const summary = selectedCards.map((c) => c.content).join(", ");
  const insert = db.prepare("INSERT INTO preset_candidates (preset_id, image_url) VALUES (?, ?)");
  const candidates = [];
  for (let i = 0; i < 3; i++) {
    const imageUrl = buildPlaceholderImage(i, summary);
    const info = insert.run(preset.id, imageUrl);
    candidates.push({ id: info.lastInsertRowid, preset_id: preset.id, image_url: imageUrl, selected: 0 });
  }
  res.json({ candidates });
});

// 최종안 선택 -> 프리셋 확정
app.post("/api/presets/:id/confirm", (req, res) => {
  const candidateId = req.body.candidate_id;
  const candidate = db.prepare("SELECT * FROM preset_candidates WHERE id = ? AND preset_id = ?").get(candidateId, req.params.id);
  if (!candidate) return res.status(404).json({ error: "선택한 후보를 찾을 수 없습니다." });

  db.prepare("UPDATE preset_candidates SET selected = 0 WHERE preset_id = ?").run(req.params.id);
  db.prepare("UPDATE preset_candidates SET selected = 1 WHERE id = ?").run(candidateId);
  db.prepare("UPDATE presets SET status = 'confirmed', confirmed_image_url = ? WHERE id = ?").run(candidate.image_url, req.params.id);

  const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(req.params.id);
  res.json(preset);
});

// ---------- Session Studio ----------

function _presetStyleSummary(projectId) {
  const preset = db.prepare("SELECT * FROM presets WHERE project_id = ?").get(projectId);
  if (!preset) return "";
  const cards = db.prepare("SELECT * FROM style_cards WHERE preset_id = ? AND selected = 1").all(preset.id);
  return cards.map((c) => c.content).join(", ");
}

app.get("/api/projects/:id/sessions", (req, res) => {
  const rows = db.prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

app.post("/api/projects/:id/sessions", (req, res) => {
  const name = String(req.body.name || "").trim();
  const materialText = String(req.body.material_text || "").trim();
  const cutCount = Number(req.body.cut_count) || 4;
  if (!name || !materialText) return res.status(400).json({ error: "세션 이름과 소재 내용이 필요합니다." });
  const info = db.prepare(
    "INSERT INTO sessions (project_id, name, material_text, cut_count, status) VALUES (?, ?, ?, ?, 'draft')"
  ).run(req.params.id, name, materialText, cutCount);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get("/api/sessions/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const outputs = db.prepare("SELECT * FROM comic_outputs WHERE session_id = ? ORDER BY version_no").all(session.id);
  res.json({
    session,
    outputs: outputs.map((o) => ({ ...o, cuts: JSON.parse(o.cuts_json) })),
  });
});

// 3안 생성 — 저장은 안 하고 미리보기만 돌려준다(완료를 눌러야 comic_outputs에 저장됨).
app.post("/api/sessions/:id/generate", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const editNote = String(req.body.edit_note || "").trim();
  const presetSummary = _presetStyleSummary(session.project_id);
  const candidates = generateComicCandidates(session.material_text, session.cut_count, editNote, presetSummary);
  res.json({ candidates });
});

// 완료 — 선택한 안을 세션 내 다음 버전 번호로 저장
app.post("/api/sessions/:id/complete", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const cuts = req.body.cuts;
  if (!Array.isArray(cuts) || cuts.length === 0) return res.status(400).json({ error: "저장할 컷 데이터가 없습니다." });

  const maxVersion = db.prepare("SELECT COALESCE(MAX(version_no), 0) AS m FROM comic_outputs WHERE session_id = ?").get(session.id).m;
  const info = db.prepare(
    "INSERT INTO comic_outputs (session_id, version_no, cuts_json) VALUES (?, ?, ?)"
  ).run(session.id, maxVersion + 1, JSON.stringify(cuts));
  db.prepare("UPDATE sessions SET status = 'completed' WHERE id = ?").run(session.id);

  const output = db.prepare("SELECT * FROM comic_outputs WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ ...output, cuts: JSON.parse(output.cuts_json) });
});

// 연재 확장 — 완성본을 이어받는 새 세션(예: "... - 2편")을 만든다
app.post("/api/sessions/:id/continue", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  const newName = `${session.name} - 후속편`;
  const newMaterial = `(이전 세션 "${session.name}"에서 이어짐) ${session.material_text}`;
  const info = db.prepare(
    "INSERT INTO sessions (project_id, name, material_text, cut_count, status) VALUES (?, ?, ?, ?, 'draft')"
  ).run(session.project_id, newName, newMaterial, session.cut_count);
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`컷툰 코파일럿 실행 중: http://localhost:${PORT}`);
});
