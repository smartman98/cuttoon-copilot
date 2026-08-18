// Preset 자동분석 스텁 — 팀 설계 브리프 v0.5 기준(2026-08-16): 체크박스로 카드 고르는 단계
// 없이, "레퍼런스 설명 → 자동분석 → 캐릭터 시트 1개" 로 바로 간다. 확정 아니면 다시 뽑기만.
// 실제 비전 API(Gemini)가 붙기 전까지 이 함수만 교체하면 나머지 흐름은 그대로 재사용된다.
//
// 타협 불가 항목(브리프 "타협 불가" 절): 등장인물 1~2명, 배경 단순화 — 시트에도 명시해서
// 화면에서 사용자가 이 제약을 볼 수 있게 한다.
function analyzeReference(referenceNote) {
  const note = (referenceNote || "").trim();
  return {
    character: note
      ? `${note}에서 느껴지는 주인공 1명 (기존 KRIEE 마스코트 재사용 여부 확인 필요)`
      : "친근한 사람 캐릭터 1명 (등장인물은 1~2명으로 고정)",
    style: "굵은 산세리프 큰 글씨 + 노란/빨간 강조 박스, 단순한 배경",
    scene: "배경 밀도 낮음 — 컷마다 튀지 않도록 소품 최소화",
    rule: "과도한 신체 노출/선정적 표현 금지",
  };
}

// 캐릭터 시트 대표 이미지 — 실제 API 연결 전까지 회색 플레이스홀더 1장.
// (기존엔 3안이었지만, 새 흐름에서는 "다시 뽑기"로 매번 1장만 새로 뽑는다.)
function buildCharacterSheetImage(seed, summaryText) {
  const color = "#f2a93b";
  const safeText = summaryText.length > 60 ? summaryText.slice(0, 60) + "…" : summaryText;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="16" fill="${color}" opacity="0.15" />
      <rect x="8" y="8" width="304" height="304" rx="12" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,6" />
      <text x="160" y="140" text-anchor="middle" font-size="16" font-weight="700" fill="#333">캐릭터 시트</text>
      <text x="160" y="164" text-anchor="middle" font-size="12" fill="#666">(프리뷰 — 실제 API 연결 전)</text>
      <text x="160" y="200" text-anchor="middle" font-size="11" fill="#444">시도 #${seed}</text>
      <foreignObject x="24" y="220" width="272" height="80">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px; color:#555; text-align:center; font-family:sans-serif;">${safeText}</div>
      </foreignObject>
    </svg>
  `.trim();
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
}

module.exports = { analyzeReference, buildCharacterSheetImage };
