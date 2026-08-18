// Node 22+ 내장 모듈 — better-sqlite3는 네이티브 빌드(Visual Studio) 필요해서 이 PC에서
// 설치가 안 됐음(2026-08-16 확인). node:sqlite는 빌드 없이 바로 동작해서 이걸로 대체.
//
// v2 스키마(2026-08-16) — 팀 설계 브리프 v0.5 기준으로 전면 재설계:
// - Workspace(협업) 개념 제거 — Project가 최상위
// - Preset: 체크박스로 카드 고르기 없이 자동분석 캐릭터시트 1개 + 확정/다시뽑기만
// - Session: 3턴 빈칸채우기(템플릿/각도/CTA) → 표지컷 3안 → 고른 안으로 나머지 3컷 이어서 생성
// - 컷마다 말풍선 자리(bubble_zone)와 실제 위치(bubble_x/y, 드래그로 조정) 저장
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true }); // 배포 환경에 data/ 폴더가 없을 수 있어 방어적으로 생성
const db = new DatabaseSync(path.join(dataDir, "cuttoon.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 프로젝트당 프리셋 하나. status: empty(업로드 전) -> proposed(분석+시트 나옴, 확정 대기) -> confirmed
  CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    reference_note TEXT,
    character_sheet_json TEXT,
    draft_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'empty',
    confirmed_image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 세션 = 컷툰 한 편. status: wizard(3턴 빈칸채우기 중) -> covers(표지 3안 나옴) -> completed
  -- 컷 수는 4로 고정(타협 불가 항목) — 컬럼 자체를 안 둠.
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    material_text TEXT NOT NULL,
    template TEXT,   -- 공감형 | 정보형 | 후기형
    angle TEXT,      -- 턴2에서 고른 각도
    cta TEXT,        -- 지원유도 | 문의유도 | 팔로우
    turn INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'wizard',
    cover_variant_index INTEGER,
    parent_session_id INTEGER REFERENCES sessions(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 완성본(4컷). cuts_json: [{index, image_url, caption, bubble_zone, bubble_x, bubble_y}, ...]
  CREATE TABLE IF NOT EXISTS comic_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    version_no INTEGER NOT NULL,
    cuts_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
