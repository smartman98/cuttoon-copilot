// 실제 이미지 분석 API(해커톤 제공 크레딧)가 아직 없어서, "레퍼런스 설명 텍스트"를 받아
// 그럴듯한 스타일 특징을 제안하는 규칙 기반 스텁이다. 나중에 실제 비전 API로 이 함수 하나만
// 교체하면 나머지 흐름(선택/누적/생성/확정)은 그대로 재사용된다.
//
// 2026-08-16, 사용자가 실제 계정(@kriee_official, KRIEE-SPT 노인운동전문가)의 인스타그램
// 스크린샷 두 장을 공유해서, 그 관찰을 반영해 제안 내용을 실측 기반으로 바꿈:
// - "갱년기 엄마 1편/2편"처럼 회차(1편/2편)로 이어지는 연재 구조
// - 카카오톡 채팅 목업 컷(트레이너-회원 대화체로 공감 포인트 전달)
// - 굵은 산세리프 큰 글씨 + 노란/빨간 강조 박스, 도발적 질문형 타이틀
//   ("잘 모르지만 감으로 하시나요?")
// - 실제 어르신 사진/나이 강조 문구("그녀의 나이는 104살입니다")로 신뢰 확보
// - 계정에 이미 토끼 마스코트 캐릭터로 보이는 자산이 있어 보임 — 재사용 여부는 확인 필요.
function suggestStyleCards(referenceNote) {
  const note = (referenceNote || "").trim();
  return [
    { category: "character", content: note ? `${note}에서 느껴지는 주인공 캐릭터 (기존 KRIEE 토끼 마스코트 재사용 여부 확인 필요)` : "기존 KRIEE 토끼 마스코트 재사용 여부 확인 필요 — 없으면 시니어 회원을 닮은 친근한 사람 캐릭터" },
    { category: "character", content: "트레이너 캐릭터(밝고 다정한 표정, 존댓말 말투)" },
    { category: "style", content: "굵은 산세리프 큰 글씨 + 노란/빨간 강조 박스 (계정 실측 스타일)" },
    { category: "style", content: "말풍선: 카카오톡 채팅 목업 톤 (트레이너-회원 대화체)" },
    { category: "scene", content: "회차 구조(1편/2편 등 연재) — 갱년기/무릎통증 등 증상 공감으로 시작" },
    { category: "scene", content: "도발적 질문형 타이틀 컷 (예: '잘 모르지만 감으로 하시나요?')" },
    { category: "rule", content: "과도한 신체 노출/선정적 표현 금지" },
    { category: "rule", content: "실제 회원 나이/후기를 강조해 신뢰 구축 (예: '그녀의 나이는 104살입니다') — 컷툰 캐릭터와 혼동되지 않게 분리" },
  ];
}

// 대표 이미지 3안 — 실제 이미지 생성 API가 붙기 전까지는, 확정된 스타일 카드 요약을 담은
// SVG 플레이스홀더를 만들어서 "버전이 다른 안"이라는 느낌만 낸다(색상만 다르게 3장).
function buildPlaceholderImage(seedIndex, summaryText) {
  const palettes = ["#f2a93b", "#2a78d6", "#1baf7a"];
  const color = palettes[seedIndex % palettes.length];
  const safeText = summaryText.length > 40 ? summaryText.slice(0, 40) + "…" : summaryText;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="16" fill="${color}" opacity="0.15" />
      <rect x="8" y="8" width="304" height="304" rx="12" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,6" />
      <text x="160" y="140" text-anchor="middle" font-size="16" font-weight="700" fill="#333">AI 생성 이미지</text>
      <text x="160" y="164" text-anchor="middle" font-size="12" fill="#666">(프리뷰 — 실제 API 연결 전)</text>
      <text x="160" y="200" text-anchor="middle" font-size="11" fill="#444">안 ${seedIndex + 1}</text>
      <foreignObject x="24" y="220" width="272" height="80">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px; color:#555; text-align:center; font-family:sans-serif;">${safeText}</div>
      </foreignObject>
    </svg>
  `.trim();
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
}

module.exports = { suggestStyleCards, buildPlaceholderImage };
