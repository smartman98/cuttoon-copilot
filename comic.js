// Session Studio 스텁 — 팀 설계 브리프 v0.5(2026-08-16) 기준 재작성.
// 핵심 변경: (1) 컷 수 4 고정 (2) 표지컷 3안만 먼저 만들고, 고른 안으로 나머지 3컷을
// "이어서"(같은 톤/스타일 유지) 생성 — 실제로는 같은 Gemini 대화를 이어가는 것이지만,
// 스텁에서는 "고른 variant의 톤을 그대로 이어받는다"는 것만 흉내낸다.
// 실제 API 연결 시 이 파일의 generateCoverVariants/continueRemainingCuts만 교체하면 됨.

const CUT_COUNT = 4; // 타협 불가 — 8/12컷 선택지 없음(브리프 "이 셋은 협상하지 않는다")

// 3턴 빈칸채우기 — 자유대화 대신 정해진 선택지. 아무 때나 "알아서 해줘"로 스킵 가능.
const WIZARD_OPTIONS = {
  template: ["공감형", "정보형", "후기형"],
  angle: ["갱년기 체력저하", "경력단절", "보람"],
  cta: ["지원 유도", "문의 유도", "팔로우"],
};

function defaultWizardValue(field) {
  return WIZARD_OPTIONS[field][0];
}

// 말풍선 자리 — 그림을 만들 때 미리 비워두는 구도 3종을 컷마다 순환 배정.
const BUBBLE_ZONES = ["top", "bottom", "side"];
function bubbleZoneFor(cutIndex) {
  return BUBBLE_ZONES[(cutIndex - 1) % BUBBLE_ZONES.length];
}
function defaultBubblePosition(zone) {
  if (zone === "top") return { x: 50, y: 15 };
  if (zone === "bottom") return { x: 50, y: 82 };
  return { x: 78, y: 50 }; // side
}

function splitMaterialIntoCuts(materialText, cutCount) {
  const note = (materialText || "").trim() || "소재 미입력";
  const sentences = note.split(/(?<=[.!?])\s+/).filter(Boolean);
  const cuts = [];
  for (let i = 0; i < cutCount; i++) {
    cuts.push(sentences[i % sentences.length] || note);
  }
  return cuts;
}

// 1단계: 표지컷(1번 컷)만 3가지 톤으로 생성 — 전체 4컷을 3번 만드는 것보다 생성량 절반.
function generateCoverVariants(materialText, template, angle, cta, presetSummary) {
  const cuts = splitMaterialIntoCuts(materialText, CUT_COUNT);
  const coverCaption = cuts[0];
  const tones = ["공감형(부드러운 톤)", "유머형(가벼운 톤)", "정보형(직설적 톤)"];
  return tones.map((tone, variantIndex) => ({
    variant: variantIndex,
    tone,
    cover: {
      index: 1,
      caption: coverCaption,
      bubble_zone: bubbleZoneFor(1),
      bubble_x: defaultBubblePosition(bubbleZoneFor(1)).x,
      bubble_y: defaultBubblePosition(bubbleZoneFor(1)).y,
      image_url: buildCutPlaceholder(variantIndex, 1, CUT_COUNT, presetSummary, tone),
    },
  }));
}

// 2단계: 고른 표지 안의 톤을 "이어받아" 나머지 3컷을 생성 — 표지 포함 4컷 전체를 반환.
function continueRemainingCuts(materialText, chosenVariantIndex, chosenTone, presetSummary) {
  const cuts = splitMaterialIntoCuts(materialText, CUT_COUNT);
  return cuts.map((caption, i) => {
    const cutIndex = i + 1;
    const zone = bubbleZoneFor(cutIndex);
    const pos = defaultBubblePosition(zone);
    return {
      index: cutIndex,
      caption,
      bubble_zone: zone,
      bubble_x: pos.x,
      bubble_y: pos.y,
      image_url: buildCutPlaceholder(chosenVariantIndex, cutIndex, CUT_COUNT, presetSummary, chosenTone),
    };
  });
}

function buildCutPlaceholder(variantIndex, cutNo, totalCuts, presetSummary, tone) {
  const palettes = ["#f2a93b", "#2a78d6", "#1baf7a", "#8e8e8e"]; // 4번째(회색)는 재생성 컷 표시용
  const color = palettes[variantIndex % palettes.length];
  const styleHint = (presetSummary || "").length > 30 ? presetSummary.slice(0, 30) + "…" : (presetSummary || "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" rx="10" fill="${color}" opacity="0.15" />
      <rect x="6" y="6" width="188" height="188" rx="8" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5,5" />
      <text x="100" y="85" text-anchor="middle" font-size="13" font-weight="700" fill="#333">컷 ${cutNo}/${totalCuts}</text>
      <text x="100" y="105" text-anchor="middle" font-size="9" fill="#666">(프리뷰 — 실제 API 연결 전)</text>
      <text x="100" y="122" text-anchor="middle" font-size="9" fill="#888">${tone || ""}</text>
      <foreignObject x="16" y="135" width="168" height="50">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:8px; color:#555; text-align:center; font-family:sans-serif;">${styleHint}</div>
      </foreignObject>
    </svg>
  `.trim();
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
}

// 컷 하나만 다시 그리기(Comic Editor) — 브리프에서는 "축소/맨 뒤로 미루는 안"이지만
// 데이터 저장은 미리 해둔다는 원칙과 같은 맥락으로, 기존 스텁을 그대로 유지.
function regenerateCut(cutIndex, totalCuts, editNote, presetSummary, sourceCaption) {
  const base = sourceCaption || `${cutIndex}컷`;
  const caption = editNote ? `${base} (재생성 반영: ${editNote})` : base;
  const zone = bubbleZoneFor(cutIndex);
  const pos = defaultBubblePosition(zone);
  return {
    index: cutIndex,
    caption,
    bubble_zone: zone,
    bubble_x: pos.x,
    bubble_y: pos.y,
    image_url: buildCutPlaceholder(3, cutIndex, totalCuts, presetSummary, "재생성됨"),
  };
}

module.exports = {
  CUT_COUNT,
  WIZARD_OPTIONS,
  defaultWizardValue,
  generateCoverVariants,
  continueRemainingCuts,
  regenerateCut,
};
