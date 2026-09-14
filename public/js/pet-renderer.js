/**
 * 看山形象渲染器（照片版）
 *
 * 形象本体使用官方渲染图，不做任何重绘；
 * 19 种形态的差异通过在照片之上叠加 SVG 道具层实现。
 *
 * 坐标系说明：
 *   所有道具坐标以照片为基准，采用 0~100 的百分比，
 *   与图片尺寸解耦，缩放到任意大小都能对齐。
 *
 * 照片上的关键锚点（实测自 assets/kanshan-full.png）：
 *   头顶      y ≈ 8.4
 *   耳区      x 27 ~ 67
 *   眼        (44.1, 30.0)
 *   黑鼻      (78.7, 29.6)   x 66.5~91.2
 *   左臂      (21.8, 59.1)   末端 y ≈ 70
 *   右臂      (79.4, 61.6)   末端 y ≈ 69
 *   身体最宽  y ≈ 63.3       x 8.3 ~ 83
 *   左脚      (39.3, 83.0)
 *   右脚      (60.6, 83.4)
 */
import { FORM_MAP } from './config/forms.js';

/** 照片资源（按需切换分辨率） */
const PHOTO = {
  sm: 'assets/kanshan-192.png',
  md: 'assets/kanshan-288.png',
  lg: 'assets/kanshan-full.png'
};

/** 动作素材：官方渲染的透明 GIF，用于主页的情境表现 */
export const ANIM = {
  hello: 'assets/anim-hello.gif',
  work:  'assets/anim-work.gif',
  play:  'assets/anim-play.gif',
  doze:  'assets/anim-doze.gif'
};

/** 道具层画布：与照片同比例 */
const VB = { w: 100, h: 143.7 };   // 746 x 1072 → 100 : 143.7

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------------------------------------------------------------- 道具层
// 每个部件返回 SVG 片段，坐标基于 100 x 143.7 的画布。
// under = 画在照片之下（如光环、背景物），over = 画在照片之上（如帽子、服装）。

const PARTS = {
  // ---- 头部 ----
  goggles: (p) => ({ over: `
    <g>
      <rect x="29" y="16.4" width="38" height="6.8" rx="3.4" fill="${p.accent}" opacity=".92"/>
      <circle cx="38.5" cy="19.8" r="5.2" fill="#cfe6f5" stroke="${p.accent}" stroke-width="1.3"/>
      <circle cx="57" cy="19.8" r="5.2" fill="#cfe6f5" stroke="${p.accent}" stroke-width="1.3"/>
      <path d="M43.7 19.8 h8.1" stroke="${p.accent}" stroke-width="1.6"/>
    </g>` }),

  beret: (p) => ({ over: `
    <g>
      <ellipse cx="47" cy="12" rx="30" ry="9.5" fill="${p.accent}"/>
      <ellipse cx="47" cy="10.5" rx="30" ry="9.5" fill="${p.accent}" opacity=".55"/>
      <circle cx="64" cy="4.5" r="3.6" fill="${p.accent}"/>
    </g>` }),

  headphone: (p) => ({ over: `
    <g fill="none" stroke="${p.accent}">
      <path d="M22 26 A26 26 0 0 1 72 26" stroke-width="4"/>
      <rect x="16" y="24" width="9" height="16" rx="4.5" fill="${p.accent}" stroke="none"/>
      <rect x="69" y="24" width="9" height="16" rx="4.5" fill="${p.accent}" stroke="none"/>
    </g>` }),

  visor: (p) => ({ over: `
    <g>
      <path d="M30 22.5 q17 -7 34 0 l0 -4 q-17 -6.5 -34 0 z" fill="${p.glow}" opacity=".9"/>
      <rect x="33" y="18.4" width="11" height="2.4" rx="1.2" fill="${p.accent}" opacity=".9"/>
    </g>` }),

  bookcrown: (p) => ({ over: `
    <g transform="translate(47 9)">
      <rect x="-17" y="-2" width="34" height="5.5" rx="1.2" fill="${p.accent}"/>
      <rect x="-14" y="-7" width="28" height="5.5" rx="1.2" fill="#e0b84c"/>
      <rect x="-10" y="-12" width="20" height="5.5" rx="1.2" fill="${p.accent}"/>
    </g>` }),

  // ---- 眼部表情（叠在照片的眼睛附近）----
  eyebags: () => ({ over: `
    <g stroke="#6e7885" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75">
      <path d="M40 34.5 q4 3.4 8 0"/>
      <path d="M40.5 37 q3.6 2.4 7 0"/>
    </g>` }),

  sleepy: () => ({ over: `
    <g>
      <path d="M40 30 q4 2.6 8 0" stroke="#5c6672" stroke-width="2" fill="none" stroke-linecap="round"/>
      <text x="72" y="16" font-size="8" fill="#a8a0b4" opacity=".85">z</text>
      <text x="80" y="9" font-size="5.5" fill="#a8a0b4" opacity=".6">z</text>
    </g>` }),

  softeyes: () => ({ over: `
    <path d="M39.5 25.5 q4.5 -3.4 9 0" stroke="#6b5b57" stroke-width="1.6"
      fill="none" stroke-linecap="round" opacity=".8"/>` }),

  // ---- 手持道具（左臂末端约 (18,70)，右臂末端约 (81,69)）----
  screwdriver: (p) => ({ over: `
    <g transform="rotate(18 84 70)">
      <rect x="81.5" y="62" width="5" height="14" rx="2" fill="${p.accent}"/>
      <rect x="83" y="75" width="2" height="12" fill="#b9c4cf"/>
    </g>` }),

  brush: (p) => ({ over: `
    <g transform="rotate(16 84 70)">
      <rect x="82.5" y="58" width="3.4" height="18" rx="1.4" fill="#c9a06b"/>
      <path d="M82.5 75 h3.4 l-0.9 6 h-1.6 z" fill="${p.accent}"/>
    </g>` }),

  palette: (p) => ({ over: `
    <g transform="translate(14 73)">
      <ellipse cx="0" cy="0" rx="9.5" ry="7" fill="#f5ead6" stroke="${p.accent}" stroke-width="1.1"/>
      <circle cx="-3.6" cy="-1.8" r="1.7" fill="#e2795f"/>
      <circle cx="0.4" cy="-3.2" r="1.7" fill="#4a90d9"/>
      <circle cx="4.2" cy="-0.9" r="1.7" fill="#e6c65c"/>
    </g>` }),

  thermos: (p) => ({ over: `
    <g transform="translate(84 72)">
      <rect x="-4.6" y="-10" width="9.2" height="20" rx="3" fill="#dfe6ec"
        stroke="${p.accent}" stroke-width="1.1"/>
      <rect x="-4.6" y="-10" width="9.2" height="4" rx="2" fill="${p.accent}"/>
    </g>` }),

  bouquet: (p) => ({ over: `
    <g>
      <path d="M26 50 q21 11 42 0 l1.5 6 q-22 11 -45 0 z" fill="${p.accent}" opacity=".8"/>
      <path d="M66 55 q5 8 3 15 l-6 -1.5 q2 -7 -1 -12 z" fill="${p.accent}" opacity=".7"/>
      <g transform="translate(81 70)">
        <path d="M0 8 L0 0" stroke="#7ba05b" stroke-width="1.3"/>
        <circle cx="-3" cy="-2.4" r="3" fill="${p.accent}"/>
        <circle cx="2.4" cy="-3.6" r="3" fill="#f6c1c8"/>
        <circle cx="0.6" cy="1" r="2.8" fill="#ffe3e6"/>
      </g>
    </g>` }),

  noodle: (p) => ({ over: `
    <g transform="translate(14 74)">
      <path d="M-7 -2.6 h14 l-1.8 9.6 h-10.4 z" fill="#f5ead6"
        stroke="${p.accent}" stroke-width="1.1"/>
      <path d="M-7 -2.6 h14" stroke="${p.accent}" stroke-width="1.6"/>
    </g>` }),

  fan: (p) => ({ over: `
    <g transform="rotate(-14 85 70)">
      <path d="M85 76 L76 60 A11 11 0 0 1 94 60 Z" fill="#f7f0e2"
        stroke="${p.accent}" stroke-width="1"/>
      <path d="M85 76 L85 62 M85 76 L79.5 63 M85 76 L90.5 63"
        stroke="${p.accent}" stroke-width=".7"/>
    </g>` }),

  guitar: (p) => ({ over: `
    <g transform="rotate(-16 85 72)">
      <ellipse cx="85" cy="78" rx="7.6" ry="9.4" fill="#d9a86c"
        stroke="${p.accent}" stroke-width="1"/>
      <circle cx="85" cy="78" r="2.7" fill="#6b4f31"/>
      <rect x="83.2" y="56" width="3.6" height="15" rx="1.4" fill="#8a6440"/>
    </g>` }),

  umbrella: (p) => ({ over: `
    <g>
      <path d="M72 50 A9 9 0 0 1 90 50 Z" fill="#e8dcc4" stroke="${p.accent}" stroke-width="1"/>
      <path d="M72 50 q4.5 3 4.5 0 q4.5 3 4.5 0 q4.5 3 4.5 0"
        stroke="${p.accent}" stroke-width=".7" fill="none"/>
      <path d="M81 50 v22" stroke="#8a6440" stroke-width="1.6"/>
    </g>` }),

  scroll: (p) => ({ over: `
    <g transform="translate(14 74)">
      <rect x="-8" y="-4" width="16" height="9" rx="1.4" fill="#f5ebd8"
        stroke="${p.accent}" stroke-width="1"/>
      <path d="M-5 -1.4 h10 M-5 1.4 h7" stroke="${p.accent}" stroke-width=".6"/>
    </g>` }),

  enamelcup: (p) => ({ over: `
    <g transform="translate(84 73)">
      <rect x="-5.6" y="-7" width="11.2" height="14" rx="1.7" fill="#f4f4ee"
        stroke="${p.accent}" stroke-width="1.1"/>
      <path d="M5.6 -2.6 a3 3 0 0 1 0 6" stroke="${p.accent}" stroke-width="1.1" fill="none"/>
      <path d="M-5.6 -4 h11.2" stroke="#c0392b" stroke-width="1.2"/>
    </g>` }),

  newspaper: (p) => ({ over: `
    <g transform="rotate(-8 14 74)">
      <rect x="6" y="66" width="17" height="13" rx="1" fill="#f2f0e8"
        stroke="${p.accent}" stroke-width=".9"/>
      <path d="M9 70 h11 M9 72.6 h11 M9 75.2 h7" stroke="${p.accent}" stroke-width=".6"/>
    </g>` }),

  clay: (p) => ({ over: `
    <g transform="translate(84 75)">
      <path d="M-6.4 5 q0 -10 6.4 -10 q6.4 0 6.4 10 z" fill="#c98f6b"
        stroke="${p.accent}" stroke-width="1"/>
      <ellipse cx="0" cy="5" rx="6.4" ry="1.7" fill="#a9765a"/>
    </g>` }),

  photo: (p) => ({ over: `
    <g transform="rotate(-10 14 73)">
      <rect x="7" y="66" width="15" height="13" rx="1" fill="#f5f2ec"
        stroke="${p.accent}" stroke-width="1"/>
      <circle cx="14.5" cy="71" r="3" fill="#c9c0b4"/>
      <path d="M9.5 77 q5 -4.2 10 0" fill="#c9c0b4"/>
    </g>` }),

  // ---- 身体服饰（身体最宽处 y≈63，x 8~83）----
  plaid: (p) => ({ over: `
    <g>
      <path d="M24 60 q23 10 46 0 l4 22 q-27 7 -54 0 z" fill="${p.accent}" opacity=".72"/>
      <path d="M38 60 q9 9 18 0 l-9 8 z" fill="#ffffff" opacity=".9"/>
      <path d="M47 68 v14" stroke="#ffffff" stroke-width="1" opacity=".55"/>
      <circle cx="47" cy="73" r=".9" fill="#ffffff" opacity=".7"/>
      <circle cx="47" cy="78" r=".9" fill="#ffffff" opacity=".7"/>
    </g>` }),

  blanket: (p) => ({ over: `
    <path d="M16 62 q31 14 62 0 q1 17 -31 20 q-32 -3 -31 -20 z"
      fill="${p.accent}" opacity=".72"/>` }),

  robe: (p) => ({ over: `
    <g>
      <path d="M19 58 q28 13 56 0 l3 22 q-31 8 -62 0 z" fill="${p.accent}" opacity=".6"/>
      <path d="M47 58 v22" stroke="${p.accent}" stroke-width="1.2" opacity=".8"/>
    </g>` }),

  suit: (p) => ({ over: `
    <g>
      <path d="M21 57 q26 13 52 0 l3 23 q-29 8 -58 0 z" fill="${p.accent}" opacity=".62"/>
      <path d="M47 57 l-6 9 l6 5 l6 -5 z" fill="#fff"/>
      <path d="M47 71 v9" stroke="#c0392b" stroke-width="2.6"/>
    </g>` }),

  apron: (p) => ({ over: `
    <g>
      <path d="M30 57 h34 l4 23 q-21 7 -42 0 z" fill="${p.accent}" opacity=".72"/>
      <path d="M30 57 l-6 -6 M64 57 l6 -6" stroke="${p.accent}" stroke-width="1.4"/>
    </g>` }),

  zhongshan: (p) => ({ over: `
    <g>
      <path d="M20 57 q27 13 54 0 l3 23 q-30 8 -60 0 z" fill="${p.accent}" opacity=".66"/>
      <path d="M47 57 v23" stroke="#5c6650" stroke-width="1"/>
      <circle cx="47" cy="64" r="1.2" fill="#4a5340"/>
      <circle cx="47" cy="72" r="1.2" fill="#4a5340"/>
    </g>` }),

  // ---- 环境 / 氛围 ----
  metal: (p) => ({ over: `
    <g opacity=".45">
      <path d="M22 66 q25 8 50 0" stroke="${p.accent}" stroke-width="1" fill="none"/>
      <circle cx="33" cy="70" r="1.4" fill="${p.accent}"/>
      <circle cx="61" cy="70" r="1.4" fill="${p.accent}"/>
    </g>` }),

  neon: (p) => ({ under: `
    <g opacity=".85">
      <rect x="26" y="11" width="42" height="1.8" rx=".9" fill="${p.accent}"/>
      <rect x="24" y="120" width="46" height="1.8" rx=".9" fill="${p.glow}"/>
    </g>` }),

  mecharm: (p) => ({ over: `
    <g>
      <path d="M80 62 L92 56" stroke="${p.glow}" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="93.5" cy="55" r="3.4" fill="${p.accent}"/>
    </g>` }),

  screens: (p) => ({ under: `
    <g>
      <rect x="1" y="44" width="14" height="11" rx="1.6" fill="#1f2a37"
        stroke="${p.accent}" stroke-width="1"/>
      <rect x="85" y="44" width="14" height="11" rx="1.6" fill="#1f2a37"
        stroke="${p.accent}" stroke-width="1"/>
      <path d="M3 48 h9 M3 51 h6" stroke="${p.glow}" stroke-width=".7"/>
      <path d="M87 48 h9 M87 51 h6" stroke="${p.glow}" stroke-width=".7"/>
    </g>` }),

  smoke: () => ({ over: `
    <g opacity=".55">
      <circle cx="72" cy="18" r="2.6" fill="#c7ced6"/>
      <circle cx="78" cy="12" r="3.4" fill="#d4dae1"/>
      <circle cx="73" cy="6" r="4.2" fill="#e1e6eb"/>
    </g>` }),

  keyboard: (p) => ({ over: `
    <g transform="translate(47 96)">
      <rect x="-19" y="-4" width="38" height="9" rx="2" fill="#e8edf3"
        stroke="${p.accent}" stroke-width="1"/>
      <path d="M-14 -1 h28 M-14 1.8 h21" stroke="${p.accent}" stroke-width=".6"/>
    </g>` }),

  snacks: (p) => ({ over: `
    <g>
      <rect x="2" y="86" width="10" height="14" rx="2" fill="${p.accent}" opacity=".88"/>
      <rect x="86" y="88" width="9" height="12" rx="2" fill="#e2795f" opacity=".88"/>
    </g>` }),

  slippers: (p) => ({ over: `
    <g>
      <ellipse cx="39" cy="91" rx="9" ry="4" fill="${p.accent}" opacity=".9"/>
      <ellipse cx="61" cy="91.5" rx="9" ry="4" fill="${p.accent}" opacity=".9"/>
    </g>` }),

  pillow: (p) => ({ under: `
    <g transform="rotate(-12 12 78)">
      <rect x="2" y="70" width="20" height="17" rx="5" fill="${p.accent}" opacity=".8"/>
    </g>` }),

  inkstroke: (p) => ({ under: `
    <g opacity=".3">
      <path d="M12 96 q8 -14 14 -26" stroke="${p.accent}" stroke-width="2"
        fill="none" stroke-linecap="round"/>
      <path d="M84 100 q-7 -12 -12 -22" stroke="${p.accent}" stroke-width="1.5"
        fill="none" stroke-linecap="round"/>
    </g>` }),

  beard: () => ({ over: `
    <path d="M38 40 q9 6 18 0 q-3 12 -9 14 q-6 -2 -9 -14 z"
      fill="#e8e2d6" stroke="#c9c0ae" stroke-width=".8" opacity=".92"/>` }),

  lookup: () => ({ over: `
    <path d="M40 24 q4 -3 8 0" stroke="#5b5470" stroke-width="1.4"
      fill="none" stroke-linecap="round" opacity=".8"/>` }),

  grayscale: () => ({ filter: 'grayscale(.55)' }),

  fullglow: (p) => ({ under: `
    <g fill="none">
      <ellipse cx="47" cy="66" rx="47" ry="60" stroke="${p.glow}"
        stroke-width="2.4" opacity=".75" class="ks-pulse"/>
      <ellipse cx="47" cy="66" rx="53" ry="68" stroke="${p.glow}"
        stroke-width="1.4" opacity=".45"/>
    </g>` }),

  bondhalo: (p, opts) => ({ under: `
    <defs>
      <radialGradient id="ksBondGlow">
        <stop offset="62%" stop-color="${opts.bondColor || p.accent}" stop-opacity="0"/>
        <stop offset="88%" stop-color="${opts.bondColor || p.accent}" stop-opacity=".34"/>
        <stop offset="100%" stop-color="${opts.bondColor || p.accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="47" cy="66" rx="56" ry="72" fill="url(#ksBondGlow)"/>
    <g fill="none">
      <ellipse cx="47" cy="66" rx="46" ry="59" stroke="${opts.bondColor || p.accent}"
        stroke-width="3.2" opacity=".85" class="ks-pulse"/>
      <ellipse cx="47" cy="66" rx="52" ry="67" stroke="${opts.bondColor || p.glow}"
        stroke-width="1.8" opacity=".55"/>
    </g>` }),

  bondthread: (p, opts) => ({ over: `
    <path d="M84 74 Q95 96 100 118" stroke="${opts.bondColor || p.accent}"
      stroke-width=".9" fill="none" opacity=".4" stroke-dasharray="2.4 3.4"/>` })
};

// ---------------------------------------------------------------- 渲染

/**
 * 渲染指定形态：照片本体 + 差异化道具层
 * @param {string} formId
 * @param {object} opts { reducedMotion, bondColor, silhouette, size }
 */
export function renderPet(formId, opts = {}) {
  const form = FORM_MAP[formId] || FORM_MAP.origin;
  const p = form.palette;

  // 图鉴未解锁：照片压暗成剪影
  if (opts.silhouette) {
    return `<div class="ks-photo ks-photo-locked" role="img"
        aria-label="${esc(form.name)}（未解锁）">
      <img src="${PHOTO.sm}" alt="" draggable="false">
      <span class="ks-lock">?</span>
    </div>`;
  }

  const unders = [];
  const overs = [];
  let filter = '';

  for (const key of form.parts || []) {
    const build = PARTS[key];
    if (!build) continue;
    const out = build(p, opts) || {};
    if (out.under) unders.push(out.under);
    if (out.over) overs.push(out.over);
    if (out.filter) filter = out.filter;
  }

  // opts.anim 指定动作时改用 GIF（道具层照常叠加）
  const src = opts.anim && ANIM[opts.anim]
    ? ANIM[opts.anim]
    : (opts.size === 'sm' ? PHOTO.sm : PHOTO.md);
  const breathe = opts.reducedMotion ? '' : ' ks-breathe';
  const layer = (content, cls) => content.length
    ? `<svg class="${cls}" viewBox="0 0 ${VB.w} ${VB.h}" aria-hidden="true">${content.join('\n')}</svg>`
    : '';

  return `<div class="ks-photo${breathe}" role="img" aria-label="${esc(form.name)}"
      ${filter ? `style="filter:${filter}"` : ''}>
    ${layer(unders, 'ks-layer ks-layer-under')}
    <img src="${src}" alt="" draggable="false">
    ${layer(overs, 'ks-layer ks-layer-over')}
  </div>`;
}

/** 图鉴缩略图 */
export function renderThumb(formId, unlocked, opts = {}) {
  return renderPet(formId, {
    ...opts, silhouette: !unlocked, reducedMotion: true, size: 'sm'
  });
}

/** 兼容旧接口 */
export const VIEWBOX = VB;
