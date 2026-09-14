/**
 * 规则回归测试（零依赖，node tests/rules.test.mjs）
 * 覆盖：进化判定、好感度阶段、阶段不回退、衰减、外出结算去重、泡泡配比。
 */
import assert from 'node:assert/strict';
import { resolveForm, ALL_FORMS, FORMS } from '../public/js/config/forms.js';
import {
  getStage, getEffectiveStage, resolveAddress, AFFINITY_STAGES, BUBBLE_MIX
} from '../public/js/config/affinity.js';
import { DOMAINS, ATTRIBUTES } from '../public/js/config/domains.js';
import { SOUVENIRS } from '../public/js/config/souvenirs.js';
import { NPCS } from '../public/js/config/npc.js';
import { OUTING_CORPUS, DIALOGUE_CORPUS, BUBBLE_CORPUS } from '../public/js/config/corpus.js';
import { extractMemory } from '../public/js/game.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

const zero = { tech: 0, art: 0, work: 0, emotion: 0, life: 0, history: 0 };
const attrs = (patch) => ({ ...zero, ...patch });

console.log('\n[配置完整性]');

test('形态总数为 19（初生态 + 18 种）', () => {
  assert.equal(ALL_FORMS.length, 19);
  assert.equal(FORMS.length, 18);
});

test('18 种形态 id 唯一且均有解锁条件与性格', () => {
  const ids = new Set();
  for (const f of ALL_FORMS) {
    assert.ok(!ids.has(f.id), `重复 id: ${f.id}`);
    ids.add(f.id);
    assert.ok(f.name && f.condition && f.persona, `${f.id} 缺少必要字段`);
    assert.ok(f.palette && f.palette.body, `${f.id} 缺少配色`);
  }
});

test('8 个领域全部映射到 6 项属性之一', () => {
  assert.equal(DOMAINS.length, 8);
  const keys = ATTRIBUTES.map((a) => a.key);
  assert.equal(keys.length, 6);
  for (const d of DOMAINS) {
    assert.ok(keys.includes(d.attribute), `${d.key} 映射非法`);
    assert.ok(d.todayTitle && d.icon && d.color && d.desc, `${d.key} 缺少展示字段`);
  }
});

test('领域映射符合需求表', () => {
  const expect = {
    tech: 'tech', digital: 'tech', history: 'history', work: 'work',
    emotion: 'emotion', life: 'life', food: 'life', art: 'art'
  };
  for (const d of DOMAINS) assert.equal(d.attribute, expect[d.key], `${d.key} 映射错误`);
});

test('语料数量满足下限（见闻 20 / 对话 30 / 泡泡 60）', () => {
  assert.ok(OUTING_CORPUS.length >= 20, `见闻仅 ${OUTING_CORPUS.length} 条`);
  const dialogue = Object.values(DIALOGUE_CORPUS).reduce((a, b) => a + b.length, 0);
  assert.ok(dialogue >= 30, `对话仅 ${dialogue} 条`);
  const bubbles = Object.values(BUBBLE_CORPUS).reduce((a, b) => a + b.length, 0);
  assert.ok(bubbles >= 60, `泡泡仅 ${bubbles} 条`);
});

test('见闻语料结尾必须是反问', () => {
  for (const c of OUTING_CORPUS) {
    assert.ok(c.text.trim().endsWith('？'), `未以问号结尾: ${c.text.slice(0, 20)}`);
  }
});

test('6 件纪念品与 5 个 NPC 齐备', () => {
  assert.equal(SOUVENIRS.length, 6);
  assert.equal(NPCS.length, 5);
  for (const n of NPCS) {
    assert.ok(n.catchphrase && n.lines.length && n.meetLines.length, `${n.id} 缺少台词`);
  }
});

console.log('\n[进化判定]');

test('零属性时为初生态', () => {
  assert.equal(resolveForm(zero, 0), 'origin');
});

test('单属性主导 → 对应 solo 形态', () => {
  assert.equal(resolveForm(attrs({ tech: 60 }), 0), 'engineer');
  assert.equal(resolveForm(attrs({ art: 60 }), 0), 'painter');
  assert.equal(resolveForm(attrs({ work: 60 }), 0), 'worker');
  assert.equal(resolveForm(attrs({ emotion: 60 }), 0), 'warm');
  assert.equal(resolveForm(attrs({ life: 60 }), 0), 'homebody');
  assert.equal(resolveForm(attrs({ history: 60 }), 0), 'storyteller');
});

test('低于 solo 阈值不触发进化', () => {
  assert.equal(resolveForm(attrs({ tech: 40 }), 0), 'origin');
});

test('双属性组合 → 对应 dual 形态', () => {
  assert.equal(resolveForm(attrs({ tech: 80, art: 70 }), 0), 'cyber_artist');
  assert.equal(resolveForm(attrs({ work: 80, emotion: 70 }), 0), 'work_warm');
  assert.equal(resolveForm(attrs({ tech: 80, work: 70 }), 0), 'code_grinder');
  assert.equal(resolveForm(attrs({ art: 80, emotion: 70 }), 0), 'artsy_youth');
  assert.equal(resolveForm(attrs({ life: 80, emotion: 70 }), 0), 'shutin');
  assert.equal(resolveForm(attrs({ history: 80, art: 70 }), 0), 'scholar');
  assert.equal(resolveForm(attrs({ tech: 80, life: 70 }), 0), 'geek');
  assert.equal(resolveForm(attrs({ history: 80, work: 70 }), 0), 'veteran');
  assert.equal(resolveForm(attrs({ art: 80, life: 70 }), 0), 'craft');
  assert.equal(resolveForm(attrs({ history: 80, emotion: 70 }), 0), 'nostalgia');
});

test('次高属性占比不足时退回主导形态', () => {
  // 次高/最高 = 30/100 = 0.3 < 0.6
  assert.equal(resolveForm(attrs({ tech: 100, art: 30 }), 0), 'engineer');
});

test('全部 10 种双属性组合均可被判定到', () => {
  const duals = FORMS.filter((f) => f.type === 'dual');
  assert.equal(duals.length, 10);
  for (const f of duals) {
    const got = resolveForm(attrs({ [f.primary]: 90, [f.secondary]: 70 }), 0);
    assert.equal(got, f.id, `${f.id} 无法命中，实际 ${got}`);
  }
});

test('全属性均衡 → 百科全书看山', () => {
  assert.equal(resolveForm(
    attrs({ tech: 90, art: 90, work: 90, emotion: 90, life: 90, history: 90 }), 0
  ), 'encyclopedia');
});

test('属性高但不均衡时不会误判为百科全书', () => {
  const got = resolveForm(
    attrs({ tech: 200, art: 80, work: 80, emotion: 80, life: 80, history: 80 }), 0
  );
  assert.notEqual(got, 'encyclopedia');
});

test('羁绊看山需同时满足高好感与高属性', () => {
  const high = attrs({ tech: 100, art: 100, work: 100, emotion: 100, life: 100, history: 100 });
  // 好感度不足
  assert.notEqual(resolveForm(high, 999), 'bond');
  // 属性不足
  assert.notEqual(resolveForm(attrs({ tech: 100 }), 1200), 'bond');
  // 两者都满足
  assert.equal(resolveForm(high, 1000), 'bond');
});

test('羁绊形态优先级高于百科全书', () => {
  const high = attrs({ tech: 100, art: 100, work: 100, emotion: 100, life: 100, history: 100 });
  assert.equal(resolveForm(high, 1500), 'bond');
});

console.log('\n[好感度五阶段]');

test('五个阶段边界正确', () => {
  assert.equal(getStage(0).key, 'stranger');
  assert.equal(getStage(99).key, 'stranger');
  assert.equal(getStage(100).key, 'familiar');
  assert.equal(getStage(299).key, 'familiar');
  assert.equal(getStage(300).key, 'close');
  assert.equal(getStage(599).key, 'close');
  assert.equal(getStage(600).key, 'attached');
  assert.equal(getStage(999).key, 'attached');
  assert.equal(getStage(1000).key, 'bond');
  assert.equal(getStage(5000).key, 'bond');
});

test('每个阶段的称呼都不同', () => {
  const addrs = AFFINITY_STAGES.map((s) => s.address);
  assert.equal(new Set(addrs).size, AFFINITY_STAGES.length);
});

test('每个阶段都有独立的语气描述与解锁项', () => {
  for (const s of AFFINITY_STAGES) {
    assert.ok(s.tone && s.tone.length > 5, `${s.key} 缺少语气`);
    assert.ok(s.unlocks && s.unlocks.length, `${s.key} 缺少解锁项`);
  }
  const tones = AFFINITY_STAGES.map((s) => s.tone);
  assert.equal(new Set(tones).size, AFFINITY_STAGES.length, '语气描述必须各不相同');
});

test('称呼模板正确替换昵称与爱称', () => {
  assert.equal(resolveAddress(getStage(0), '阿远'), '那个人类');
  assert.equal(resolveAddress(getStage(100), '阿远'), '你');
  assert.equal(resolveAddress(getStage(300), '阿远'), '阿远');
  assert.equal(resolveAddress(getStage(600), '阿远'), '我的人类');
  assert.equal(resolveAddress(getStage(1000), '阿远', '小暖灯'), '小暖灯');
});

test('好感度衰减不导致阶段回退', () => {
  // 曾达到依赖阶段，数值掉回 100
  const eff = getEffectiveStage(100, 'attached');
  assert.equal(eff.key, 'attached', '阶段不应回退');
});

test('阶段可以正常前进', () => {
  const eff = getEffectiveStage(700, 'familiar');
  assert.equal(eff.key, 'attached', '数值更高时应取更高阶段');
});

test('无历史记录时按数值判定', () => {
  assert.equal(getEffectiveStage(350, null).key, 'close');
});

console.log('\n[泡泡配比]');

test('依赖阶段关系类泡泡占比过半', () => {
  assert.ok(BUBBLE_MIX.attached.relation > 0.5,
    `依赖阶段关系类仅 ${BUBBLE_MIX.attached.relation}`);
  assert.ok(BUBBLE_MIX.bond.relation > 0.5);
});

test('关系类占比随好感度递增', () => {
  const order = ['stranger', 'familiar', 'close', 'attached', 'bond'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(
      BUBBLE_MIX[order[i]].relation > BUBBLE_MIX[order[i - 1]].relation,
      `${order[i]} 关系类占比未高于 ${order[i - 1]}`
    );
  }
});

test('每个阶段三类占比之和为 1', () => {
  for (const [key, mix] of Object.entries(BUBBLE_MIX)) {
    const sum = mix.mood + mix.knowledge + mix.relation;
    assert.ok(Math.abs(sum - 1) < 1e-6, `${key} 占比之和为 ${sum}`);
  }
});

test('关系类泡泡模板包含用户占位符', () => {
  const hasPlaceholder = BUBBLE_CORPUS.relation.some((t) => t.includes('TA'));
  assert.ok(hasPlaceholder, '关系类泡泡应包含 TA 占位符');
});

console.log('\n[记忆碎片抽取]');

test('不把整句当成关键词', () => {
  const st = { memories: [] };
  const kw = extractMemory(st, '我今天考研复习到很晚');
  assert.ok(kw, '应抽取到关键词');
  assert.ok(kw.length <= 6, `关键词过长: ${kw}`);
  assert.ok(!kw.includes('我今天'), `不应包含停用词: ${kw}`);
});

test('能抽出有意义的短词', () => {
  const st = { memories: [] };
  const kw = extractMemory(st, '我最近在准备考研');
  assert.ok(kw && kw.length >= 2 && kw.length <= 6, `异常关键词: ${kw}`);
});

test('重复关键词不重复记录', () => {
  const st = { memories: [] };
  extractMemory(st, '考研好难');
  const before = st.memories.length;
  extractMemory(st, '考研好难');
  assert.equal(st.memories.length, before, '同一关键词不应重复写入');
});

test('纯停用词输入返回 null', () => {
  const st = { memories: [] };
  assert.equal(extractMemory(st, '我 你 的 了'), null);
});

test('记忆上限为 20 条', () => {
  const st = { memories: [] };
  for (let i = 0; i < 30; i++) extractMemory(st, `话题${i}abc`);
  assert.ok(st.memories.length <= 20, `记忆条数 ${st.memories.length} 超过上限`);
});

console.log('\n' + '─'.repeat(46));
console.log(`  通过 ${passed} 项，失败 ${failed} 项`);
console.log('─'.repeat(46) + '\n');

if (failed > 0) process.exit(1);
