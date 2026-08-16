// 실제 이미지 분석 API(해커톤 제공 크레딧)가 아직 없어서, "레퍼런스 설명 텍스트"를 받아
// 그럴듯한 스타일 특징을 제안하는 규칙 기반 스텁이다. 나중에 실제 비전 API로 이 함수 하나만
// 교체하면 나머지 흐름(선택/누적/생성/확정)은 그대로 재사용된다.
function suggestStyleCards(referenceNote) {
  const note = (referenceNote || "").trim();
  return [
    { category: "character", content: note ? `${note}에서 느껴지는 주인공 캐릭터 (귀여운 동물/사람 중 택1 추정)` : "동물 또는 사람 캐릭터, 단순화된 얼굴 비율" },
    { category: "character", content: "과장된 표정 3종(기본/놀람/미소)" },
    { category: "style", content: "굵은 외곽선 + 파스텔톤 배경" },
    { category: "style", content: "말풍선: 둥근 사각형, 손글씨체" },
    { category: "scene", content: "배경 밀도 낮음 (인물 중심 구도)" },
    { category: "rule", content: "과도한 신체 노출/선정적 표현 금지" },
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
