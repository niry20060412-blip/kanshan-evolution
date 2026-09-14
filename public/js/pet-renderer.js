/**
 * 看山 SVG 渲染器
 * 身体轮廓为固定基准，所有部件绕身体外缘布置。
 * 规则（沿用既有约定）：
 *   1. 手持道具时，小手必须绘制在道具之上，否则会被道具盖住；
 *   2. 道具与身体轮廓不得大面积交叠，须自手的外缘伸出；
 *   3. 调整坐标后需确认 viewBox 能完整容纳最外侧部件。
 */
import { FORM_MAP } from './config/forms.js';

export const VIEWBOX = { w: 240, h: 268 };

/** 身体几何基准（一体连续轮廓，依据官方三视图）：
 *  顶部 y=30，底部 y=218，左右壁约 x=56/184，最宽处在下腹。
 *  部件布置以此为参照；BODY 保留供外部换算使用。 */
const BODY = { cx: 120, cy: 124, rx: 64, ry: 94 };

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
      <rect x="76" y="85" width="88" height="19" rx="9" fill="${p.accent}" opacity="0.9"/>
      <circle cx="89" cy="94" r="10" fill="#cfe6f5" stroke="${p.accent}" stroke-width="2.5"/>
      <circle cx="151" cy="94" r="10" fill="#cfe6f5" stroke="${p.accent}" stroke-width="2.5"/>
      <path d="M101 94 h38" stroke="${p.accent}" stroke-width="3"/>
    </g>`
  }),
  screwdriver: (p) => ({
    under: `<g transform="rotate(-24 178 172)">
      <rect x="172" y="150" width="10" height="30" rx="4" fill="${p.accent}"/>
      <rect x="175" y="176" width="4" height="26" fill="#b9c4cf"/>
    </g>`,
    handX: 187, handY: 181
  }),
  metal: (p) => ({
    under: `<path d="M72 160 q48 18 96 0" stroke="${p.accent}" stroke-width="2" fill="none" opacity="0.5"/>
      <circle cx="92" cy="172" r="3" fill="${p.accent}" opacity="0.6"/>
      <circle cx="148" cy="172" r="3" fill="${p.accent}" opacity="0.6"/>`
  }),
  beret: (p) => ({
    under: `<g>
      <ellipse cx="120" cy="44" rx="44" ry="18" fill="${p.accent}"/>
      <circle cx="144" cy="32" r="6" fill="${p.accent}"/>
    </g>`
  }),
  brush: (p) => ({
    under: `<g transform="rotate(28 180 170)">
      <rect x="175" y="144" width="8" height="40" rx="3" fill="#c9a06b"/>
      <path d="M175 182 h8 l-2 14 h-4 z" fill="${p.accent}"/>
    </g>`,
    handX: 187, handY: 181
  }),
  palette: (p) => ({
    under: `<g transform="translate(48 176)">
      <ellipse cx="0" cy="0" rx="20" ry="15" fill="#f5ead6" stroke="${p.accent}" stroke-width="2"/>
      <circle cx="-8" cy="-4" r="3.5" fill="#e2795f"/>
      <circle cx="1" cy="-7" r="3.5" fill="#4a90d9"/>
      <circle cx="9" cy="-2" r="3.5" fill="#e6c65c"/>
    </g>`,
    handX: 53,  handY: 181
  }),
  plaid: (p) => ({
    over: `<g opacity="0.55">
      <path d="M68 156 h104 M66 172 h108 M66 188 h108" stroke="${p.accent}" stroke-width="2"/>
      <path d="M92 142 v58 M120 140 v60 M148 142 v58" stroke="${p.accent}" stroke-width="2"/>
    </g>`
  }),
  thermos: (p) => ({
    under: `<g transform="translate(180 176)">
      <rect x="-11" y="-24" width="22" height="46" rx="7" fill="#dfe6ec" stroke="${p.accent}" stroke-width="2.4"/>
      <rect x="-11" y="-24" width="22" height="9" rx="4" fill="${p.accent}"/>
      <path d="M-4 -6 h8" stroke="${p.accent}" stroke-width="1.6"/>
    </g>`,
    handX: 187, handY: 181
  }),
  eyebags: () => ({
    over: `<g>
      <path d="M79 104 q10 9 20 0 q-10 6 -20 0 z" fill="#6e7885" opacity="0.62"/>
      <path d="M141 104 q10 9 20 0 q-10 6 -20 0 z" fill="#6e7885" opacity="0.62"/>
      <path d="M79 103 q10 8 20 0" stroke="#5c6672" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M141 103 q10 8 20 0" stroke="#5c6672" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M83 82 q6 -4 12 -1 M145 82 q6 -4 12 -1" stroke="#7b8492" stroke-width="1.6" fill="none" opacity="0.7"/>
    </g>`
  }),
  bouquet: (p) => ({
    under: `<g transform="translate(180 178)">
      <path d="M0 22 L0 2" stroke="#7ba05b" stroke-width="3"/>
      <circle cx="-8" cy="-4" r="7" fill="${p.accent}"/>
      <circle cx="6" cy="-8" r="7" fill="#f6c1c8"/>
      <circle cx="2" cy="4" r="6.5" fill="#ffe3e6"/>
    </g>`,
    handX: 187, handY: 181
  }),
  softeyes: () => ({
    over: `<g>
      <path d="M82 83 q8 -7 16 0" stroke="#6b5b57" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M144 83 q8 -7 16 0" stroke="#6b5b57" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>`
  }),
  blanket: (p) => ({
    over: `<path d="M66 146 q54 22 108 0 q0 40 -54 46 q-54 -6 -54 -46 z" fill="${p.accent}" opacity="0.75"/>`
  }),
  slippers: (p) => ({
    over: `<g>
      <ellipse cx="97" cy="246" rx="18" ry="9.5" fill="${p.accent}"/>
      <ellipse cx="143" cy="246" rx="18" ry="9.5" fill="${p.accent}"/>
    </g>`
  }),
  noodle: (p) => ({
    under: `<g transform="translate(48 178)">
      <path d="M-16 -6 h32 l-4 22 h-24 z" fill="#f5ead6" stroke="${p.accent}" stroke-width="2"/>
      <path d="M-16 -6 h32" stroke="${p.accent}" stroke-width="3"/>
    </g>`,
    handX: 53,  handY: 181
  }),
  robe: (p) => ({
    over: `<path d="M70 144 q50 20 100 0 l6 56 q-56 12 -112 0 z" fill="${p.accent}" opacity="0.55"/>
      <path d="M120 144 v56" stroke="${p.accent}" stroke-width="2" opacity="0.8"/>`
  }),
  fan: (p) => ({
    under: `<g transform="rotate(-18 182 170)">
      <path d="M182 182 L162 146 A24 24 0 0 1 202 146 Z" fill="#f7f0e2" stroke="${p.accent}" stroke-width="2"/>
      <path d="M182 182 L182 152 M182 182 L170 154 M182 182 L194 154" stroke="${p.accent}" stroke-width="1.3"/>
    </g>`,
    handX: 187, handY: 181
  }),
  beard: () => ({
    over: `<path d="M102 136 q18 12 36 0 q-5 24 -18 28 q-13 -4 -18 -28 z" fill="#e8e2d6" stroke="#c9c0ae" stroke-width="1.6"/>`
  })
};

// ---- 组合形态与稀有形态部件 ----
Object.assign(PARTS, {
  neon: (p) => ({
    under: `<g opacity="0.9">
      <rect x="70" y="52" width="100" height="4" rx="2" fill="${p.accent}"/>
      <rect x="76" y="256" width="88" height="4" rx="2" fill="${p.glow}"/>
      <circle cx="52" cy="94" r="4" fill="${p.glow}"/>
      <circle cx="188" cy="94" r="4" fill="${p.accent}"/>
    </g>`
  }),
  mecharm: (p) => ({
    under: `<g>
      <path d="M178 168 L202 156" stroke="${p.glow}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="205" cy="154" r="7" fill="${p.accent}"/>
      <rect x="208" y="146" width="5" height="18" rx="2" fill="${p.glow}" transform="rotate(24 210 155)"/>
    </g>`,
    handX: 187, handY: 181
  }),
  visor: (p) => ({
    under: `<rect x="76" y="87" width="88" height="15" rx="7" fill="${p.glow}" opacity="0.85"/>
      <rect x="84" y="91" width="24" height="6" rx="3" fill="${p.accent}"/>`
  }),
  suit: (p) => ({
    over: `<path d="M74 144 q46 20 92 0 l5 56 q-51 12 -102 0 z" fill="${p.accent}" opacity="0.6"/>
      <path d="M120 144 l-11 16 l11 10 l11 -10 z" fill="#ffffff"/>
      <path d="M120 170 v30" stroke="#c0392b" stroke-width="5"/>`
  }),
  screens: (p) => ({
    under: `<g>
      <rect x="36" y="112" width="30" height="24" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
      <rect x="174" y="112" width="30" height="24" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
      <rect x="100" y="226" width="40" height="22" rx="4" fill="#1f2a37" stroke="${p.accent}" stroke-width="2"/>
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
    handX: 187, handY: 181
  }),
  headphone: (p) => ({
    under: `<g>
      <path d="M78 66 a42 42 0 0 1 84 0" stroke="${p.accent}" stroke-width="6" fill="none"/>
      <rect x="62" y="62" width="16" height="30" rx="7" fill="${p.accent}"/>
      <rect x="162" y="62" width="16" height="30" rx="7" fill="${p.accent}"/>
    </g>`
  }),
  lookup: () => ({
    over: `<g>
      <path d="M83 88 q7 -6 14 0" stroke="#5b5470" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M145 88 q7 -6 14 0" stroke="#5b5470" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>`
  }),
  pillow: (p) => ({
    under: `<g transform="rotate(-12 58 186)">
      <rect x="34" y="168" width="46" height="38" rx="12" fill="${p.accent}" opacity="0.8"/>
    </g>`
  }),
  sleepy: () => ({
    over: `<g>
      <path d="M82 94 q8 5 16 0" stroke="#6b5b57" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M144 94 q8 5 16 0" stroke="#6b5b57" stroke-width="2.8" fill="none" stroke-linecap="round"/>
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
    handX: 187, handY: 181
  }),
  scroll: (p) => ({
    under: `<g transform="translate(48 178)">
      <rect x="-18" y="-9" width="36" height="20" rx="3" fill="#f5ebd8" stroke="${p.accent}" stroke-width="1.8"/>
      <path d="M-11 -3 h22 M-11 3 h16" stroke="${p.accent}" stroke-width="1.2"/>
    </g>`,
    handX: 53,  handY: 181
  }),
  keyboard: (p) => ({
    under: `<g transform="translate(120 230)">
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
    over: `<path d="M72 144 q48 20 96 0 l5 56 q-53 12 -106 0 z" fill="${p.accent}" opacity="0.65"/>
      <path d="M120 144 v56" stroke="#5c6650" stroke-width="2"/>
      <circle cx="120" cy="160" r="2.6" fill="#4a5340"/>
      <circle cx="120" cy="180" r="2.6" fill="#4a5340"/>`
  }),
  enamelcup: (p) => ({
    under: `<g transform="translate(180 178)">
      <rect x="-13" y="-16" width="26" height="32" rx="4" fill="#f4f4ee" stroke="${p.accent}" stroke-width="2.4"/>
      <path d="M13 -6 a7 7 0 0 1 0 14" stroke="${p.accent}" stroke-width="2.4" fill="none"/>
      <path d="M-13 -9 h26" stroke="#c0392b" stroke-width="2.6"/>
    </g>`,
    handX: 187, handY: 181
  }),
  newspaper: (p) => ({
    under: `<g transform="rotate(-8 50 180)">
      <rect x="30" y="162" width="40" height="30" rx="2" fill="#f2f0e8" stroke="${p.accent}" stroke-width="1.8"/>
      <path d="M36 170 h28 M36 176 h28 M36 182 h18" stroke="${p.accent}" stroke-width="1.3"/>
    </g>`,
    handX: 53,  handY: 181
  }),
  apron: (p) => ({
    over: `<path d="M92 146 h56 l8 54 q-36 12 -72 0 z" fill="${p.accent}" opacity="0.7"/>
      <path d="M92 146 l-10 -12 M148 146 l10 -12" stroke="${p.accent}" stroke-width="2.6"/>`
  }),
  clay: (p) => ({
    under: `<g transform="translate(180 180)">
      <path d="M-15 12 q0 -24 15 -24 q15 0 15 24 z" fill="#c98f6b" stroke="${p.accent}" stroke-width="2"/>
      <ellipse cx="0" cy="12" rx="15" ry="4" fill="#a9765a"/>
    </g>`,
    handX: 187, handY: 181
  }),
  photo: (p) => ({
    under: `<g transform="rotate(-10 52 178)">
      <rect x="34" y="160" width="36" height="32" rx="2" fill="#f5f2ec" stroke="${p.accent}" stroke-width="2"/>
      <circle cx="52" cy="172" r="7" fill="#c9c0b4"/>
      <path d="M40 186 q12 -10 24 0" fill="#c9c0b4"/>
    </g>`,
    handX: 53,  handY: 181
  }),
  grayscale: () => ({
    under: `<rect x="0" y="0" width="240" height="268" fill="#9a9186" opacity="0.12"/>`
  }),
  bookcrown: (p) => ({
    under: `<g transform="translate(120 34)">
      <rect x="-26" y="-6" width="52" height="11" rx="2" fill="${p.accent}"/>
      <rect x="-21" y="-16" width="42" height="11" rx="2" fill="#e0b84c"/>
      <rect x="-15" y="-26" width="30" height="11" rx="2" fill="${p.accent}"/>
    </g>`
  }),
  fullglow: (p) => ({
    under: `<ellipse cx="120" cy="124" rx="78" ry="102" fill="none" stroke="${p.glow}" stroke-width="3" opacity="0.55" class="ks-pulse"/>
      <ellipse cx="120" cy="124" rx="88" ry="113" fill="none" stroke="${p.glow}" stroke-width="1.6" opacity="0.3"/>`
  }),
  /** 羁绊：与昵称同色的光环 + 一条看不见的线
   *  半径需贴合身体外缘（rx62/ry58），过大会被 viewBox 裁切并压住面部 */
  bondhalo: (p, opts) => ({
    under: `<ellipse cx="120" cy="124" rx="78" ry="102" fill="none"
        stroke="${opts.bondColor || p.accent}" stroke-width="3.5" opacity="0.42" class="ks-pulse"/>
      <ellipse cx="120" cy="124" rx="88" ry="113" fill="none"
        stroke="${opts.bondColor || p.glow}" stroke-width="1.6" opacity="0.22"/>`
  }),
  bondthread: (p, opts) => ({
    over: `<path d="M192 190 Q214 214 236 240" stroke="${opts.bondColor || p.accent}"
        stroke-width="2" fill="none" opacity="0.42" stroke-dasharray="5 7" class="ks-thread"/>`
  })
});

// ---------------------------------------------------------------- 渲染主体

/** 官方形象固定色：黑色部件（吻、四肢）不随形态调色板改变 */
const INK = '#1c1c1c';

/**
 * 身体 + 五官（所有形态共用的基准轮廓）
 *
 * 严格依据官方三视图，只保留参考图上真实存在的要素：
 *   1. 梨形（水滴形）一体头身 —— 上窄下宽，不是正圆；
 *   2. 黑色椭圆大鼻突出于脸部轮廓之外（三视图正面可见鼻尖越过下缘）；
 *   3. 两只尖三角耳，耳内无填充差异；
 *   4. 黑色圆点眼睛，无高光修饰；
 *   5. 黑色手臂粗实、末端为分指手掌；
 *   6. 黑色短腿 + 黑色圆头脚；
 *   7. 白色圆球尾位于身体侧后方。
 * 参考图中没有腮红、没有嘴线、没有眼部高光，这里一律不画。
 */
function renderBody(p, opts) {
  const blink = opts.reducedMotion ? '' : 'ks-blink';

  // 单一连续轮廓：从顶到底一条流畅曲线，无颈部收窄。
  // 依据三视图正面：光滑蛋形，侧壁外凸，最宽在下腹约 80% 高度，
  // 随后向内收成圆底（不是平底斗篷），底宽需留出手臂空间。
  const PEAR = 'M120 30'
    + ' C152 30 168 54 172 92'            // 右上：顶部圆润
    + ' C177 126 184 156 184 176'         // 右侧：外凸至最宽（下腹）
    + ' C184 202 158 218 120 218'         // 右下：明显回收成圆臀
    + ' C82 218 56 202 56 176'            // 圆臀 → 左下
    + ' C56 156 63 126 68 92'             // 左侧：外凸
    + ' C72 54 88 30 120 30 Z';           // 左上

  return `
    <!-- 黑色手臂：自身体中段肩点近乎垂直下垂，只与躯干留一条细缝 -->
    <g stroke="${INK}" stroke-linecap="round" fill="none">
      <path d="M62 126 L54 174" stroke-width="14"/>
      <path d="M178 126 L186 174" stroke-width="14"/>
    </g>
    <!-- 连指手套式爪子：末端有可辨的分叉 -->
    <g fill="${INK}">
      <ellipse cx="53" cy="181" rx="10.5" ry="11.5"/>
      <ellipse cx="187" cy="181" rx="10.5" ry="11.5"/>
      <circle cx="46" cy="190" r="4.4"/><circle cx="55" cy="192" r="4.4"/><circle cx="63" cy="188" r="4.4"/>
      <circle cx="194" cy="190" r="4.4"/><circle cx="185" cy="192" r="4.4"/><circle cx="177" cy="188" r="4.4"/>
    </g>

    <!-- 黑色细长直腿 + 向前伸的椭圆脚掌 -->
    <g fill="${INK}">
      <rect x="92" y="210" width="13" height="30" rx="6.5"/>
      <rect x="135" y="210" width="13" height="30" rx="6.5"/>
      <ellipse cx="97" cy="243" rx="15" ry="9"/>
      <ellipse cx="143" cy="243" rx="15" ry="9"/>
    </g>

    <!-- 一体头身：纯白，从耳到底一条连续曲线 -->
    <path class="ks-body" d="${PEAR}" fill="${p.body}"
      stroke="${p.accent}" stroke-width="1" stroke-linejoin="round"/>

    <!-- 宽基三角尖耳：挺立、尖端明确，由头顶轮廓自然延伸 -->
    <path d="M82 52 C74 26 80 6 96 18 C107 26 113 40 117 52 Z"
      fill="${p.body}" stroke="${p.accent}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M158 52 C166 26 160 6 144 18 C133 26 127 40 123 52 Z"
      fill="${p.body}" stroke="${p.accent}" stroke-width="1" stroke-linejoin="round"/>

    <!-- 眼睛：小黑点，左右对称，与鼻球间留白色脸颊 -->
    <g class="${blink}">
      <circle cx="89" cy="94" r="5" fill="${INK}"/>
      <circle cx="151" cy="94" r="5" fill="${INK}"/>
    </g>

    <!-- 黑色鼻球：略宽于高的椭球，居中对称 -->
    <ellipse cx="120" cy="110" rx="24" ry="21" fill="${INK}"/>`;
}

/**
 * 渲染指定形态。
 * @param {string} formId
 * @param {object} opts { reducedMotion, bondColor, silhouette }
 */
export function renderPet(formId, opts = {}) {
  const form = FORM_MAP[formId] || FORM_MAP.origin;
  const p = form.palette;

  // 图鉴未解锁：剪影模式（轮廓同步官方三视图造型）
  if (opts.silhouette) {
    return `<svg viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" class="ks-svg" role="img"
        aria-label="${esc(form.name)}（未解锁）">
      <g fill="#c3cbd4" opacity="0.55">
        <circle cx="56" cy="176" r="15"/>
        <path d="M120 66 C150 66 168 88 170 116 C172 146 180 170 178 184
                 C176 200 152 210 120 210 C88 210 64 200 62 184
                 C60 170 68 146 70 116 C72 88 90 66 120 66 Z"/>
        <path d="M78 86 L68 48 L104 70 Z"/>
        <path d="M162 86 L172 48 L136 70 Z"/>
        <ellipse cx="100" cy="216" rx="15" ry="9"/>
        <ellipse cx="140" cy="216" rx="15" ry="9"/>
        <ellipse cx="120" cy="146" rx="27" ry="22" opacity="0.5"/>
      </g>
      <text x="120" y="124" text-anchor="middle" font-size="34" fill="#8d97a3" opacity="0.85">?</text>
    </svg>`;
  }

  const unders = [];
  const overs = [];
  const hands = [];

  for (const key of form.parts || []) {
    const builder = PARTS[key];
    if (!builder) continue;
    const out = builder(p, opts) || {};
    if (out.under) unders.push(out.under);
    if (out.over) overs.push(out.over);
    // 手持道具：记录手的位置，稍后绘制在道具之上
    if (typeof out.handX === 'number') hands.push(hand(out.handX, out.handY, p.accent));
  }

  const breathe = opts.reducedMotion ? '' : 'ks-breathe';

  return `<svg viewBox="0 0 ${VIEWBOX.w} ${VIEWBOX.h}" class="ks-svg" role="img"
      aria-label="${esc(form.name)}">
    <g class="${breathe}">
      ${unders.join('\n')}
      ${renderBody(p, opts)}
      ${hands.join('\n')}
      ${overs.join('\n')}
    </g>
  </svg>`;
}

/** 图鉴用的小尺寸头像 */
export function renderThumb(formId, unlocked, opts = {}) {
  return renderPet(formId, { ...opts, silhouette: !unlocked, reducedMotion: true });
}
