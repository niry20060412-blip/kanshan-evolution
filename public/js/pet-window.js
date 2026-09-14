/**
 * 看山 · 悬浮桌宠窗
 *
 * 职责边界（按需求刻意保持极简）：
 *   - 只显示形象本体，不提供任何其他功能入口
 *   - 点击 → 跳转主界面
 *   - 鼠标/手指的停留与移动 → 给出反应
 *   - 可拖动，松手自动吸附到最近的屏幕边缘，始终贴边不遮挡内容
 */

(function () {
  'use strict';

  const dock = document.getElementById('dock');
  const pet = document.getElementById('pet');
  const say = document.getElementById('say');

  const DOCK_W = 108;
  const DOCK_H = 155;
  const MARGIN = 0;            // 贴边时露出的边距
  const SLEEP_AFTER = 45000;   // 无互动多久进入打盹
  const DRAG_SLOP = 6;         // 超过这个位移才算拖动，否则算点击

  // ---- 动画素材：官方渲染的透明 GIF ----
  const ANIM = {
    idle:  'assets/kanshan-288.png',   // 静止：站立
    hello: 'assets/anim-hello.gif',    // 打招呼
    work:  'assets/anim-work.gif',     // 用电脑
    play:  'assets/anim-play.gif',     // 运球
    doze:  'assets/anim-doze.gif'      // 瞌睡
  };
  // 一次性动作的时长，播完回到静止
  const ANIM_MS = { hello: 4000, play: 4000, work: 6000 };

  let animTimer = null;
  let currentAnim = 'idle';

  /**
   * 切换动作。
   * loop=true 的动作会一直播（如瞌睡），否则播完自动回 idle。
   * GIF 每次赋值 src 都会从第一帧重新播放，这里加时间戳保证重播。
   */
  function playAnim(name, loop) {
    if (!ANIM[name]) return;
    clearTimeout(animTimer);
    currentAnim = name;
    pet.src = name === 'idle'
      ? ANIM.idle
      : ANIM[name] + '?t=' + Date.now();
    if (!loop && ANIM_MS[name]) {
      animTimer = setTimeout(() => {
        if (currentAnim === name) playAnim('idle');
      }, ANIM_MS[name]);
    }
  }

  // ---- 位置状态：以窗口左上角为基准 ----
  const saved = readPos();
  let posX = saved ? saved.x : window.innerWidth - DOCK_W - MARGIN;
  let posY = saved ? saved.y : window.innerHeight * 0.62;

  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, grabDX = 0, grabDY = 0;
  let sleepTimer = null;
  let sayTimer = null;
  let lastReactAt = 0;

  // ---------------------------------------------------------------- 反应语料

  // 停留：指针悬在它身上不动
  const LINES_HOVER = [
    '嗯？',
    '你要说什么吗',
    '我在这儿呢',
    '……看我干嘛',
    '手停在这儿了',
    '有事？没事我继续发呆了'
  ];

  // 划过：指针快速掠过
  const LINES_PASS = [
    '欸',
    '路过啊',
    '别晃了，头晕',
    '嗖一下就过去了',
    '你走得真快'
  ];

  // 戳：点击但还没跳转的瞬间
  const LINES_POKE = [
    '好好好，这就来',
    '别戳了',
    '走吧',
    '来了来了'
  ];

  // 被拖动
  const LINES_DRAG = [
    '哎——',
    '放我下来',
    '你要把我搬哪儿去',
    '飞起来了'
  ];

  // 睡醒
  const LINES_WAKE = [
    '唔……我刚睡着',
    '啊，你回来了',
    '我没睡，就眯了一下'
  ];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------------------------------------------------------- 工具

  function readPos() {
    try {
      const raw = localStorage.getItem('kanshan-pet-pos');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function savePos() {
    try {
      localStorage.setItem('kanshan-pet-pos', JSON.stringify({ x: posX, y: posY }));
    } catch { /* 隐私模式下忽略 */ }
  }

  function apply() {
    dock.style.left = posX + 'px';
    dock.style.top = posY + 'px';
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
    // 停在左半屏时镜像，让它朝向屏幕内侧
    dock.classList.toggle('dock-left', posX + DOCK_W / 2 < window.innerWidth / 2);
  }

  /** 说一句话，节流避免刷屏 */
  function speak(text, ms = 2100) {
    const now = Date.now();
    if (now - lastReactAt < 1500) return;
    lastReactAt = now;

    say.textContent = text;
    say.classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => say.classList.remove('show'), ms);
  }

  // ---------------------------------------------------------------- 打盹

  function resetSleep() {
    if (dock.classList.contains('is-sleepy')) {
      dock.classList.remove('is-sleepy');
      speak(pick(LINES_WAKE));
      playAnim('hello');          // 睡醒先打个招呼
    }
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      dock.classList.add('is-sleepy');
      playAnim('doze', true);     // 瞌睡循环播放
    }, SLEEP_AFTER);
  }

  // ---------------------------------------------------------------- 指针反应

  let hoverTimer = null;
  let lastMoveAt = 0;
  let moveCount = 0;

  dock.addEventListener('pointerenter', () => {
    if (dragging) return;
    dock.classList.add('is-hover');
    resetSleep();

    // 停留 600ms 还没走 → 它开口
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (dock.classList.contains('is-hover') && !dragging) {
        speak(pick(LINES_HOVER));
        if (currentAnim === 'idle') playAnim('hello');
      }
    }, 600);
  });

  dock.addEventListener('pointerleave', () => {
    if (dragging) return;
    dock.classList.remove('is-hover');
    dock.style.removeProperty('--lean');
    clearTimeout(hoverTimer);

    // 快速划过（短时间内多次移动后离开）→ 另一种反应
    if (moveCount > 4 && Date.now() - lastMoveAt < 400) {
      speak(pick(LINES_PASS), 1600);
      playAnim('play');
    }
    moveCount = 0;
  });

  // 指针在身上移动：身体朝指针方向轻微倾斜
  dock.addEventListener('pointermove', (e) => {
    if (dragging) return;
    lastMoveAt = Date.now();
    moveCount++;

    const r = dock.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const dx = (e.clientX - cx) / (r.width / 2);   // -1 ~ 1
    const lean = Math.max(-9, Math.min(9, dx * 9));
    dock.style.setProperty('--lean', lean.toFixed(1) + 'deg');
  });

  // ---------------------------------------------------------------- 拖动 + 点击

  dock.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const r = dock.getBoundingClientRect();
    grabDX = e.clientX - r.left;
    grabDY = e.clientY - r.top;
    dock.setPointerCapture(e.pointerId);
    dock.classList.add('is-dragging');
    resetSleep();
  });

  dock.addEventListener('pointermove', (e) => {
    if (!dragging) return;

    if (!moved) {
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (dist < DRAG_SLOP) return;   // 还在点击容差内
      moved = true;
      dock.classList.remove('is-hover');
      speak(pick(LINES_DRAG), 1400);
    }

    posX = e.clientX - grabDX;
    posY = e.clientY - grabDY;
    // 纵向限制在视口内
    posY = Math.max(4, Math.min(window.innerHeight - DOCK_H - 4, posY));
    apply();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    dock.classList.remove('is-dragging');
    try { dock.releasePointerCapture(e.pointerId); } catch { /* noop */ }

    if (!moved) {
      // 没移动 = 点击 → 跳主界面
      onPoke();
      return;
    }
    snapToEdge();
  }

  dock.addEventListener('pointerup', endDrag);
  dock.addEventListener('pointercancel', endDrag);

  /** 松手后吸附到最近的左右边缘，保证"停在屏幕边缘" */
  function snapToEdge() {
    const center = posX + DOCK_W / 2;
    posX = center < window.innerWidth / 2
      ? MARGIN
      : window.innerWidth - DOCK_W - MARGIN;
    apply();
    savePos();
  }

  // ---------------------------------------------------------------- 点击 → 主界面

  function onPoke() {
    dock.classList.remove('is-sleepy');
    dock.classList.add('is-poke');
    speak(pick(LINES_POKE), 1200);
    playAnim('hello');
    setTimeout(() => dock.classList.remove('is-poke'), 430);

    // 留一点时间让动画和气泡被看到，再跳转
    setTimeout(() => {
      // 独立窗口运行时直接跳；在浏览器标签里则尽量复用已打开的主界面
      window.location.href = '/';
    }, 460);
  }

  // 键盘可达性
  dock.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPoke();
    }
  });

  // ---------------------------------------------------------------- 启动

  window.addEventListener('resize', () => {
    posY = Math.max(4, Math.min(window.innerHeight - DOCK_H - 4, posY));
    snapToEdge();
  });

  // 高分屏用更大的静止图，避免发虚（动画 GIF 本身已是 320px）
  if (window.devicePixelRatio > 1.5) {
    ANIM.idle = 'assets/kanshan-full.png';
    if (currentAnim === 'idle') pet.src = ANIM.idle;
  }

  apply();
  resetSleep();

  // 打个招呼
  setTimeout(() => { speak('我在这儿。', 2000); playAnim('hello'); }, 700);
})();
