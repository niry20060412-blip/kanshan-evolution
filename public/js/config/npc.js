/**
 * 朋友系统：看山自己的社交圈，用户只是旁观者。
 * 用随机事件表实现，不做好友列表 / 聊天室 / 关系图谱。
 */

export const NPCS = [
  {
    id: 'hamster',
    name: '加班仓鼠',
    icon: '🐹',
    color: '#e0a35c',
    persona: '永远在赶 deadline',
    catchphrase: '再五分钟就好了。',
    lines: [
      '再五分钟就好了。',
      '我不是在拖，我是在等灵感——好吧我是在拖。',
      '你也还没睡？那我就不算最惨的。'
    ],
    meetLines: [
      '路上碰见仓鼠了，它说再五分钟就交稿，我等了它四十分钟。',
      '仓鼠today又在赶 deadline，我陪它坐了一会儿，它一个字没写。'
    ]
  },
  {
    id: 'turtle',
    name: '哲学乌龟',
    icon: '🐢',
    color: '#5b8c7e',
    persona: '行动很慢，喜欢问终极问题',
    catchphrase: '那你说，什么是自由？',
    lines: [
      '那你说，什么是自由？',
      '我想了三天，还是没想明白。不过不着急。',
      '慢一点没关系，反正路一直都在。'
    ],
    meetLines: [
      '今天碰到乌龟了，它又问我什么是自由，我说是不用出门，它好像被冒犯了。',
      '乌龟今天问我“你为什么要回家”，我没答上来，其实我是想你了。'
    ]
  },
  {
    id: 'parrot',
    name: '热榜鹦鹉',
    icon: '🦜',
    color: '#e2795f',
    persona: '只会复读当天热榜',
    catchphrase: '今天第三条！今天第三条！',
    lines: [
      '今天第三条！今天第三条！',
      '热榜第一！热榜第一！——别问我讲的什么，我没点进去。',
      '这个我刷到过！这个我刷到过！'
    ],
    meetLines: [
      '鹦鹉今天一直在喊“今天第三条”，喊了一路，我到现在耳朵还嗡嗡的。',
      '遇到鹦鹉了，它复读了一整条热榜，但它自己没看懂。'
    ]
  },
  {
    id: 'hedgehog',
    name: '美食刺猬',
    icon: '🦔',
    color: '#c98f6b',
    persona: '对所有食物都有意见',
    catchphrase: '这个不够辣。',
    lines: [
      '这个不够辣。',
      '火候差三秒，差三秒你知道吗。',
      '还行吧——这是我最高评价了。'
    ],
    meetLines: [
      '刺猬今天尝了五家店，每家都说“这个不够辣”，我觉得它舌头坏了。',
      '和刺猬吃了顿饭，它点评了四十分钟，我一口没吃上。'
    ]
  },
  {
    id: 'owl',
    name: '失眠猫头鹰',
    icon: '🦉',
    color: '#7c8a9b',
    persona: '只在深夜出现',
    catchphrase: '你也睡不着啊。',
    nightOnly: true,
    lines: [
      '你也睡不着啊。',
      '夜里的事想起来都特别重，白天就轻了。别怕。',
      '我陪你坐会儿，不说话也行。'
    ],
    meetLines: [
      '深夜碰到猫头鹰了，它说“你也睡不着啊”，我们就一起坐着没说话。',
      '猫头鹰今晚又在天台，它说夜里想事情容易想深，让我早点回来。'
    ]
  }
];

export const NPC_MAP = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** 相遇 / 登门概率（随机事件表） */
export const NPC_RULES = {
  meetChance: 0.55,       // 外出时遇到 NPC 的概率
  visitChance: 0.3,       // 好感度 >= 300 后，NPC 跟回家的概率
  visitMinAffinity: 300,
  visitDurationMs: 60 * 60 * 1000, // 停留 1 小时
  nightOwlBonus: 0.35     // 深夜时段猫头鹰额外权重
};

export function pickNpc(isNight) {
  const pool = NPCS.filter((n) => (n.nightOnly ? isNight : true));
  if (isNight) {
    const owl = NPCS.find((n) => n.id === 'owl');
    if (owl && Math.random() < NPC_RULES.nightOwlBonus) return owl;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
