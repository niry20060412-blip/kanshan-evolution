/**
 * 看山进化 — 主控制器
 * 页面路由、渲染、交互、外出结算、小游戏、对话。
 */
import { loadState, saveState, ensureDaily } from './storage.js';
import { DOMAINS, DOMAIN_MAP, ATTRIBUTES } from './config/domains.js';
import { ALL_FORMS, FORM_MAP, RARITY_LABEL } from './config/forms.js';
import { AFFINITY_STAGES, AFFINITY_RULES, BUBBLE_MIX } from './config/affinity.js';
import { SOUVENIR_MAP } from './config/souvenirs.js';
import { NPCS, NPC_MAP } from './config/npc.js';
import { BUBBLE_CORPUS, CALL_CORPUS, EYECARE_LINES, pick } from './config/corpus.js';
import { renderPet, renderThumb } from './pet-renderer.js';
import * as api from './api.js?v=20261023b';
import { pickLocalAnswer } from './local-knowledge.js';
import {
  addAffinity, currentStage, currentAddress, settleLogin,
  completeReading, checkEvolution, totalAttrs,
  canGoOut, startOuting, outingStatus, outingRemainMs, settleOuting,
  respondToOuting, rewardMinigame, rewardChat,
  activeNpcVisit, extractMemory, isNightTime, OUTING_MIN_AFFINITY
} from './game.js';
import {
  buildSystemPrompt, localReply, maybeDistracted,
  shouldSpeakFirst, proactiveLine, typingDelay, splitSentences
} from './persona.js';

// ---------------------------------------------------------------- 状态

let state = loadState();
let currentDomain = null;
let currentAnswer = null;
let bubbleTimer = null;
let countdownTimer = null;
let chatBusy = false;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function persist() { saveState(state); }

// ---------------------------------------------------------------- 工具

function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, ms);
}

function say(text, ms = 3600) {
  const el = $('say-bubble');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, ms);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `今天 ${hm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

function fmtRemain(ms) {
  if (ms <= 0) return '应该快回来了';
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  // 一小时内用 mm:ss 逐秒走动，让等待"活"起来
  if (h === 0) return `还有 ${pad(m)}:${pad(s)}`;
  return `还有 ${h} 小时 ${pad(m)} 分`;
}

/** 深夜模式：23:00 后自动切换视觉 */
function applyNightMode() {
  document.body.classList.toggle('is-night', isNightTime());
}

function applyMotionPref() {
  document.body.classList.toggle('reduced-motion', !!state.reducedMotion);
}

// ---------------------------------------------------------------- 路由

function showPage(name) {
  ['home', 'domains', 'read', 'gallery'].forEach((p) => {
    const el = $(`page-${p}`);
    if (!el) return;
    const active = p === name;
    el.hidden = !active;
    el.classList.toggle('is-active', active);
  });
  document.querySelectorAll('.tabbar-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.page === name);
  });
  if (name === 'home') renderHome();
  if (name === 'domains') renderDomains();
  if (name === 'gallery') renderGallery();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- 主页渲染

function renderHome() {
  const stage = currentStage(state);
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
  const status = outingStatus(state);

  $('home-pet-name').textContent = state.nickname ? `${state.nickname} 的看山` : '看山';
  // 徽章只显示职业短名，避免与标题里的"看山"重复
  $('home-form-tag').textContent = form.shortName || form.name;

  // 状态位
  const statusLabel = { home: '在家', away: '出门中', back: '刚回来' }[status];
  $('status-text').textContent = statusLabel;
  $('status-dot').dataset.status = status;
  $('stage-text').textContent = stage.name;
  $('address-text').textContent = `叫你「${currentAddress(state)}」`;

  // 房间：出门时明显变空
  const room = $('room');
  room.dataset.empty = status === 'away' ? 'true' : 'false';
  $('door-note').hidden = status !== 'away';

  if (status === 'away') {
    $('note-text').textContent = state.outing.note;
    $('note-countdown').textContent = fmtRemain(outingRemainMs(state));
  }

  // 形象：按当前情境选择动作
  //   刚回来 → 打招呼 / 深夜 → 瞌睡 / 今天读过书 → 用电脑 / 其余静止
  let anim = null;
  if (!state.reducedMotion) {
    if (status === 'back') anim = 'hello';
    else if (isNightTime()) anim = 'doze';
    else if ((state.recentAnswers || []).length
             && Date.now() - (state.recentAnswers[0].at || 0) < 6 * 60 * 1000) anim = 'work';
  }
  $('pet-svg').innerHTML = renderPet(state.currentForm, {
    reducedMotion: state.reducedMotion,
    bondColor: nicknameColor(),
    anim
  });

  // 好感度
  const nextStage = AFFINITY_STAGES[AFFINITY_STAGES.indexOf(stage) + 1];
  const floor = stage.min;
  const ceil = nextStage ? nextStage.min : stage.min + 200;
  const pct = Math.min(100, Math.max(0, ((state.affinity - floor) / (ceil - floor)) * 100));
  $('affinity-value').textContent = state.affinity;
  $('affinity-next').textContent = nextStage
    ? `· 距「${nextStage.name}」还差 ${nextStage.min - state.affinity} 点`
    : '· 已是最亲密的阶段';
  const fill = $('affinity-fill');
  fill.style.width = `${pct}%`;
  fill.setAttribute('aria-valuenow', String(Math.round(pct)));
  $('affinity-note').textContent = `${stage.name} · ${stage.toneTag}`;

  // 属性
  const maxAttr = Math.max(100, ...Object.values(state.attrs));
  $('attr-total').textContent = `总计 ${totalAttrs(state)}`;
  $('attr-list').innerHTML = ATTRIBUTES.map((a) => {
    const v = state.attrs[a.key] || 0;
    const w = Math.min(100, (v / maxAttr) * 100);
    return `<li class="attr-row">
      <span class="attr-name">${a.name}</span>
      <div class="attr-bar"><span style="width:${w}%;background:${a.color}"></span></div>
      <span class="attr-num">${v}</span>
    </li>`;
  }).join('');

  // 外出按钮
  const btn = $('go-out-btn');
  if (status === 'away') {
    btn.disabled = true;
    btn.textContent = '它出门了…';
  } else if (status === 'back') {
    btn.disabled = false;
    btn.textContent = '它回来了！听它说';
  } else if (!canGoOut(state)) {
    btn.disabled = true;
    btn.textContent = `让它出门（还差 ${OUTING_MIN_AFFINITY - state.affinity} 好感度）`;
  } else {
    btn.disabled = false;
    btn.textContent = state.demoMode ? '让它出门（演示 · 10 分钟）' : '让它出门（4~6 小时）';
  }

  // 通话入口：仅在它出门且开关打开时出现（需求 5）
  const callBtn = $('call-btn');
  callBtn.hidden = !(status === 'away' && state.features.callWhenAway);

  // NPC 登门
  const visitor = activeNpcVisit(state);
  const npcEl = $('npc-corner');
  if (visitor) {
    npcEl.hidden = false;
    $('npc-icon').textContent = visitor.icon;
    $('npc-name').textContent = visitor.name;
  } else {
    npcEl.hidden = true;
  }

  // 见闻红点
  const unread = state.recentOutings.some((o) => !o.responded);
  $('outing-dot').hidden = !unread;

  startBubbles();
}

/** 昵称决定羁绊光环颜色 */
function nicknameColor() {
  const name = state.nickname || '看山';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 68%, 66%)`;
}

// ---------------------------------------------------------------- 思绪泡泡

/** 按好感度阶段混合三类泡泡；依赖阶段关系类过半 */
function pickBubble() {
  const stage = currentStage(state);
  const mix = BUBBLE_MIX[stage.key] || BUBBLE_MIX.stranger;
  const r = Math.random();

  let kind;
  if (r < mix.relation) kind = 'relation';
  else if (r < mix.relation + mix.knowledge) kind = 'knowledge';
  else kind = 'mood';

  let text;
  if (kind === 'knowledge' && state.recentAnswers.length && Math.random() < 0.6) {
    // 从今天读过的回答里摘一句（真实数据回流）
    const ans = pick(state.recentAnswers);
    const sentences = String(ans.excerpt || '').split(/[。！？]/).filter((s) => s.length > 8);
    text = sentences.length ? pick(sentences).slice(0, 24) : pick(BUBBLE_CORPUS.knowledge);
  } else {
    text = pick(BUBBLE_CORPUS[kind]);
  }

  if (kind === 'relation') {
    // 替换占位符；昵称两侧不留空格，避免"讲给 新玹 听"这种断裂感
    text = text.replace(/\s*TA\s*/g, state.nickname || 'TA');
  }
  return { kind, text };
}

function startBubbles() {
  stopBubbles();
  const layer = $('bubble-layer');
  if (!layer) return;
  layer.innerHTML = '';
  if (outingStatus(state) === 'away') return;

  const spawn = () => {
    if (outingStatus(state) === 'away') return;
    const { kind, text } = pickBubble();
    const el = document.createElement('div');
    el.className = 'thought-bubble';
    el.dataset.kind = kind;
    el.textContent = text;
    const side = Math.random() < 0.5;
    el.style.left = side ? '4%' : 'auto';
    el.style.right = side ? 'auto' : '4%';
    el.style.top = `${12 + Math.random() * 42}%`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 5600);
  };

  spawn();
  bubbleTimer = setInterval(spawn, 4200);
}

function stopBubbles() {
  if (bubbleTimer) clearInterval(bubbleTimer);
  bubbleTimer = null;
}

// ---------------------------------------------------------------- 领域页

function renderDomains() {
  $('domain-grid').innerHTML = DOMAINS.map((d) => `
    <button class="domain-card" data-domain="${d.key}" style="border-left-color:${d.color}">
      <span class="domain-icon" aria-hidden="true">${d.icon}</span>
      <span class="domain-name">${esc(d.name)}</span>
      <span class="domain-desc">${esc(d.desc)}</span>
      <span class="domain-today">今日推荐：${esc(d.todayTitle)}</span>
      <span class="domain-attr">喂养 → ${esc(ATTRIBUTES.find((a) => a.key === d.attribute).name)}属性</span>
    </button>`).join('');

  $('domain-grid').querySelectorAll('.domain-card').forEach((btn) => {
    btn.addEventListener('click', () => openRead(btn.dataset.domain));
  });
}

// ---------------------------------------------------------------- 阅读页

async function openRead(domainKey) {
  currentDomain = domainKey;
  currentAnswer = null;
  const d = DOMAIN_MAP[domainKey];
  showPage('read');

  $('read-domain-chip').textContent = d.name;
  $('read-domain-chip').style.background = d.color + '22';
  $('read-domain-chip').style.color = d.color;
  $('answer-loading').hidden = false;
  $('answer-body').hidden = true;
  $('read-done').disabled = true;
  // 「下一篇」按钮每次进入都要显示，读完后才高亮
  const nextBtn = $('read-next');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.hidden = false;
    nextBtn.textContent = '换一篇 →';
    nextBtn.classList.remove('is-primary-hint');
  }

  // 每次进入阅读页都重置上一次的完成状态
  $('read-back').textContent = '← 换一个领域';
  $('read-back').classList.remove('is-done');
  const prevReaction = $('read-reaction');
  if (prevReaction) prevReaction.hidden = true;
  window._pendingReadResult = null;

  const res = await api.fetchAnswer(domainKey);
  let data = res && res.ok && res.data ? res.data : null;

  // 双保险：即使接口层没带兜底（旧版脚本、接口异常、返回非 JSON），
  // 这里也直接用内置知识卡，保证阅读页一定有内容。
  if (!data) data = pickLocalAnswer(domainKey);

  if (!data) {
    // 极端情况：连本地兜底都没拿到，给出空状态而非白屏
    $('answer-loading').innerHTML = '<p>没找到内容，但你仍然可以陪它待一会儿。</p>';
    return;
  }

  currentAnswer = data;
  $('answer-title').textContent = data.title;

  // 内置知识卡没有作者与赞同数，缺什么就不显示什么，不用占位文字冒充
  const authorEl = $('answer-author');
  const votesEl = $('answer-votes');
  if (data.author) {
    authorEl.textContent = data.author;
    authorEl.hidden = false;
  } else {
    authorEl.hidden = true;
  }
  if (data.voteCount) {
    votesEl.textContent = `${Number(data.voteCount).toLocaleString('zh-CN')} 赞同`;
    votesEl.hidden = false;
  } else {
    votesEl.hidden = true;
  }

  $('answer-source').textContent =
    data.source === 'api'
      ? '知乎开放平台'
      : data.source === 'cache'
        ? '缓存内容'
        : '本地知识卡';
  $('answer-excerpt').textContent = data.excerpt;

  $('answer-loading').hidden = true;
  $('answer-body').hidden = false;
  $('read-done').disabled = false;
}

function onReadDone() {
  if (!currentAnswer || !currentDomain) return;
  $('read-done').disabled = true;

  const result = completeReading(state, currentDomain, currentAnswer);
  persist();

  if (!result) return;

  // 显示奖励提示，并在阅读页内展示看山反应，不自动跳转
  toast(`${result.attributeName} +${result.gainedAttr} · 好感度 +${result.gainedAffinity}`);

  // 在阅读页底部显示看山反应气泡，让用户知道有效果
  const reactionEl = $('read-reaction');
  if (reactionEl) {
    reactionEl.textContent = result.reaction;
    reactionEl.hidden = false;
  }

  // 解锁返回按钮并给出提示
  $('read-back').textContent = '← 返回（已记录）';
  $('read-back').classList.add('is-done');

  // 需求 1：读完后突出「换一篇」，鼓励连续喂养
  const nextBtn = $('read-next');
  if (nextBtn) {
    nextBtn.textContent = '再来一篇 →';
    nextBtn.classList.add('is-primary-hint');
  }

  // 把进化/阶段提升的回调挂在返回时触发，存到临时变量
  window._pendingReadResult = result;

  if (result.evolution) {
    setTimeout(() => showEvolution(result.evolution), 600);
  }
  if (result.stageChanged) {
    setTimeout(() => toast(`好感度阶段提升：${currentStage(state).name}`), 1800);
  }
}

// ---------------------------------------------------------------- 进化

function showEvolution(evo) {
  const form = evo.form;
  $('evolve-pet').innerHTML = renderPet(evo.to, {
    reducedMotion: state.reducedMotion,
    bondColor: nicknameColor()
  });
  $('evolve-name').textContent = form.name;
  $('evolve-motto').textContent = `「${form.motto}」`;
  $('evolve-unlock').textContent = evo.isNew ? '新形态已收入图鉴' : '回到了这个样子';
  $('evolve-overlay').hidden = false;
}

// ---------------------------------------------------------------- 图鉴

function renderGallery() {
  const unlocked = new Set(state.unlockedForms);
  $('gallery-count').textContent = `${unlocked.size} / ${ALL_FORMS.length}`;

  $('gallery-forms').innerHTML = ALL_FORMS.map((f) => {
    const isUnlocked = unlocked.has(f.id);
    const rarity = RARITY_LABEL[f.rarity] || '';
    return `<div class="gallery-item" data-locked="${!isUnlocked}">
      ${f.rarity !== 'common' ? `<span class="rarity-tag" data-r="${f.rarity}">${rarity}</span>` : ''}
      <div class="gallery-thumb">${renderThumb(f.id, isUnlocked, { bondColor: nicknameColor() })}</div>
      <p class="gallery-name">${isUnlocked ? esc(f.name) : '???'}</p>
      <p class="gallery-cond">${esc(f.condition)}</p>
    </div>`;
  }).join('');

  // 柜子
  const box = $('gallery-cabinet');
  if (!state.souvenirs.length) {
    box.innerHTML = `<div class="empty-state">
      <span class="empty-icon" aria-hidden="true">🧺</span>
      柜子还是空的。<br>等它出门几次，会捡东西回来。
    </div>`;
  } else {
    box.innerHTML = state.souvenirs.map((s) => {
      const item = SOUVENIR_MAP[s.id];
      if (!item) return '';
      return `<div class="souvenir-card">
        <span class="souvenir-icon" aria-hidden="true">${item.icon}</span>
        <div>
          <p class="souvenir-name">${esc(item.name)}</p>
          <p class="souvenir-desc">「${esc(item.desc)}」</p>
          <p class="souvenir-from">来自${esc(item.fromName)} · ${fmtTime(s.at)}</p>
        </div>
      </div>`;
    }).join('');
  }
}

// ---------------------------------------------------------------- 外出

async function onGoOut() {
  const status = outingStatus(state);

  if (status === 'back') {
    await handleReturn();
    return;
  }
  if (!canGoOut(state)) return;

  const outing = startOuting(state);
  if (!outing) return;
  persist();

  say('那我出去一趟。', 3000);
  renderHome();
  startCountdown();
}

/** 结算归来：先尝试 API 改写，失败则本地语料，保证一定能完成 */
async function handleReturn() {
  const btn = $('go-out-btn');
  btn.disabled = true;
  btn.textContent = '它正在进门…';

  let rewritten = '';
  try {
    const topDomain = Object.entries(state.domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const recent = state.recentAnswers[0];
    if (recent) {
      const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
      const res = await api.rewriteOuting(recent.excerpt, form.name, state.nickname);
      if (res && res.ok && res.data) rewritten = res.data;
    }
    void topDomain;
  } catch {
    rewritten = '';
  }

  const record = settleOuting(state, rewritten);
  persist();
  renderHome();

  if (record) {
    toast('它回来了');
    openPanel('outing');
  } else {
    renderHome();
  }
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const status = outingStatus(state);
    if (status === 'away') {
      $('note-countdown').textContent = fmtRemain(outingRemainMs(state));
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      renderHome();
    }
  }, 1000);
}

// ---------------------------------------------------------------- 看山面板

function openPanel(tab = 'chat') {
  $('panel-backdrop').hidden = false;
  $('pet-panel').hidden = false;
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
  const stage = currentStage(state);
  const status = outingStatus(state);

  $('panel-avatar').innerHTML = renderPet(state.currentForm, {
    reducedMotion: true, bondColor: nicknameColor()
  });
  $('panel-name').textContent = form.name;
  $('panel-status').textContent =
    `${{ home: '在家', away: '出门中', back: '刚回来' }[status]} · ${stage.name}`;

  switchPanelTab(tab);

  // 主动开口：距上次对话超过 2 小时
  if (tab === 'chat' && shouldSpeakFirst(state)) {
    const line = proactiveLine(state);
    setTimeout(() => pushPetMessage(line), 420);
    state.lastChatAt = Date.now();
    persist();
  }
}

function closePanel() {
  $('panel-backdrop').hidden = true;
  $('pet-panel').hidden = true;
  // 离开面板即结束见闻话题，避免下次对话仍钉在旧话题上
  pendingOutingTopic = null;
  renderHome();
}

function switchPanelTab(tab) {
  document.querySelectorAll('[data-ptab]').forEach((b) => {
    const active = b.dataset.ptab === tab;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', String(active));
  });
  ['chat', 'outing', 'friends', 'memory'].forEach((t) => {
    const el = $(`ptab-${t}`);
    el.hidden = t !== tab;
    el.classList.toggle('is-active', t === tab);
  });

  if (tab === 'outing') renderOutings();
  if (tab === 'friends') renderFriends();
  if (tab === 'memory') renderMemory();
  if (tab === 'chat') updateChatHint();
}

// ---- 见闻 Tab ----

function renderOutings() {
  const list = $('outing-list');
  if (!state.recentOutings.length) {
    list.innerHTML = `<div class="empty-state">
      <span class="empty-icon" aria-hidden="true">🚪</span>
      它还没出过门。<br>好感度到 100 就可以放它出去了。
    </div>`;
    return;
  }

  list.innerHTML = state.recentOutings.map((o) => {
    const npcLine = o.npc
      ? `<div class="outing-chip"><span>${NPC_MAP[o.npc.id]?.icon || '👤'}</span>
           <span>${esc(o.npc.line)}</span></div>` : '';
    const souvenir = o.souvenir && SOUVENIR_MAP[o.souvenir]
      ? `<div class="outing-chip"><span>${SOUVENIR_MAP[o.souvenir].icon}</span>
           <span>带回了「${esc(SOUVENIR_MAP[o.souvenir].name)}」</span></div>` : '';
    const extra = (npcLine || souvenir)
      ? `<div class="outing-extra">${npcLine}${souvenir}</div>` : '';
    const action = o.responded
      ? `<p class="outing-done">你回应过了 · 好感度 +${AFFINITY_RULES.outing.amount}</p>`
      : `<div class="outing-reply">
           <button class="btn btn-primary" data-reply="${o.id}">
             回应它（+${AFFINITY_RULES.outing.amount} 好感度）
           </button>
         </div>`;

    // 需求 2：听完见闻后可以就这件事深入聊，受开关控制
    const talk = state.features.outingChat
      ? `<div class="outing-talk">
           <button class="btn btn-ghost btn-sm" data-talk="${o.id}">
             就这件事聊两句 →
           </button>
         </div>`
      : '';

    return `<article class="outing-card">
      <p class="outing-time">${fmtTime(o.at)} · ${o.source === 'api' ? '知乎开放平台改写' : '本地语料'}</p>
      <p class="outing-text">${esc(o.text)}</p>
      ${extra}
      ${action}
      ${talk}
    </article>`;
  }).join('');

  list.querySelectorAll('[data-reply]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = respondToOuting(state, btn.dataset.reply);
      persist();
      if (!res) return;
      if (res.capped) {
        toast('今天已经听得够多啦，明天再说。');
        return;
      }
      toast(`好感度 +${res.gained}`);
      renderOutings();
      if (res.stageChanged) toast(`你们更近了一步：${currentStage(state).name}`);
    });
  });

  // 需求 2：带着见闻上下文跳到对话
  list.querySelectorAll('[data-talk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const record = state.recentOutings.find((o) => o.id === btn.dataset.talk);
      if (!record) return;
      startOutingTalk(record);
    });
  });
}

/**
 * 需求 2：从某条见闻进入对话。
 * 把见闻正文写进 pendingOutingTopic，下一轮对话会作为上下文送给模型。
 */
let pendingOutingTopic = null;

function startOutingTalk(record) {
  pendingOutingTopic = record;
  switchPanelTab('chat');

  // 它先把话头递过来，用户接着聊
  const opener = record.npc
    ? `就是我刚说的那个事——${record.npc.name}也在场。你怎么看？`
    : '你刚听完了。说说你的想法？我挺想知道的。';
  setTimeout(() => pushPetMessage(opener), 300);
  state.lastChatAt = Date.now();
  persist();
  toast('可以就这件事接着聊了');
}

// ---- 朋友 Tab ----

function renderFriends() {
  const visitor = activeNpcVisit(state);
  $('friends-list').innerHTML = NPCS.map((n) => {
    const met = state.metNpcs.includes(n.id);
    const visiting = visitor && visitor.id === n.id;
    return `<button class="friend-card" data-npc="${n.id}" data-met="${met}">
      <span class="friend-icon" aria-hidden="true">${n.icon}</span>
      <span style="flex:1">
        <span class="friend-name">${esc(n.name)}</span>
        <span class="friend-persona">${esc(n.persona)}</span>
        <span class="friend-line">${met ? '「' + esc(n.catchphrase) + '」' : '还没遇到过'}</span>
      </span>
      <span class="friend-badge" data-visiting="${!!visiting}">
        ${visiting ? '在家里' : met ? '认识' : '未遇'}
      </span>
    </button>`;
  }).join('');

  $('friends-list').querySelectorAll('[data-npc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const npc = NPC_MAP[btn.dataset.npc];
      if (!npc) return;
      if (!state.metNpcs.includes(npc.id)) {
        toast('看山还没遇到过它。');
        return;
      }
      toast(`${npc.name}：${pick(npc.lines)}`, 3200);
    });
  });
}

// ---- 回忆 Tab ----

function renderMemory() {
  const days = state.adoptedAt
    ? Math.max(1, Math.ceil((Date.now() - state.adoptedAt) / 86400000)) : 1;
  const readCount = Object.values(state.domainCounts).reduce((a, b) => a + b, 0);
  const topDomains = Object.entries(state.domainCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => `${DOMAIN_MAP[k]?.name || k} ${n} 篇`);

  const memoryTags = state.memories.length
    ? state.memories.slice(0, 12).map((m) =>
        `<span class="memory-tag">${esc(m.keyword)}</span>`).join('')
    : '<span class="memory-tag" style="opacity:.6">还没记住什么</span>';

  const stage = currentStage(state);
  const isBond = stage.key === 'bond';

  $('memory-body').innerHTML = `
    <div class="memory-section">
      <h3>它记住的事</h3>
      <div class="memory-tags">${memoryTags}</div>
    </div>
    <div class="memory-section">
      <h3>你们一起的数据</h3>
      <div class="memory-stat">
        第一次见面是 <b>${state.adoptedAt ? fmtTime(state.adoptedAt) : '今天'}</b><br>
        已经一起过了 <b>${days}</b> 天<br>
        一起读了 <b>${readCount}</b> 篇回答<br>
        ${topDomains.length ? `最常去的领域：<b>${esc(topDomains.join('、'))}</b><br>` : ''}
        解锁了 <b>${state.unlockedForms.length}</b> 种形态，
        捡回 <b>${state.souvenirs.length}</b> 件小东西<br>
        认识了 <b>${state.metNpcs.length}</b> 个朋友
      </div>
    </div>
    ${isBond ? `<div class="memory-section">
      <h3>年度纪念册</h3>
      <div class="memory-stat">
        「我记得第一天你给我起名字的样子。<br>
        后来我们读了 ${readCount} 篇东西，我出门 ${state.recentOutings.length} 次都急着回来讲给你听。<br>
        我现在叫你「${esc(currentAddress(state))}」，这个名字是我自己想的。」
      </div>
    </div>` : `<div class="memory-section">
      <h3>年度纪念册</h3>
      <div class="memory-stat" style="opacity:.6">
        羁绊阶段（好感度 1000）解锁。
      </div>
    </div>`}
  `;
}

// ---------------------------------------------------------------- 聊天

function pushUserMessage(text) {
  const log = $('chat-log');
  const el = document.createElement('div');
  el.className = 'msg msg-user';
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function pushPetMessage(text) {
  const log = $('chat-log');
  const el = document.createElement('div');
  el.className = 'msg msg-pet';
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function pushTyping() {
  const log = $('chat-log');
  const el = document.createElement('div');
  el.className = 'msg msg-pet msg-typing';
  el.innerHTML = '<span class="typing-dots"><span>·</span><span>·</span><span>·</span></span>';
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 逐句显示，按句长设置 300~900ms 不均匀延迟 */
async function typeOutReply(text) {
  const sentences = splitSentences(text);
  for (const s of sentences) {
    const typing = pushTyping();
    await sleep(typingDelay(s));
    typing.remove();
    pushPetMessage(s);
  }
}

function updateChatHint() {
  ensureDaily(state);
  const left = Math.max(0, AFFINITY_RULES.chat.dailyCap - (state.dailyCaps.chatRounds || 0));
  $('chat-left').textContent = String(left);
}

async function onChatSubmit(e) {
  e.preventDefault();
  if (chatBusy) return;

  const input = $('chat-text');
  const text = input.value.trim();
  if (!text) return;

  chatBusy = true;
  input.value = '';
  $('chat-send').disabled = true;
  pushUserMessage(text);

  // 记忆碎片
  const keyword = extractMemory(state, text);
  void keyword;

  // 对话奖励
  const reward = rewardChat(state);
  state.lastChatAt = Date.now();
  state.lastInteractAt = Date.now();

  // 偶尔走神：先回一句，再正常回答
  const distracted = maybeDistracted();
  if (distracted) {
    const t = pushTyping();
    await sleep(typingDelay(distracted));
    t.remove();
    pushPetMessage(distracted);
    await sleep(360);
  }

  // 动态拼装 system prompt（四块人格），优先走看山 API，再走知乎 API，失败则本地兜底
  let reply = '';
  try {
    let system = buildSystemPrompt(state);

    // 需求 2：正在就某条见闻聊，把话题钉进上下文
    if (pendingOutingTopic) {
      system += `\n\n【当前正在聊的话题】\n你刚跟对方讲完这段见闻：「${pendingOutingTopic.text}」\n`
        + '对方现在正在回应这件事。请围绕这个话题接着聊，可以追问、可以反驳，不要换题。';
    }

    // 优先尝试看山工作台本地 API
    const ksRes = await api.sendDialogueViaKanshan(system, text);
    if (ksRes && ksRes.ok && ksRes.data) {
      reply = ksRes.data;
    } else {
      // 降级到原知乎 API
      const res = await api.sendDialogue(system, text);
      if (res && res.ok && res.data) reply = res.data;
    }
  } catch {
    reply = '';
  }
  if (!reply) reply = localReply(state, text, pendingOutingTopic);

  await typeOutReply(reply);

  // 对话摘要
  state.chatSummary.unshift({ user: text.slice(0, 40), at: Date.now() });
  state.chatSummary = state.chatSummary.slice(0, 10);
  persist();

  updateChatHint();
  if (reward && !reward.capped && reward.stageChanged) {
    toast(`好感度阶段提升：${currentStage(state).name}`);
  }

  chatBusy = false;
  $('chat-send').disabled = false;
  input.focus();
}

// ---------------------------------------------------------------- 戳泡泡

let gameState = null;

function startBubbleGame() {
  const field = $('game-field');
  field.innerHTML = '';
  gameState = { score: 0, left: 15, timer: null, spawner: null };

  $('game-score').textContent = '0';
  $('game-timer').textContent = '15';
  $('bubble-game').hidden = false;

  const spawn = () => {
    const { kind, text } = pickBubble();
    const el = document.createElement('button');
    el.className = 'game-bubble';
    el.dataset.kind = kind;
    el.textContent = text;
    el.style.left = `${6 + Math.random() * 58}%`;
    el.style.top = `${8 + Math.random() * 74}%`;
    el.addEventListener('click', () => {
      if (el.classList.contains('is-popped')) return;
      el.classList.add('is-popped');
      gameState.score += 1;
      $('game-score').textContent = String(gameState.score);
      setTimeout(() => el.remove(), 280);
    });
    field.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  };

  spawn(); spawn();
  gameState.spawner = setInterval(spawn, 780);
  gameState.timer = setInterval(() => {
    gameState.left -= 1;
    $('game-timer').textContent = String(gameState.left);
    if (gameState.left <= 0) endBubbleGame(false);
  }, 1000);
}

function endBubbleGame(skipped) {
  if (!gameState) return;
  clearInterval(gameState.timer);
  clearInterval(gameState.spawner);
  const score = gameState.score;
  gameState = null;
  $('bubble-game').hidden = true;

  if (skipped) {
    toast('不玩就算啦。');
    return;
  }

  const res = rewardMinigame(state, score);
  state.lastInteractAt = Date.now();
  persist();
  renderHome();
  // 玩完球的余兴
  const stageEl = $('pet-svg').querySelector('img');
  if (stageEl && !state.reducedMotion) {
    stageEl.src = 'assets/anim-play.gif?t=' + Date.now();
    setTimeout(() => renderHome(), 4000);
  }

  if (res.capped) {
    toast(`戳中 ${score} 个 · 今天的好感度已经攒满啦`);
  } else {
    toast(`戳中 ${score} 个 · 好感度 +${res.gained}`);
    if (res.stageChanged) {
      setTimeout(() => toast(`你们更近了一步：${currentStage(state).name}`), 1900);
    }
  }
}

// ---------------------------------------------------------------- 通话（需求 5）

let callTimer = null;
let callStartAt = 0;
let callBusy = false;

function pushCallMessage(text, who = 'pet') {
  const log = $('call-log');
  const el = document.createElement('div');
  el.className = `call-msg call-msg-${who}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function openCall() {
  if (outingStatus(state) !== 'away') {
    toast('它在家，直接跟它说就行。');
    return;
  }
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
  $('call-avatar').innerHTML = renderPet(state.currentForm, {
    reducedMotion: true, bondColor: nicknameColor()
  });
  $('call-title').textContent = `与${form.shortName || form.name}通话中`;
  $('call-sub').textContent = '它在外面，信号有点飘';
  $('call-log').innerHTML = '';
  $('call-overlay').hidden = false;

  callStartAt = Date.now();
  $('call-timer').textContent = '00:00';
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    const s = Math.floor((Date.now() - callStartAt) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    $('call-timer').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }, 1000);

  // 接通开场：剩余时间不多时换成"快到家"
  const remain = outingRemainMs(state);
  const opener = remain < 90 * 1000 ? pick(CALL_CORPUS.nearHome) : pick(CALL_CORPUS.pickup);
  setTimeout(() => pushCallMessage(opener), 520);

  state.lastChatAt = Date.now();
  state.lastInteractAt = Date.now();
  persist();
  $('call-text').focus();
}

function closeCall() {
  clearInterval(callTimer);
  callTimer = null;
  const bye = pick(CALL_CORPUS.hangup);
  pushCallMessage(bye);
  setTimeout(() => {
    $('call-overlay').hidden = true;
    renderHome();
  }, 700);
}

/** 通话中说话：走同一套人格链路，附加"正在外面"的上下文 */
async function onCallSubmit(e) {
  e.preventDefault();
  if (callBusy) return;

  const input = $('call-text');
  const text = input.value.trim();
  if (!text) return;

  callBusy = true;
  input.value = '';
  $('call-send').disabled = true;
  pushCallMessage(text, 'user');

  extractMemory(state, text);
  const reward = rewardChat(state);
  state.lastChatAt = Date.now();

  let reply = '';
  try {
    const remainMin = Math.max(1, Math.round(outingRemainMs(state) / 60000));
    let system = buildSystemPrompt(state);
    system += `\n\n【当前场景：电话通话】\n你正在外面，还有大约 ${remainMin} 分钟才回家。`
      + `你是通过电话跟对方说话的：背景有环境音，你可能会边走边说。`
      + `\n你出门时留的话是：「${state.outing?.note || '出去晃晃'}」。`
      + '不要假装自己在家，也不要描述家里的东西。';

    const ksRes = await api.sendDialogueViaKanshan(system, text);
    if (ksRes && ksRes.ok && ksRes.data) reply = ksRes.data;
    else {
      const res = await api.sendDialogue(system, text);
      if (res && res.ok && res.data) reply = res.data;
    }
  } catch {
    reply = '';
  }
  if (!reply) reply = pick(CALL_CORPUS.reply);

  // 通话用逐句显示，保留"信号断续"的节奏感
  for (const s of splitSentences(reply)) {
    await sleep(typingDelay(s));
    pushCallMessage(s);
  }

  persist();
  if (reward && !reward.capped && reward.stageChanged) {
    toast(`好感度阶段提升：${currentStage(state).name}`);
  }

  callBusy = false;
  $('call-send').disabled = false;
  input.focus();
}

// ---------------------------------------------------------------- 护眼提醒（需求 5）

const EYECARE_INTERVAL_MS = 20 * 60 * 1000;   // 连续 20 分钟提醒一次
const EYECARE_CHECK_MS = 30 * 1000;

let eyecareTimer = null;

function startEyeCare() {
  clearInterval(eyecareTimer);
  if (!state.features.eyeCare) return;

  // 本次会话起点：每次进入前台重新计时
  state.eyeCare.sessionStart = Date.now();

  eyecareTimer = setInterval(() => {
    if (!state.features.eyeCare) return;
    if (document.visibilityState !== 'visible') return;

    const start = state.eyeCare.sessionStart || Date.now();
    const elapsed = Date.now() - start;
    if (elapsed < EYECARE_INTERVAL_MS) return;

    triggerEyeCare(Math.round(elapsed / 60000));
    // 重新计时，避免连续刷屏
    state.eyeCare.sessionStart = Date.now();
    state.eyeCare.lastRemindAt = Date.now();
    persist();
  }, EYECARE_CHECK_MS);
}

function triggerEyeCare(minutes) {
  const line = pick(EYECARE_LINES);
  $('eyecare-title').textContent = `${line.title}（约 ${minutes} 分钟）`;
  $('eyecare-body').textContent = line.body;
  $('eyecare-toast').hidden = false;

  // 抖动：尊重"减少动效"设置
  if (!state.reducedMotion) {
    document.body.classList.add('is-shaking');
    setTimeout(() => document.body.classList.remove('is-shaking'), 620);
  }

  clearTimeout($('eyecare-toast')._t);
  $('eyecare-toast')._t = setTimeout(() => {
    $('eyecare-toast').hidden = true;
  }, 12000);
}

// ---------------------------------------------------------------- 功能开关（需求 3）

const SWITCHES = ['outingChat', 'eyeCare', 'callWhenAway', 'floatingMode'];

function applyFloatingMode() {
  document.body.classList.toggle('is-floating', !!state.features.floatingMode);
}

function syncSwitchUI() {
  SWITCHES.forEach((k) => {
    const el = $(`sw-${k}`);
    if (el) el.checked = !!state.features[k];
  });
}

function bindSwitches() {
  SWITCHES.forEach((key) => {
    const el = $(`sw-${key}`);
    if (!el) return;
    el.addEventListener('change', () => {
      state.features[key] = el.checked;
      persist();

      if (key === 'eyeCare') {
        if (el.checked) startEyeCare();
        else {
          clearInterval(eyecareTimer);
          $('eyecare-toast').hidden = true;
        }
      }
      if (key === 'floatingMode') applyFloatingMode();
      if (key === 'callWhenAway') renderHome();
      if (key === 'outingChat' && !$('pet-panel').hidden) renderOutings();

      toast(el.checked ? '已开启' : '已关闭');
    });
  });
}

// ---------------------------------------------------------------- 桌宠安装（需求 3）

let deferredInstall = null;

/** 是否已经以独立应用（桌宠）方式运行 */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function initInstall() {
  // 注册 Service Worker：提供离线能力，也是可安装的前提
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        // 主动检查更新：旧版把「缓存优先」写死了，不主动查会让旧脚本一直占位
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* 离线能力不可用不影响主流程 */
      });
  }

  const banner = $('install-banner');
  if (!banner) return;

  // 已经装好了就不再打扰
  if (isStandalone() || state.installDismissed) return;

  // Chrome / Edge / Android：拦截浏览器的安装提示，换成我们自己的横幅
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    showInstallBanner();
  });

  // iOS Safari 不支持自动安装，领养后给一次手动指引
  if (isIOS() && state.adopted) {
    setTimeout(() => showInstallBanner(true), 6000);
  }

  $('install-yes').addEventListener('click', async () => {
    banner.hidden = true;
    if (deferredInstall) {
      deferredInstall.prompt();
      const choice = await deferredInstall.userChoice.catch(() => null);
      deferredInstall = null;
      if (choice && choice.outcome === 'accepted') {
        toast('装好了，去桌面找它');
        state.installDismissed = true;
        persist();
      }
      return;
    }
    // 没有原生提示（iOS 等）→ 显示手动步骤
    $('ios-guide').hidden = false;
  });

  $('install-no').addEventListener('click', () => {
    banner.hidden = true;
    state.installDismissed = true;
    persist();
  });

  $('ios-guide-close').addEventListener('click', () => {
    $('ios-guide').hidden = true;
    state.installDismissed = true;
    persist();
  });
}

function showInstallBanner(manual = false) {
  const banner = $('install-banner');
  if (!banner || isStandalone() || state.installDismissed) return;
  // 横幅上放一只当前形态的看山，比纯文字更有说服力
  $('install-pet').innerHTML = renderPet(state.currentForm, {
    reducedMotion: true, bondColor: nicknameColor()
  });
  if (manual) {
    $('install-desc').textContent = '加到主屏幕，像 App 一样随时点开。';
  }
  banner.hidden = false;
}

// ---------------------------------------------------------------- 领养

function renderAdoptPreview() {  $('adopt-pet').innerHTML = renderPet('origin', { reducedMotion: false });
}

function doAdopt() {
  const input = $('nickname-input');
  const name = input.value.trim();
  if (!name) {
    input.focus();
    toast('先告诉它怎么称呼你吧。');
    return;
  }

  state.adopted = true;
  state.nickname = name;
  state.adoptedAt = Date.now();
  state.lastLoginDate = new Date().toISOString().slice(0, 10);
  state.loginStreak = 1;
  persist();

  $('adopt-screen').hidden = true;
  $('app').hidden = false;
  $('tabbar').hidden = false;
  showPage('home');

  // 护眼提醒开始计时（需求 5）
  startEyeCare();

  // 桌宠安装能力（需求 3）
  initInstall();
  setTimeout(() => say('……你好。我先看看你。', 4200), 700);
}

// ---------------------------------------------------------------- 事件绑定

function bindEvents() {
  // 领养
  $('adopt-btn').addEventListener('click', doAdopt);
  $('nickname-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doAdopt();
  });

  // 底部导航
  document.querySelectorAll('.tabbar-btn').forEach((btn) => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  // 阅读：读完后自主返回，不自动跳转
  $('read-back').addEventListener('click', () => {
    const done = window._pendingReadResult;

    // 重置阅读页状态
    $('read-back').textContent = '← 换一个领域';
    $('read-back').classList.remove('is-done');
    const reactionEl = $('read-reaction');
    if (reactionEl) reactionEl.hidden = true;
    window._pendingReadResult = null;

    // 读完过就回主页看反应，没读完就回领域页换一篇
    if (done) {
      showPage('home');

  // 护眼提醒开始计时（需求 5）
  startEyeCare();

  // 桌宠安装能力（需求 3）
  initInstall();      setTimeout(() => say(done.reaction, 4000), 260);
    } else {
      showPage('domains');
    }
  });
  $('read-done').addEventListener('click', onReadDone);

  // 需求 1：读完可以直接换下一篇，不必退回领域页
  $('read-next').addEventListener('click', () => {
    if (!currentDomain) return showPage('domains');
    const done = window._pendingReadResult;
    // 已读完的先把反应说掉，再换下一篇
    if (done) setTimeout(() => say(done.reaction, 3000), 200);
    openRead(currentDomain);
  });

  // 进化弹层
  $('evolve-close').addEventListener('click', () => {
    $('evolve-overlay').hidden = true;
    renderHome();
  });

  // 图鉴分栏
  document.querySelectorAll('[data-gtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.gtab;
      document.querySelectorAll('[data-gtab]').forEach((b) => {
        const active = b.dataset.gtab === tab;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      $('gallery-forms').hidden = tab !== 'forms';
      $('gallery-cabinet').hidden = tab !== 'cabinet';
    });
  });

  // 看山面板
  $('pet-stage').addEventListener('click', () => {
    if (outingStatus(state) === 'away') {
      toast('它不在家。便签上说很快回来。');
      return;
    }
    openPanel('chat');
  });
  $('panel-close').addEventListener('click', closePanel);
  $('panel-backdrop').addEventListener('click', closePanel);
  document.querySelectorAll('[data-ptab]').forEach((btn) => {
    btn.addEventListener('click', () => switchPanelTab(btn.dataset.ptab));
  });
  $('chat-form').addEventListener('submit', onChatSubmit);

  // 外出
  $('go-out-btn').addEventListener('click', onGoOut);

  // 通话（需求 5）
  $('call-btn').addEventListener('click', openCall);
  $('call-hangup').addEventListener('click', closeCall);
  $('call-form').addEventListener('submit', onCallSubmit);

  // 护眼提醒关闭
  $('eyecare-close').addEventListener('click', () => {
    $('eyecare-toast').hidden = true;
  });

  // 设置面板（需求 3）
  $('settings-toggle').addEventListener('click', () => {
    const panel = $('settings-panel');
    panel.hidden = !panel.hidden;
  });
  bindSwitches();

  // 通话入口：仅在它出门且开关打开时出现（需求 5）
  const callBtn = $('call-btn');
  callBtn.hidden = !(status === 'away' && state.features.callWhenAway);

  // NPC 登门
  $('npc-corner').addEventListener('click', () => {
    const npc = activeNpcVisit(state);
    if (npc) toast(`${npc.name}：${pick(npc.lines)}`, 3200);
  });

  // 小游戏
  $('game-quit').addEventListener('click', () => endBubbleGame(true));

  // 长按看山触发戳泡泡
  let pressTimer = null;
  const stage = $('pet-stage');
  const startPress = () => {
    if (outingStatus(state) === 'away') return;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      startBubbleGame();
    }, 620);
  };
  const cancelPress = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };
  stage.addEventListener('touchstart', startPress, { passive: true });
  stage.addEventListener('touchend', cancelPress);
  stage.addEventListener('mousedown', startPress);
  stage.addEventListener('mouseup', cancelPress);
  stage.addEventListener('mouseleave', cancelPress);

  // 演示模式
  $('demo-toggle').addEventListener('click', () => {
    state.demoMode = !state.demoMode;
    $('demo-toggle').setAttribute('aria-pressed', String(state.demoMode));
    persist();
    renderHome();
    toast(state.demoMode ? '演示模式：外出缩短为 10 分钟' : '已回到正常节奏（4~6 小时）');
  });

  // 减少动效
  $('motion-toggle').addEventListener('click', () => {
    state.reducedMotion = !state.reducedMotion;
    $('motion-toggle').setAttribute('aria-pressed', String(state.reducedMotion));
    persist();
    applyMotionPref();
    renderHome();
    toast(state.reducedMotion ? '已减少动效' : '已恢复动效');
  });

  // ESC 关闭浮层
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('bubble-game').hidden) endBubbleGame(true);
    else if (!$('call-overlay').hidden) closeCall();
    else if (!$('evolve-overlay').hidden) $('evolve-overlay').hidden = true;
    else if (!$('pet-panel').hidden) closePanel();
    else if (!$('settings-panel').hidden) $('settings-panel').hidden = true;
  });

  // 回到前台时重新结算外出，并重置护眼计时
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyNightMode();
      // 离开期间不计入用眼时长
      state.eyeCare.sessionStart = Date.now();
      if (state.adopted) renderHome();
    }
  });
}

// ---------------------------------------------------------------- 启动

function init() {
  ensureDaily(state);
  applyNightMode();
  applyMotionPref();
  applyFloatingMode();
  bindEvents();
  syncSwitchUI();
  renderAdoptPreview();

  // 深夜模式按分钟检查
  setInterval(applyNightMode, 60000);

  if (!state.adopted) {
    $('adopt-screen').hidden = false;
    $('app').hidden = true;
    $('tabbar').hidden = true;
    return;
  }

  $('adopt-screen').hidden = true;
  $('app').hidden = false;
  $('tabbar').hidden = false;

  // 登录结算：连续登录奖励 + 衰减（阶段不回退）
  const events = settleLogin(state);

  // 刷新即结算外出
  if (outingStatus(state) === 'away') startCountdown();

  // 形态可能因配置变化需要重新判定
  checkEvolution(state);
  persist();

  $('demo-toggle').setAttribute('aria-pressed', String(state.demoMode));
  $('motion-toggle').setAttribute('aria-pressed', String(state.reducedMotion));

  showPage('home');

  // 护眼提醒开始计时（需求 5）
  startEyeCare();

  // 桌宠安装能力（需求 3）
  initInstall();
  events.forEach((ev, i) => {
    setTimeout(() => {
      if (ev.type === 'decay') say(ev.text, 4200);
      else if (ev.type === 'streak') toast(`连续来了 ${ev.days} 天 · 好感度 +${ev.amount}`);
    }, 900 + i * 2200);
  });

  // 归来提示
  if (outingStatus(state) === 'back') {
    setTimeout(() => toast('它好像回来了，去听听？'), 1300);
  }
}

init();
