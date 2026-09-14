/**
 * 演示控制台
 * 直接写入 localStorage 存档，跳到任意状态，省去手动喂养。
 * 仅用于演示与自测，不影响主应用逻辑。
 */
import { ALL_FORMS, FORM_MAP } from './config/forms.js';
import { SOUVENIRS } from './config/souvenirs.js';
import { NPCS } from './config/npc.js';
import { getStage } from './config/affinity.js';

const KEY = 'kanshan-evolution-save-v1';
const today = () => new Date().toISOString().slice(0, 10);

function baseSave(over = {}) {
  const now = Date.now();
  return Object.assign({
    version: 1, adopted: true, nickname: '新玹', petName: '',
    adoptedAt: now - 5 * 86400000,
    attrs: { tech: 0, art: 0, work: 0, emotion: 0, life: 0, history: 0 },
    affinity: 0, reachedStage: 'stranger',
    currentForm: 'origin', unlockedForms: ['origin'], souvenirs: [],
    memories: [], domainCounts: {}, recentAnswers: [], recentOutings: [],
    chatSummary: [], npcVisit: null, metNpcs: [],
    lastInteractAt: null, lastChatAt: null,
    lastLoginDate: today(), loginStreak: 3,
    outing: null, demoMode: true, reducedMotion: false,
    dailyCaps: { date: today(), minigame: 0, outing: 0, chatRounds: 0 }
  }, over);
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.display = 'none'; }, 1800);
}

function go(msg) {
  toast(msg + ' → 正在打开…');
  setTimeout(() => window.open('/', '_blank'), 500);
  setTimeout(renderState, 700);
}

const SAMPLE_ANSWER = {
  title: '大模型到底有没有在「理解」？',
  excerpt: '争论的关键其实不在模型，而在「理解」这个词本身。我们判断一个人听懂了，靠的是他能否在新语境里正确复用。',
  domain: 'tech', at: Date.now()
};

const SAMPLE_OUTING = {
  id: 'demo-outing-1',
  text: '我今天蹲在科技区看他们吵架，两拨人为了「模型到底懂不懂自己在说什么」吵了三百层楼。我看了半天，觉得他们其实在吵「什么叫懂」。你说，你怎么判断一个人是真听懂了你说的话？',
  source: 'local',
  npc: { id: 'turtle', name: '哲学乌龟', line: '今天碰到乌龟了，它又问我什么是自由，我说是不用出门，它好像被冒犯了。' },
  souvenir: 'screw', at: Date.now() - 60000, responded: false
};

// ---------------------------------------------------------------- 场景

const SCENES = {
  fresh() {
    localStorage.removeItem(KEY);
    return '已清空存档';
  },
  preEvolve() {
    write(baseSave({
      attrs: { tech: 40, art: 0, work: 0, emotion: 0, life: 10, history: 0 },
      affinity: 60, reachedStage: 'stranger',
      domainCounts: { tech: 4, life: 1 }, recentAnswers: [SAMPLE_ANSWER]
    }));
    return '再喂一篇科技就会进化';
  },
  away() {
    const now = Date.now();
    write(baseSave({
      attrs: { tech: 60, art: 20, work: 50, emotion: 10, life: 30, history: 10 },
      affinity: 180, reachedStage: 'familiar', currentForm: 'engineer',
      unlockedForms: ['origin', 'engineer', 'worker'],
      domainCounts: { tech: 6, work: 5 }, recentAnswers: [SAMPLE_ANSWER],
      outing: {
        startAt: now - 3 * 60000, returnAt: now + 7 * 60000,
        note: '去看看科技区最近在吵什么', claimed: false, id: 'demo-away'
      }
    }));
    return '它出门了，主页是空房间';
  },
  back() {
    const now = Date.now();
    write(baseSave({
      attrs: { tech: 60, art: 20, work: 50, emotion: 10, life: 30, history: 10 },
      affinity: 180, reachedStage: 'familiar', currentForm: 'engineer',
      unlockedForms: ['origin', 'engineer', 'worker'],
      domainCounts: { tech: 6, work: 5 }, recentAnswers: [SAMPLE_ANSWER],
      metNpcs: ['turtle'],
      outing: {
        startAt: now - 12 * 60000, returnAt: now - 60000,
        note: '去看看科技区最近在吵什么', claimed: false, id: 'demo-back'
      }
    }));
    return '点主页的「它回来了」听见闻';
  },
  gallery() {
    write(baseSave({
      attrs: { tech: 90, art: 80, work: 70, emotion: 60, life: 70, history: 50 },
      affinity: 420, reachedStage: 'close', currentForm: 'cyber_artist',
      unlockedForms: ['origin', 'engineer', 'painter', 'worker', 'warm',
        'homebody', 'storyteller', 'cyber_artist', 'geek'],
      souvenirs: ['screw', 'ticket', 'ginkgo', 'candy']
        .map((id, i) => ({ id, at: Date.now() - i * 86400000 })),
      domainCounts: { tech: 9, art: 8, work: 7, life: 7, emotion: 6, history: 5 },
      recentAnswers: [SAMPLE_ANSWER], recentOutings: [SAMPLE_OUTING],
      metNpcs: ['turtle', 'hamster', 'parrot']
    }));
    return '图鉴 9/19，柜子有 4 件纪念品';
  },
  bond() {
    write(baseSave({
      attrs: { tech: 110, art: 105, work: 100, emotion: 108, life: 102, history: 100 },
      affinity: 1200, reachedStage: 'bond', petName: '小暖灯',
      currentForm: 'bond',
      unlockedForms: ALL_FORMS.map((f) => f.id),
      souvenirs: SOUVENIRS.map((s, i) => ({ id: s.id, at: Date.now() - i * 86400000 })),
      memories: ['考研复习', '毕业设计', '想去海边'].map((k) => ({ keyword: k, at: Date.now() })),
      domainCounts: { tech: 12, art: 11, work: 10, emotion: 11, life: 10, history: 10 },
      recentAnswers: [SAMPLE_ANSWER], recentOutings: [SAMPLE_OUTING],
      metNpcs: NPCS.map((n) => n.id)
    }));
    return '羁绊形态 + 年度纪念册已解锁';
  }
};

window.act = (name) => {
  // 破坏性操作需二次确认，避免演示现场误点清空存档
  if (name === 'fresh' && !confirm('确定要清空所有进度吗？\n这会删除昵称、属性、好感度、图鉴与纪念品。')) {
    return;
  }
  const msg = SCENES[name]();
  go(msg);
};

// ---------------------------------------------------------------- 阶段与形态

window.setStage = (affinity) => {
  const s = read() || baseSave();
  s.adopted = true;
  s.affinity = affinity;
  s.reachedStage = getStage(affinity).key;
  if (s.reachedStage === 'bond' && !s.petName) s.petName = '小暖灯';
  // 羁绊形态需要属性同时达标
  if (affinity >= 1000) {
    s.attrs = { tech: 110, art: 105, work: 100, emotion: 108, life: 102, history: 100 };
  }
  write(s);
  go(`好感度设为 ${affinity}（${getStage(affinity).name}）`);
};

/** 为指定形态反推一组能通过判定的属性 */
function attrsForForm(form) {
  const base = { tech: 0, art: 0, work: 0, emotion: 0, life: 0, history: 0 };
  if (form.type === 'solo') return { ...base, [form.primary]: 90 };
  if (form.type === 'dual') return { ...base, [form.primary]: 90, [form.secondary]: 75 };
  if (form.type === 'balance') {
    return { tech: 95, art: 95, work: 95, emotion: 95, life: 95, history: 95 };
  }
  if (form.type === 'endgame') {
    return { tech: 110, art: 105, work: 100, emotion: 108, life: 102, history: 100 };
  }
  return base;
}

window.setForm = (id) => {
  const form = FORM_MAP[id];
  if (!form) return;
  const s = read() || baseSave();
  s.adopted = true;
  s.attrs = attrsForForm(form);
  s.currentForm = id;
  if (!s.unlockedForms.includes(id)) s.unlockedForms.push(id);
  if (form.type === 'endgame') {
    s.affinity = 1200;
    s.reachedStage = 'bond';
    if (!s.petName) s.petName = '小暖灯';
  } else if (s.affinity < 100) {
    s.affinity = 180;
    s.reachedStage = 'familiar';
  }
  write(s);
  go(`已变成${form.name}`);
};

// ---------------------------------------------------------------- 快捷操作

window.toggleDemo = () => {
  const s = read();
  if (!s) return toast('还没有存档，先选一个场景');
  s.demoMode = !s.demoMode;
  write(s);
  toast(s.demoMode ? '演示模式开：外出 10 分钟' : '演示模式关：外出 4~6 小时');
  renderState();
};

window.addAff = (n) => {
  const s = read();
  if (!s) return toast('还没有存档，先选一个场景');
  s.affinity += n;
  const st = getStage(s.affinity);
  const order = ['stranger', 'familiar', 'close', 'attached', 'bond'];
  if (order.indexOf(st.key) > order.indexOf(s.reachedStage)) s.reachedStage = st.key;
  if (st.key === 'bond' && !s.petName) s.petName = '小暖灯';
  write(s);
  toast(`好感度 +${n} → ${s.affinity}（${st.name}）`);
  renderState();
};

window.finishOuting = () => {
  const s = read();
  if (!s) return toast('还没有存档，先选一个场景');
  if (!s.outing || s.outing.claimed) return toast('它现在不在外面');
  s.outing.returnAt = Date.now() - 1000;
  write(s);
  toast('外出已到期，回主页点「它回来了」');
  renderState();
};

window.unlockAll = () => {
  const s = read() || baseSave();
  s.adopted = true;
  s.unlockedForms = ALL_FORMS.map((f) => f.id);
  s.souvenirs = SOUVENIRS.map((x, i) => ({ id: x.id, at: Date.now() - i * 3600000 }));
  s.metNpcs = NPCS.map((n) => n.id);
  write(s);
  toast('全部形态与纪念品已解锁');
  renderState();
};

// ---------------------------------------------------------------- 渲染

function renderState() {
  const s = read();
  const el = document.getElementById('state');
  if (!s || !s.adopted) {
    el.innerHTML = '当前：<b>还没有存档</b>（主应用会显示领养页）';
    return;
  }
  const st = getStage(s.affinity);
  const form = FORM_MAP[s.currentForm];
  const total = Object.values(s.attrs).reduce((a, b) => a + b, 0);
  const outStatus = !s.outing || s.outing.claimed ? '在家'
    : (Date.now() >= s.outing.returnAt ? '刚回来' : '出门中');
  el.innerHTML = `
    当前存档：昵称 <b>${s.nickname}</b>　形态 <b>${form ? form.name : s.currentForm}</b>　
    好感度 <b>${s.affinity}</b>（${st.name}）　总属性 <b>${total}</b><br>
    <span class="tag">图鉴 ${s.unlockedForms.length}/${ALL_FORMS.length}</span>
    <span class="tag">纪念品 ${s.souvenirs.length}/6</span>
    <span class="tag">朋友 ${s.metNpcs.length}/5</span>
    <span class="tag">${outStatus}</span>
    <span class="tag">${s.demoMode ? '演示模式开' : '正常节奏'}</span>`;
}

function renderForms() {
  const grid = document.getElementById('formGrid');
  grid.innerHTML = ALL_FORMS.map((f) => `
    <div class="card">
      <h2>${f.name}</h2>
      <p>${f.persona}</p>
      <button class="ghost" onclick="setForm('${f.id}')">变成它</button>
    </div>`).join('');
}

renderForms();
renderState();
