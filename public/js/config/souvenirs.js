/**
 * 纪念品：纯展示的回忆锚点，不影响属性与好感度。
 */
export const SOUVENIRS = [
  {
    id: 'screw',
    name: '一颗生锈的螺丝',
    from: 'tech',
    fromName: '科技',
    desc: '捡的，我觉得它有故事。',
    icon: '🔩',
    color: '#8fa3b5'
  },
  {
    id: 'ticket',
    name: '半张电影票',
    from: 'art',
    fromName: '艺术',
    desc: '没舍得扔，虽然我看睡着了。',
    icon: '🎟',
    color: '#c77dd4'
  },
  {
    id: 'ginkgo',
    name: '一片压扁的银杏叶',
    from: 'life',
    fromName: '生活',
    desc: '路上捡的，给你。',
    icon: '🍂',
    color: '#e0a35c'
  },
  {
    id: 'sticky',
    name: '写满字的便利贴',
    from: 'work',
    fromName: '职场',
    desc: '有个人类在工位上哭，我陪他坐了一会儿。',
    icon: '📝',
    color: '#5b8c7e'
  },
  {
    id: 'candy',
    name: '一块凉透的糖',
    from: 'emotion',
    fromName: '情感',
    desc: '本来想给你热着的。',
    icon: '🍬',
    color: '#e08a94'
  },
  {
    id: 'coin',
    name: '一枚旧铜钱',
    from: 'history',
    fromName: '历史',
    desc: '摊主说是清朝的，我不信，但我喜欢。',
    icon: '🪙',
    color: '#a8875b'
  }
];

export const SOUVENIR_MAP = Object.fromEntries(SOUVENIRS.map((s) => [s.id, s]));
