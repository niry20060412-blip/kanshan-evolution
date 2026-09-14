/**
 * 看山 SVG 渲染器
 * 身体轮廓为固定基准，所有部件绕身体外缘布置。
 * 规则（沿用既有约定）：
 *   1. 手持道具时，小手必须绘制在道具之上，否则会被道具盖住；
 *   2. 道具与身体轮廓不得大面积交叠，须自手的外缘伸出；
 *   3. 调整坐标后需确认 viewBox 能完整容纳最外侧部件。
 */
import { FORM_MAP } from './config/forms.js';

export const VIEWBOX = { w: 240, h: 250 };

/** 身体轮廓基准：椭圆体 */
const BODY = { cx: 120, cy: 132, rx: 62, ry: 58 };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** 小手：绘制在道具之上，与道具大幅重叠 */
function hand(x, y, accent, scale = 1) {
  return `<g class="ks-hand" transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="0" rx="11" ry="9" fill="#ffffff" stroke="${accent}" stroke-width="2.4"/>
    <path d="M-5 4 Q0 8 5 4" stroke="${accent}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>`;
}

// ---------------------------------------------------------------- 部件表
// 每个部件返回 { under, over }：under 绘制在手之前，over 绘制在手之后。

const PARTS = {
  goggles: (p) => ({
    under: `<g>
      <rect x="80" y="103" width="80" height="19" rx="9" fill="${p.accent}" opacity="0.9"/>
      <circle cx="100" cy="112" r="10" fill="#cfe6f5" stroke="${p.accent}" stroke-width="2.5"/>
      <circle cx="140" cy="112" r="10" fill="#cfe6f5" stroke="${p.accent}" stroke-width="2.5"/>
      <path d="M110 112 h20" stroke="${p.accent}" stroke-width="3"/>
    </g>`
  }),
  screwdriver: (p) => ({
    under: `<g transform="rotate(-24 178 172)">
      <rect x="172" y="150" width="10" height="30" rx="4" fill="${p.accent}"/>
      <rect x="175" y="176" width="4" height="26" fill="#b9c4cf"/>
    </g>`,
    handX: 176, handY: 174
  }),
  metal: (p) => ({
    under: `<path d="M76 168 q44 18 88 0" stroke="${p.accent}" stroke-width="2" fill="none" opacity="0.5"/>
      <circle cx="94" cy="176" r="3" fill="${p.accent}" opacity="0.6"/>
      <circle cx="146" cy="176" r="3" fill="${p.accent}" opacity="0.6"/>`
  }),
  beret: (p) => ({
    under: `<g>
      <ellipse cx="120" cy="76" rx="46" ry="20" fill="${p.accent}"/>
      <circle cx="146" cy="62" r="6" fill="${p.accent}"/>
    </g>`
  }),
  brush: (p) => ({
    under: `<g transform="rotate(28 180 170)">
      <rect x="175" y="144" width="8" height="40" rx="3" fill="#c9a06b"/>
      <path d="M175 182 h8 l-2 14 h-4 z" fill="${p.accent}"/>
    </g>`,
    handX: 176, handY: 174
  }),
  palette: (p) => ({
    under: `<g transform="translate(48 176)">
      <ellipse cx="0" cy="0" rx="20" ry="15" fill="#f5ead6" stroke="${p.accent}" stroke-width="2"/>
      <circle cx="-8" cy="-4" r="3.5" fill="#e2795f"/>
      <circle cx="1" cy="-7" r="3.5" fill="#4a90d9"/>
      <circle cx="9" cy="-2" r="3.5" fill="#e6c65c"/>
    </g>`,
    handX: 64, handY: 174
  }),
  plaid: (p) => ({
    over: `<g opacity="0.55">
      <path d="M74 166 h92 M74 178 h92 M74 190 h92" stroke="${p.accent}" stroke-width="2"/>
      <path d="M96 162 v32 M120 162 v32 M144 162 v32" stroke="${p.accent}" stroke-width="2"/>
    </g>`
  }),
  thermos: (p) => ({
    under: `<g transform="translate(180 176)">
      <rect x="-11" y="-24" width="22" height="46" rx="7" fill="#dfe6ec" stroke="${p.accent}" stroke-width="2.4"/>
      <rect x="-11" y="-24" width="22" height="9" rx="4" fill="${p.accent}"/>
      <path d="M-4 -6 h8" stroke="${p.accent}" stroke-width="1.6"/>
    </g>`,
    handX: 176, handY: 174
  }),
  eyebags: () => ({
    over: `<g>
      <path d="M94 122 q10 9 20 0 q-10 6 -20 0 z" fill="#6e7885" opacity="0.62"/>
      <path d="M126 122 q10 9 20 0 q-10 6 -20 0 z" fill="#6e7885" opacity="0.62"/>
      <path d="M94 121 q10 8 20 0" stroke="#5c6672" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M126 121 q10 8 20 0" stroke="#5c6672" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M97 101 q6 -4 12 -1 M131 101 q6 -4 12 -1" stroke="#7b8492" stroke-width="1.6" fill="none" opacity="0.7"/>
    </g>`,
    dimBlush: true
  }),
  bouquet: (p) => ({
    under: `<g transform="translate(180 178)">
      <path d="M0 22 L0 2" stroke="#7ba05b" stroke-width="3"/>
      <circle cx="-8" cy="-4" r="7" fill="${p.accent}"/>
      <circle cx="6" cy="-8" r="7" fill="#f6c1c8"/>
      <circle cx="2" cy="4" r="6.5" fill="#ffe3e6"/>
    </g>`,
    handX: 176, handY: 174
  }),
  softeyes: () => ({
    over: `<g>
      <path d="M96 101 q8 -7 16 0" stroke="#6b5b57" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M128 101 q8 -7 16 0" stroke="#6b5b57" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>`
  }),
  blanket: (p) => ({
    over: `<path d="M66 162 q54 26 108 0 q2 28 -54 32 q-56 -4 -54 -32 z" fill="${p.accent}" opacity="0.75"/>`
  }),
  slippers: (p) => ({
    over: `<g>
      <ellipse cx="98" cy="201" rx="18" ry="9" fill="${p.accent}"/>
      <ellipse cx="142" cy="201" rx="18" ry="9" fill="${p.accent}"/>
    </g>`
  }),
  noodle: (p) => ({
    under: `<g transform="translate(48 178)">
      <path d="M-16 -6 h32 l-4 22 h-24 z" fill="#f5ead6" stroke="${p.accent}" stroke-width="2"/>
      <path d="M-16 -6 h32" stroke="${p.accent}" stroke-width="3"/>
    </g>`,
    handX: 64, handY: 174
  }),
  robe: (p) => ({
    over: `<path d="M76 162 q44 22 88 0 l4 30 q-48 12 -96 0 z" fill="${p.accent}" opacity="0.55"/>
      <path d="M120 162 v30" stroke="${p.accent}" stroke-width="2" opacity="0.8"/>`
  }),
  fan: (p) => ({
    under: `<g transform="rotate(-18 182 170)">
      <path d="M182 182 L162 146 A24 24 0 0 1 202 146 Z" fill="#f7f0e2" stroke="${p.accent}" stroke-width="2"/>
      <path d="M182 182 L182 152 M182 182 L170 154 M182 182 L194 154" stroke="${p.accent}" stroke-width="1.3"/>
    </g>`,
    handX: 176, handY: 174
  }),
  beard: () => ({
    over: `<path d="M100 158 q20 14 40 0 q-6 26 -20 30 q-14 -4 -20 -30 z" fill="#e8e2d6" stroke="#c9c0ae" stroke-width="1.6"/>`
  })
};

// ---- 组合形态与稀有形态部件 ----
Object.assign(PARTS, {
  neon: (p) => ({
    under: `<g opacity="0.9">
      <rect x="66" y="86" width="108" height="4" rx="2" fill="${p.accent}"/>
      <rect x="76" y="214" width="88" height="4" rx="2" fill="${p.glow}"/>
      <circle cx="58" cy="112" r="4" fill="${p.glow}"/>
      <circle cx="182" cy="112" r="4" fill="${p.accent}"/>
    </g>`
  }),
  mecharm: (p) => ({
    under: `<g>
      <path d="M178 168 L202 156" stroke="${p.glow}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="205" cy="154" r="7" fill="${p.accent}"/>
      <rect x="208" y="146" width="5" height="18" rx="2" fill="${p.glow}" transform="rotate(24 210 155)"/>
    </g>`,
    handX: 176, handY: 174
  }),
  visor: (p) => ({
    under: `<rect x="82" y="105" width="76" height="15" rx="7" fill="${p.glow}" opacity="0.85"/>
      <rect x="88" y="109" width="24" height="6" rx="3" fill="${p.accent}"/>`
  }),
  suit: (p) => ({
    over: `<path d="M80 161 q40 22 80 0 l4 32 q-44 12 -88 0 z" fill="${p.accent}" opacity="0.6"/>
      <path d="M120 161 l-9 13 l9 8 l9 -8 z" fill="#ffffff"/>
      <path d="M120 182 v11" stroke="#c0392b" stroke-width="5"/>`
  }),
  screens: (p) => ({
    under: `<g>
      <rect x="36" y="112" width="30" height="24" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
      <rect x="174" y="112" width="30" height="24" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
      <rect x="100" y="212" width="40" height="24" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
      <path d="M40 120 h20 M40 126 h14" stroke="${p.glow}" stroke-width="1.6"/>
      <path d="M178 120 h20 M178 126 h12" stroke="${p.glow}" stroke-width="1.6"/>
    </g>`
  }),
  smoke: () => ({
    over: `<g class="ks-smoke" opacity="0.6">
      <circle cx="150" cy="58" r="6" fill="#c7ced6"/>
      <circle cx="162" cy="44" r="8" fill="#d4dae1"/>
      <circle cx="152" cy="30" r="10" fill="#e1e6eb"/>
    </g>`
  }),
  guitar: (p) => ({
    under: `<g transform="rotate(-20 186 176)">
      <ellipse cx="186" cy="184" rx="17" ry="21" fill="#d9a86c" stroke="${p.accent}" stroke-width="2"/>
      <circle cx="186" cy="184" r="6" fill="#6b4f31"/>
      <rect x="182" y="136" width="8" height="34" rx="3" fill="#8a6440"/>
    </g>`,
    handX: 176, handY: 174
  }),
  headphone: (p) => ({
    under: `<g>
      <path d="M76 104 a44 44 0 0 1 88 0" stroke="${p.accent}" stroke-width="6" fill="none"/>
      <rect x="64" y="100" width="16" height="28" rx="7" fill="${p.accent}"/>
      <rect x="160" y="100" width="16" height="28" rx="7" fill="${p.accent}"/>
    </g>`
  }),
  lookup: () => ({
    over: `<g>
      <path d="M97 100 q7 -6 14 0" stroke="#5b5470" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M129 100 q7 -6 14 0" stroke="#5b5470" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>`
  }),
  pillow: (p) => ({
    under: `<g transform="rotate(-12 58 186)">
      <rect x="34" y="168" width="46" height="38" rx="12" fill="${p.accent}" opacity="0.8"/>
    </g>`
  }),
  sleepy: () => ({
    over: `<g>
      <path d="M96 112 q8 5 16 0" stroke="#6b5b57" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M128 112 q8 5 16 0" stroke="#6b5b57" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <text x="170" y="70" font-size="18" fill="#a8a0b4" opacity="0.8">z</text>
      <text x="184" y="54" font-size="13" fill="#a8a0b4" opacity="0.6">z</text>
    </g>`
  }),
  inkstroke: (p) => ({
    under: `<g opacity="0.4">
      <path d="M56 186 q40 -22 76 -6" stroke="${p.accent}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M150 196 q22 -12 40 -30" stroke="${p.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`
  }),
  umbrella: (p) => ({
    under: `<g transform="translate(182 164)">
      <path d="M-26 0 A26 26 0 0 1 26 0 Z" fill="#e8dcc4" stroke="${p.accent}" stroke-width="2"/>
      <path d="M0 0 v42" stroke="#8a6440" stroke-width="3"/>
      <path d="M-26 0 q13 8 13 0 q13 8 13 0 q13 8 13 0" stroke="${p.accent}" stroke-width="1.4" fill="none"/>
    </g>`,
    handX: 176, handY: 174
  }),
  scroll: (p) => ({
    under: `<g transform="translate(48 178)">
      <rect x="-18" y="-9" width="36" height="20" rx="3" fill="#f5ebd8" stroke="${p.accent}" stroke-width="1.8"/>
      <path d="M-11 -3 h22 M-11 3 h16" stroke="${p.accent}" stroke-width="1.2"/>
    </g>`,
    handX: 64, handY: 174
  }),
  keyboard: (p) => ({
    under: `<g transform="translate(120 216)">
      <rect x="-42" y="-9" width="84" height="19" rx="5" fill="#e8edf3" stroke="${p.accent}" stroke-width="2"/>
      <path d="M-32 -2 h64 M-32 3 h48" stroke="${p.accent}" stroke-width="1.4"/>
    </g>`
  }),
  snacks: (p) => ({
    under: `<g>
      <rect x="26" y="190" width="22" height="30" rx="5" fill="${p.accent}" opacity="0.85"/>
      <rect x="194" y="194" width="20" height="26" rx="5" fill="#e2795f" opacity="0.85"/>
      <circle cx="36" cy="178" r="7" fill="#e6c65c"/>
    </g>`
  }),
  zhongshan: (p) => ({
    over: `<path d="M78 161 q42 22 84 0 l4 32 q-46 12 -92 0 z" fill="${p.accent}" opacity="0.65"/>
      <path d="M120 161 v32" stroke="#5c6650" stroke-width="2"/>
      <circle cx="120" cy="172" r="2.6" fill="#4a5340"/>
      <circle cx="120" cy="184" r="2.6" fill="#4a5340"/>`
  }),
  enamelcup: (p) => ({
    under: `<g transform="translate(180 178)">
      <rect x="-13" y="-16" width="26" height="32" rx="4" fill="#f4f4ee" stroke="${p.accent}" stroke-width="2.4"/>
      <path d="M13 -6 a7 7 0 0 1 0 14" stroke="${p.accent}" stroke-width="2.4" fill="none"/>
      <path d="M-13 -9 h26" stroke="#c0392b" stroke-width="2.6"/>
    </g>`,
    handX: 176, handY: 174
  }),
  newspaper: (p) => ({
    under: `<g transform="rotate(-8 50 180)">
      <rect x="30" y="162" width="40" height="30" rx="2" fill="#f2f0e8" stroke="${p.accent}" stroke-width="1.8"/>
      <path d="M36 170 h28 M36 176 h28 M36 182 h18" stroke="${p.accent}" stroke-width="1.3"/>
    </g>`,
    handX: 64, handY: 174
  }),
  apron: (p) => ({
    over: `<path d="M96 162 h48 l6 32 q-30 10 -60 0 z" fill="${p.accent}" opacity="0.7"/>
      <path d="M96 162 l-10 -10 M144 162 l10 -10" stroke="${p.accent}" stroke-width="2.6"/>`
  }),
  clay: (p) => ({
    under: `<g transform="translate(180 180)">
      <path d="M-15 12 q0 -24 15 -24 q15 0 15 24 z" fill="#c98f6b" stroke="${p.accent}" stroke-width="2"/>
      <ellipse cx="0" cy="12" rx="15" ry="4" fill="#a9765a"/>
    </g>`,
    handX: 176, handY: 174
  }),
  photo: (p) => ({
    under: `<g transform="rotate(-10 52 178)">
      <rect x="34" y="160" width="36" height="32" rx="2" fill="#f5f2ec" stroke="${p.accent}" stroke-width="2"/>
      <circle cx="52" cy="172" r="7" fill="#c9c0b4"/>
      <path d="M40 186 q12 -10 24 0" fill="#c9c0b4"/>
    </g>`,
    handX: 64, handY: 174
  }),
  grayscale: () => ({
    under: `<rect x="0" y="0" width="240" height="250" fill="#9a9186" opacity="0.12"/>`
  }),
  bookcrown: (p) => ({
    under: `<g transform="translate(120 66)">
      <rect x="-26" y="-6" width="52" height="11" rx="2" fill="${p.accent}"/>
      <rect x="-21" y="-16" width="42" height="11" rx="2" fill="#e0b84c"/>
      <rect x="-15" y="-26" width="30" height="11" rx="2" fill="${p.accent}"/>
    </g>`
  }),
  fullglow: (p) => ({
    under: `<circle cx="${BODY.cx}" cy="${BODY.cy}" r="82" fill="none" stroke="${p.glow}" stroke-width="3" opacity="0.55" class="ks-pulse"/>
      <circle cx="${BODY.cx}" cy="${BODY.cy}" r="94" fill="none" stroke="${p.glow}" stroke-width="1.6" opacity="0.3"/>`
  }),
  /** 羁绊：与昵称同色的光环 + 一条看不见的线
   *  半径需贴合身体外缘（rx62/ry58），过大会被 viewBox 裁切并压住面部 */
  bondhalo: (p, opts) => ({
    under: `<ellipse cx="${BODY.cx}" cy="${BODY.cy}" rx="72" ry="68" fill="none"
        stroke="${opts.bondColor || p.accent}" stroke-width="3.5" opacity="0.42" class="ks-pulse"/>
      <ellipse cx="${BODY.cx}" cy="${BODY.cy}" rx="80" ry="76" fill="none"
        stroke="${opts.bondColor || p.glow}" stroke-width="1.6" opacity="0.22"/>`
  }),
  bondthread: (p, opts) => ({
    over: `<path d="M182 152 Q214 186 236 214" stroke="${opts.bondColor || p.accent}"
        stroke-width="2" fill="none" opacity="0.42" stroke-dasharray="5 7" class="ks-thread"/>`
  })
});

// ---------------------------------------------------------------- 渲染主体

/** 官方形象固定色：黑色部件（吻、四肢）不随形态调色板改变 */
const INK = '#1c1c1c';

/**
 * 身体 + 五官（所有形态共用的基准轮廓）
 * 造型依据官方三视图：白色卵形身体、两只尖耳、黑色大吻部、
 * 黑色细手臂（末端分指）、黑色短腿（圆头靴状）、身后白色球尾。
 * dimBlush：某些部件（如黑眼圈）需要压淡腮红，否则会盖过它的表达。
 */
function renderBody(p, opts, dimBlush = false) {
  const blink = opts.reducedMotion ? '' : 'ks-blink';
  const blush = dimBlush ? 0.14 : 0.4;
  return `
    <!-- 球尾：身体左后方偏上，避开左臂末端(56,172)的分指区域 -->
    <circle cx="52" cy="140" r="14" fill="${p.body}" stroke="${p.accent}" stroke-width="2.2"/>

    <!-- 黑色细手臂 + 分指 -->
    <g stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M74 146 Q66 160 64 174"/>
      <path d="M166 146 Q174 160 176 174"/>
    </g>
    <g stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none">
      <path d="M64 174 l-7 9 M64 174 l1 11 M64 174 l8 8"/>
      <path d="M176 174 l7 9 M176 174 l-1 11 M176 174 l-8 8"/>
    </g>

    <!-- 黑色短腿 + 圆头靴 -->
    <g>
      <rect x="94" y="178" width="12" height="20" rx="6" fill="${INK}"/>
      <rect x="134" y="178" width="12" height="20" rx="6" fill="${INK}"/>
      <ellipse cx="98" cy="199" rx="14" ry="8.5" fill="${INK}"/>
      <ellipse cx="142" cy="199" rx="14" ry="8.5" fill="${INK}"/>
    </g>

    <!-- 白色卵形身体 -->
    <ellipse class="ks-body" cx="${BODY.cx}" cy="${BODY.cy}" rx="${BODY.rx}" ry="${BODY.ry}"
      fill="${p.body}" stroke="${p.accent}" stroke-width="2.6"/>

    <!-- 两只尖耳 -->
    <path d="M74 90 L66 54 L98 74 Z" fill="${p.body}" stroke="${p.accent}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M166 90 L174 54 L142 74 Z" fill="${p.body}" stroke="${p.accent}" stroke-width="2.4" stroke-linejoin="round"/>

    <!-- 眼睛：黑色小圆点 -->
    <g class="${blink}">
      <circle cx="104" cy="112" r="6.2" fill="${INK}"/>
      <circle cx="136" cy="112" r="6.2" fill="${INK}"/>
      <circle cx="106" cy="109.6" r="2" fill="#ffffff"/>
      <circle cx="138" cy="109.6" r="2" fill="#ffffff"/>
    </g>

    <!-- 腮红：压在吻部之下，保持克制 -->
    <ellipse cx="82" cy="128" rx="8" ry="5" fill="#f6c9cd" opacity="${blush}"/>
    <ellipse cx="158" cy="128" rx="8" ry="5" fill="#f6c9cd" opacity="${blush}"/>

    <!-- 黑色大吻部：造型识别的核心 -->
    <ellipse cx="120" cy="140" rx="25" ry="20" fill="${INK}"/>
    <ellipse cx="120" cy="131" rx="7.5" ry="5.5" fill="#3a3a3a"/>`;
}

/**
 * 渲染指定形态。
 * @param {string} formId
 * @param {object} opts { reducedMotion, bondColor, silhouette }
 */
export function renderPet(formId, opts = {}) {
  const form = FORM_MAP[formId] || FORM_MAP.origin;
  const p = form.palette;

  // 图鉴未解锁：剪影模式（轮廓同步官方造型，含吻部与四肢）
  if (opts.silhouette) {
    return `<svg viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" class="ks-svg" role="img"
        aria-label="${esc(form.name)}（未解锁）">
      <g fill="#c3cbd4" opacity="0.55">
        <circle cx="52" cy="140" r="14"/>
        <ellipse cx="${BODY.cx}" cy="${BODY.cy}" rx="${BODY.rx}" ry="${BODY.ry}"/>
        <path d="M74 90 L66 54 L98 74 Z"/>
        <path d="M166 90 L174 54 L142 74 Z"/>
        <ellipse cx="98" cy="199" rx="14" ry="8.5"/>
        <ellipse cx="142" cy="199" rx="14" ry="8.5"/>
        <ellipse cx="120" cy="140" rx="25" ry="20" opacity="0.5"/>
      </g>
      <text x="120" y="148" text-anchor="middle" font-size="34" fill="#8d97a3" opacity="0.85">?</text>
    </svg>`;
  }

  const unders = [];
  const overs = [];
  const hands = [];
  let dimBlush = false;

  for (const key of form.parts || []) {
    const builder = PARTS[key];
    if (!builder) continue;
    const out = builder(p, opts) || {};
    if (out.under) unders.push(out.under);
    if (out.over) overs.push(out.over);
    if (out.dimBlush) dimBlush = true;
    // 手持道具：记录手的位置，稍后绘制在道具之上
    if (typeof out.handX === 'number') hands.push(hand(out.handX, out.handY, p.accent));
  }

  const breathe = opts.reducedMotion ? '' : 'ks-breathe';

  return `<svg viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" class="ks-svg" role="img"
      aria-label="${esc(form.name)}">
    <g class="${breathe}">
      ${unders.join('\n')}
      ${renderBody(p, opts, dimBlush)}
      ${hands.join('\n')}
      ${overs.join('\n')}
    </g>
  </svg>`;
}

/** 图鉴用的小尺寸头像 */
export function renderThumb(formId, unlocked, opts = {}) {
  return renderPet(formId, { ...opts, silhouette: !unlocked, reducedMotion: true });
}
