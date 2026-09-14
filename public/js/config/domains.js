/**
 * 领域与属性配置
 * 8 个知识领域 -> 6 项属性的映射，集中在此，不散落在组件中。
 */

export const ATTRIBUTES = [
  { key: 'tech', name: '科技', color: '#4a90d9' },
  { key: 'art', name: '艺术', color: '#c77dd4' },
  { key: 'work', name: '职场', color: '#5b8c7e' },
  { key: 'emotion', name: '情感', color: '#e08a94' },
  { key: 'life', name: '生活', color: '#e0a35c' },
  { key: 'history', name: '历史', color: '#a8875b' }
];

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

export const DOMAINS = [
  {
    key: 'tech',
    name: '科技',
    attribute: 'tech',
    color: '#4a90d9',
    icon: '🛰',
    desc: '前沿、争论和一堆看不懂的缩写',
    todayTitle: '大模型到底有没有在“理解”？'
  },
  {
    key: 'digital',
    name: '数码',
    attribute: 'tech',
    color: '#5aa9e6',
    icon: '🎧',
    desc: '参数、手感和永远买不完的小玩意',
    todayTitle: '为什么用久了的设备反而更顺手？'
  },
  {
    key: 'history',
    name: '历史',
    attribute: 'history',
    color: '#a8875b',
    icon: '📜',
    desc: '旧时间里那些没讲完的事',
    todayTitle: '古人如何度过一个普通的下午？'
  },
  {
    key: 'work',
    name: '职场',
    attribute: 'work',
    color: '#5b8c7e',
    icon: '💼',
    desc: '打工人的自救与互救现场',
    todayTitle: '汇报时如何让人一句话听懂你？'
  },
  {
    key: 'emotion',
    name: '情感',
    attribute: 'emotion',
    color: '#e08a94',
    icon: '💌',
    desc: '难开口的部分，都在这里',
    todayTitle: '为什么亲近的人反而更难沟通？'
  },
  {
    key: 'life',
    name: '生活',
    attribute: 'life',
    color: '#e0a35c',
    icon: '🪴',
    desc: '把日子过顺的一百个小窍门',
    todayTitle: '如何用十分钟让房间变得清爽？'
  },
  {
    key: 'art',
    name: '艺术',
    attribute: 'art',
    color: '#c77dd4',
    icon: '🎨',
    desc: '好看、难懂，但忍不住多看两眼',
    todayTitle: '看不懂的当代艺术该怎么欣赏？'
  },
  {
    key: 'food',
    name: '美食',
    attribute: 'life',
    color: '#e2795f',
    icon: '🍜',
    desc: '深夜最不该点开的那一栏',
    todayTitle: '为什么家里做的总比外面香？'
  }
];

export const DOMAIN_MAP = Object.fromEntries(DOMAINS.map((d) => [d.key, d]));

/** 每次阅读的产出 */
export const READ_REWARD = { attribute: 10, affinity: 3 };

/** 看山对领域的立场：读到不喜欢的会嘟囔，但仍然完成喂养 */
export const DOMAIN_ATTITUDE = {
  tech: 'like',
  digital: 'like',
  history: 'neutral',
  work: 'dislike',
  emotion: 'neutral',
  life: 'like',
  art: 'like',
  food: 'love'
};

export const DOMAIN_REACTIONS = {
  love: ['这个我爱看！先收藏了。', '等等，看完我有点饿了。', '好家伙，这段我要背下来。'],
  like: ['嗯……这个有意思。', '行，这篇值得。', '我记下了，回头跟乌龟显摆一下。'],
  neutral: ['读完了。还行吧。', '嗯，知道了。', '这个我得再想想。'],
  dislike: ['又是职场……行吧。', '唉，看在是你的份上。', '读是读了，但我不想聊这个。']
};
