// Session Studio용 스텁 — 실제 컷툰 생성 AI가 붙기 전까지, 소재 텍스트 + 컷 수 + (있다면)
// 수정 요청을 반영해서 "그럴듯한 컷별 캡션 + 자리표시자 이미지" 3안을 만든다.
// suggest.js와 같은 패턴: 이 파일의 generateComicCandidates()만 나중에 실제 API로 교체하면 됨.

function splitMaterialIntoCuts(materialText, cutCount) {
  const note = (materialText || "").trim() || "소재 미입력";
  const sentences = note.split(/(?<=[.!?])\s+/).filter(Boolean);
  const cuts = [];
  for (let i = 0; i < cutCount; i++) {
    const src = sentences[i % sentences.length] || note;
    cuts.push(`${i + 1}컷: ${src}`);
  }
  return cuts;
}

// 3안이 서로 조금씩 달라 보이도록, 안(variantIndex)별로 톤을 살짝 바꿔 캡션을 만든다.
const VARIANT_TONE = ["공감형(부드러운 톤)", "유머형(가벼운 톤)", "정보형(직설적 톤)"];

function generateComicCandidates(materialText, cutCount, editNote, presetSummary) {
  const baseCuts = splitMaterialIntoCuts(materialText, cutCount);
  return [0, 1, 2].map((variantIndex) => {
    const tone = VARIANT_TONE[variantIndex];
    const cuts = baseCuts.map((caption, i) => ({
      index: i + 1,
      caption: editNote ? `${caption} (수정 반영: ${editNote})` : caption,
      tone,
      image_url: buildCutPlaceholder(variantIndex, i + 1, cutCount, presetSummary),
    }));
    return { variant: variantIndex, tone, cuts };
  });
}

function buildCutPlaceholder(variantIndex, cutNo, totalCuts, presetSummary) {
  const palettes = ["#f2a93b", "#2a78d6", "#1baf7a"];
  const color = palettes[variantIndex % palettes.length];
  const styleHint = (presetSummary || "").length > 30 ? presetSummary.slice(0, 30) + "…" : (presetSummary || "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" rx="10" fill="${color}" opacity="0.15" />
      <rect x="6" y="6" width="188" height="188" rx="8" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5,5" />
      <text x="100" y="90" text-anchor="middle" font-size="13" font-weight="700" fill="#333">컷 ${cutNo}/${totalCuts}</text>
      <text x="100" y="110" text-anchor="middle" font-size="9" fill="#666">(프리뷰 — 실제 API 연결 전)</text>
      <foreignObject x="16" y="125" width="168" height="60">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:8px; color:#555; text-align:center; font-family:sans-serif;">${styleHint}</div>
      </foreignObject>
    </svg>
  `.trim();
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
}

module.exports = { generateComicCandidates };
