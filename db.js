// Node 22+ 내장 모듈 — better-sqlite3는 네이티브 빌드(Visual Studio) 필요해서 이 PC에서
// 설치가 안 됐음(2026-08-16 확인). node:sqlite는 빌드 없이 바로 동작해서 이걸로 대체.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true }); // 배포 환경에 data/ 폴더가 없을 수 있어 방어적으로 생성
const db = new DatabaseSync(path.join(dataDir, "cuttoon.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 프로젝트당 프리셋 하나(MVP 범위) — 추출/누적/확정 3단계 상태를 status로 관리.
  CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    reference_note TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- draft(추출중) -> building(카드 누적중) -> confirmed(확정)
    confirmed_image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 스타일 카드: 특징 제안/직접 추가 둘 다 여기 쌓인다. category: character/style/scene/rule
  CREATE TABLE IF NOT EXISTS style_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL REFERENCES presets(id),
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    selected INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 대표 이미지 3안 — 확정 단계에서 생성되고, 하나를 selected로 고르면 preset.confirmed_image_url에 반영.
  CREATE TABLE IF NOT EXISTS preset_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL REFERENCES presets(id),
    image_url TEXT NOT NULL,
    selected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Session Studio/Comic Editor는 2차 해커톤 범위 — 스키마만 미리 잡아둔다.
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    material_text TEXT,
    cut_count INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    parent_session_id INTEGER REFERENCES sessions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comic_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    version_no INTEGER NOT NULL,
    cuts_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// sessions 테이블이 parent_session_id 없이 이미 만들어져 있던 경우(2026-08-16 이전 DB 파일)
// 대비 — 연재 시작점을 추적하려면 이 컬럼이 필요해서 뒤늦게 추가했다. 이미 있으면 조용히 무시.
try {
  db.exec("ALTER TABLE sessions ADD COLUMN parent_session_id INTEGER REFERENCES sessions(id)");
} catch (err) {
  if (!/duplicate column/i.test(err.message)) throw err;
}

module.exports = db;
