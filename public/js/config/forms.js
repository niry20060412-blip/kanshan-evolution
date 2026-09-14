/**
 * 18 种形态配置 + 进化规则
 *
 * 规则可解释、可配置：
 *  1. 羁绊看山：好感度 >= 1000 且 六项属性总和 >= ENDGAME_TOTAL（隐藏终点）
 *  2. 百科全书看山：六项属性均 >= BALANCE_MIN 且 极差 <= BALANCE_SPREAD（全属性均衡）
 *  3. 组合形态：最高属性 + 次高属性，且两者均 >= DUAL_MIN，次高/最高 >= DUAL_RATIO
 *  4. 主导形态：最高属性 >= SOLO_MIN
 *  5. 初生态：以上都不满足
 */

export const EVOLUTION_THRESHOLDS = {
  SOLO_MIN: 50,        // 触发单属性主导形态的最低值
  DUAL_MIN: 60,        // 组合形态要求两项属性都不低于此值
  DUAL_RATIO: 0.6,     // 次高/最高 >= 该比例才算“组合”而非“主导”
  BALANCE_MIN: 80,     // 均衡形态要求每项都不低于此值
  BALANCE_SPREAD: 40,  // 均衡形态允许的最大极差
  ENDGAME_AFFINITY: 1000,
  ENDGAME_TOTAL: 600
};

/** 初生态：光秃秃的小白球 */
export const BASE_FORM = {
  id: 'origin',
  name: '初生看山',
  shortName: '初生',
  rarity: 'common',
  type: 'base',
  persona: '刚睁眼没多久，话不多，对什么都要先看三秒。',
  motto: '我还没想好要变成什么。',
    voiceStyle: ['……', '嗯。', '我还在看。', '这个我还不懂。'],
  condition: '领养即获得',
  palette: { body: '#ffffff', accent: '#d8e4ef', glow: '#eef4fa' },
  parts: []
};

export const FORMS = [
  // ---- 单属性主导（6）----
  {
    id: 'engineer',
    name: '机械工程师看山',
    shortName: '机械工程师',
    rarity: 'common',
    type: 'solo',
    primary: 'tech',
    persona: '说话像写文档，凡事先问“它怎么转起来的”。有点轴。',
    motto: '能修，就不该扔。',
    voiceStyle: ['这个结构挺合理的。', '拆开看就明白了。', '能修，就不该扔。', '先搞清楚它怎么转的。'],
    condition: '科技 ≥ 50 且领先',
    palette: { body: '#dfe6ec', accent: '#8fa3b5', glow: '#b9cfe4' },
    parts: ['goggles', 'screwdriver', 'metal']
  },
  {
    id: 'painter',
    name: '画家看山',
    shortName: '画家',
    rarity: 'common',
    type: 'solo',
    primary: 'art',
    persona: '看什么都先看颜色，说话跳跃，经常说到一半去看窗外。',
    motto: '这个灰里有紫，你看不出来吗。',
    voiceStyle: ['这个颜色有点意思。', '你看那边的光。', '我刚才走神了，在看窗外。', '灰里有紫，真的。'],
    condition: '艺术 ≥ 50 且领先',
    palette: { body: '#fdf6ff', accent: '#c77dd4', glow: '#e9c9f2' },
    parts: ['beret', 'brush', 'palette']
  },
  {
    id: 'worker',
    name: '社畜看山',
    shortName: '社畜',
    rarity: 'common',
    type: 'solo',
    primary: 'work',
    persona: '累。语气里带着长期睡不够的沙哑，但还是会陪你说话。',
    motto: '再五分钟，我就去睡。',
    voiceStyle: ['累。', '再五分钟我就去睡。', '今天会开到很晚。', '先别说话，让我缓缓。'],
    condition: '职场 ≥ 50 且领先',
    palette: { body: '#eceff2', accent: '#5b8c7e', glow: '#c6d8d1' },
    parts: ['plaid', 'thermos', 'eyebags']
  },
  {
    id: 'warm',
    name: '暖男看山',
    shortName: '暖男',
    rarity: 'common',
    type: 'solo',
    primary: 'emotion',
    persona: '会先问你今天怎么样，再讲自己的事。眼神是软的。',
    motto: '你先说，我听着。',
    voiceStyle: ['你今天怎么样？', '你先说，我听着。', '别急，慢慢讲。', '辛苦了。'],
    condition: '情感 ≥ 50 且领先',
    palette: { body: '#fff6f6', accent: '#e08a94', glow: '#f6d3d7' },
    parts: ['bouquet', 'softeyes']
  },
  {
    id: 'homebody',
    name: '居家看山',
    shortName: '居家',
    rarity: 'common',
    type: 'solo',
    primary: 'life',
    persona: '语速慢，随时准备躺下。对“出门”这件事有意见。',
    motto: '外面有什么好的，家里就有泡面。',
    voiceStyle: ['不想动。', '家里就挺好。', '泡面已经泡上了。', '出门？再说吧。'],
    condition: '生活 ≥ 50 且领先',
    palette: { body: '#fff9f0', accent: '#e0a35c', glow: '#f5e0c0' },
    parts: ['blanket', 'slippers', 'noodle']
  },
  {
    id: 'storyteller',
    name: '说书人看山',
    shortName: '说书人',
    rarity: 'common',
    type: 'solo',
    primary: 'history',
    persona: '讲什么都要先铺垫三句，爱停顿，爱卖关子。',
    motto: '此事说来话长——你坐。',
    voiceStyle: ['此事说来话长——', '你先坐。', '且听我慢慢道来。', '这里头有个讲究。'],
    condition: '历史 ≥ 50 且领先',
    palette: { body: '#faf4e8', accent: '#a8875b', glow: '#e4d3b4' },
    parts: ['robe', 'fan', 'beard']
  },

  // ---- 双属性组合（10）----
  {
    id: 'cyber_artist',
    name: '赛博朋克艺术家看山',
    shortName: '赛博朋克艺术家',
    rarity: 'rare',
    type: 'dual',
    primary: 'tech',
    secondary: 'art',
    persona: '亢奋、跳脱，半句话里能拐三个弯，喜欢用很怪的比喻。',
    motto: '霓虹是这个时代唯一诚实的颜色。',
    voiceStyle: ['霓虹是这个时代唯一诚实的颜色。', '这个念头像电流一样窜过去了。', '等等，我刚想到个更怪的比喻。', '信号有点乱，但很带感。'],
    condition: '科技 + 艺术 双高',
    palette: { body: '#2b2740', accent: '#ff5fa2', glow: '#5ef0ff' },
    parts: ['neon', 'mecharm', 'visor']
  },
  {
    id: 'work_warm',
    name: '职场暖男看山',
    shortName: '职场暖男',
    rarity: 'rare',
    type: 'dual',
    primary: 'work',
    secondary: 'emotion',
    persona: '疲惫但体面，会在你说完之后停半拍再回应。',
    motto: '先喝口热的，再说难的。',
    voiceStyle: ['先喝口热的，再说难的。', '我停半拍，想想怎么说。', '这事我懂，真的。', '别硬扛。'],
    condition: '职场 + 情感 双高',
    palette: { body: '#f2f4f6', accent: '#7a8fa6', glow: '#d6dfe8' },
    parts: ['suit', 'thermos', 'softeyes']
  },
  {
    id: 'code_grinder',
    name: '卷王程序员看山',
    shortName: '卷王程序员',
    rarity: 'rare',
    type: 'dual',
    primary: 'tech',
    secondary: 'work',
    persona: '语速快、句子短，经常说到一半去改一个 bug。',
    motto: '它昨天还是好的。',
    voiceStyle: ['它昨天还是好的。', '等我改完这个 bug。', '复现不了就不算 bug。', '先跑起来再说。'],
    condition: '科技 + 职场 双高',
    palette: { body: '#e6ebf0', accent: '#3f6fa8', glow: '#a8c4e0' },
    parts: ['screens', 'smoke', 'eyebags']
  },
  {
    id: 'artsy_youth',
    name: '文艺青年看山',
    shortName: '文艺青年',
    rarity: 'rare',
    type: 'dual',
    primary: 'art',
    secondary: 'emotion',
    persona: '爱用书面词，容易感伤，说完会补一句“算了没什么”。',
    motto: '有些话适合配着雨说。',
    voiceStyle: ['有些话适合配着雨说。', '算了，没什么。', '我又开始感伤了。', '这话听着像首诗。'],
    condition: '艺术 + 情感 双高',
    palette: { body: '#f7f3fb', accent: '#9b8fd4', glow: '#d8d0f0' },
    parts: ['guitar', 'headphone', 'lookup']
  },
  {
    id: 'shutin',
    name: '家里蹲看山',
    shortName: '家里蹲',
    rarity: 'rare',
    type: 'dual',
    primary: 'life',
    secondary: 'emotion',
    persona: '半梦半醒，说话含糊，但你一走就会问“去哪”。',
    motto: '再抱一会儿，就一会儿。',
    voiceStyle: ['再抱一会儿，就一会儿。', '你要去哪？', '别走那么快。', '唔……我还没睡醒。'],
    condition: '生活 + 情感 双高',
    palette: { body: '#fff7f4', accent: '#d9a3a3', glow: '#f2dcd6' },
    parts: ['pillow', 'sleepy']
  },
  {
    id: 'scholar',
    name: '古风书生看山',
    shortName: '古风书生',
    rarity: 'rare',
    type: 'dual',
    primary: 'history',
    secondary: 'art',
    persona: '讲话带古意，爱引用，偶尔文绉绉到自己都笑场。',
    motto: '雨落纸伞，字要慢写。',
    voiceStyle: ['雨落纸伞，字要慢写。', '古人诚不我欺。', '此中有真意。', '容我引一句。'],
    condition: '历史 + 艺术 双高',
    palette: { body: '#f6f2e9', accent: '#6b7f6e', glow: '#d9dfd0' },
    parts: ['inkstroke', 'umbrella', 'scroll']
  },
  {
    id: 'geek',
    name: '极客宅看山',
    shortName: '极客宅',
    rarity: 'rare',
    type: 'dual',
    primary: 'tech',
    secondary: 'life',
    persona: '兴奋起来能连说八句，嘴里经常含着零食。',
    motto: '这个外设我等了三个月。',
    voiceStyle: ['这个外设我等了三个月。', '参数我背下来了。', '你听我说完这段！', '嘴里还含着零食，等一下。'],
    condition: '科技 + 生活 双高',
    palette: { body: '#eef1f7', accent: '#6a7fd4', glow: '#c3cdf0' },
    parts: ['keyboard', 'snacks']
  },
  {
    id: 'veteran',
    name: '老干部看山',
    shortName: '老干部',
    rarity: 'rare',
    type: 'dual',
    primary: 'history',
    secondary: 'work',
    persona: '语调平稳，爱用总结句，一开口就像在作报告。',
    motto: '这个事嘛，要辩证地看。',
    voiceStyle: ['这个事嘛，要辩证地看。', '总的来说。', '我谈三点。', '同志，坐下说。'],
    condition: '历史 + 职场 双高',
    palette: { body: '#eef0ea', accent: '#7c8a6b', glow: '#d2dac4' },
    parts: ['zhongshan', 'enamelcup', 'newspaper']
  },
  {
    id: 'craft',
    name: '手作看山',
    shortName: '手作',
    rarity: 'rare',
    type: 'dual',
    primary: 'art',
    secondary: 'life',
    persona: '手上永远在忙，说话断断续续，但很踏实。',
    motto: '慢一点，它才不会裂。',
    voiceStyle: ['慢一点，它才不会裂。', '手上正忙着。', '这个接缝还得磨。', '等我收个尾。'],
    condition: '艺术 + 生活 双高',
    palette: { body: '#fdf5ec', accent: '#c98f6b', glow: '#eed7c2' },
    parts: ['apron', 'clay']
  },
  {
    id: 'nostalgia',
    name: '怀旧看山',
    shortName: '怀旧',
    rarity: 'rare',
    type: 'dual',
    primary: 'history',
    secondary: 'emotion',
    persona: '说话很慢，句子之间留白多，常常忽然不说了。',
    motto: '那天的光，跟今天有点像。',
    voiceStyle: ['那天的光，跟今天有点像。', '……', '好久没想起这个了。', '以前不是这样的。'],
    condition: '历史 + 情感 双高',
    palette: { body: '#f0eeea', accent: '#9a9186', glow: '#d8d2c8' },
    parts: ['photo', 'grayscale']
  },

  // ---- 超稀有 / 终点（2）----
  {
    id: 'encyclopedia',
    name: '百科全书看山',
    shortName: '百科全书',
    rarity: 'legendary',
    type: 'balance',
    persona: '什么都能接上一句，偶尔因为知道太多而显得有点寂寞。',
    motto: '我知道，但我更想听你说。',
    voiceStyle: ['我知道，但我更想听你说。', '这个有三种解释。', '严格来说不完全对。', '补充一句。'],
    condition: '六项属性 ≥ 80 且均衡',
    palette: { body: '#fffdf2', accent: '#e6c65c', glow: '#fff0b0' },
    parts: ['bookcrown', 'fullglow']
  },
  {
    id: 'bond',
    name: '羁绊看山',
    shortName: '羁绊',
    rarity: 'legendary',
    type: 'endgame',
    persona: '不再需要客套，会直接说“我在”。语气里有把你放在心上的笃定。',
    motto: '你回来了。',
    voiceStyle: ['我在。', '你回来了。', '不用解释。', '我一直听着门口。'],
    condition: '好感度 ≥ 1000 且总属性 ≥ 600',
    hidden: true,
    palette: { body: '#ffffff', accent: '#e8b4c8', glow: '#ffd6e8' },
    parts: ['bondhalo', 'bondthread']
  }
];

export const ALL_FORMS = [BASE_FORM, ...FORMS];
export const FORM_MAP = Object.fromEntries(ALL_FORMS.map((f) => [f.id, f]));

export const RARITY_LABEL = {
  common: '普通',
  rare: '稀有',
  legendary: '传说'
};

/** 根据属性与好感度判定当前形态 id */
export function resolveForm(attrs, affinity = 0) {
  const T = EVOLUTION_THRESHOLDS;
  const entries = Object.entries(attrs).filter(([k]) =>
    ['tech', 'art', 'work', 'emotion', 'life', 'history'].includes(k)
  );
  const values = entries.map(([, v]) => Number(v) || 0);
  const total = values.reduce((a, b) => a + b, 0);

  // 1. 隐藏终点
  if (affinity >= T.ENDGAME_AFFINITY && total >= T.ENDGAME_TOTAL) return 'bond';

  // 2. 全属性均衡
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= T.BALANCE_MIN && max - min <= T.BALANCE_SPREAD) return 'encyclopedia';

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [firstKey, firstVal] = sorted[0];
  const [secondKey, secondVal] = sorted[1] || [null, 0];

  // 3. 双属性组合
  if (
    firstVal >= T.DUAL_MIN &&
    secondVal >= T.DUAL_MIN &&
    secondVal / firstVal >= T.DUAL_RATIO
  ) {
    const dual = FORMS.find(
      (f) =>
        f.type === 'dual' &&
        ((f.primary === firstKey && f.secondary === secondKey) ||
          (f.primary === secondKey && f.secondary === firstKey))
    );
    if (dual) return dual.id;
  }

  // 4. 单属性主导
  if (firstVal >= T.SOLO_MIN) {
    const solo = FORMS.find((f) => f.type === 'solo' && f.primary === firstKey);
    if (solo) return solo.id;
  }

  // 5. 初生态
  return 'origin';
}
