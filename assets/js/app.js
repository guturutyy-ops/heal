/* =========================================================
   ХилСорт — клиентская логика
   Безопасность: никакого innerHTML с пользовательскими данными,
   валидация всех id из DOM/хранилища, без inline-обработчиков (CSP).
   ========================================================= */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const root = document.documentElement;
const hasOwn = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => n.toLocaleString('ru-RU') + ' ₽';
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduceMotion = () => mqReduce.matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const canAnimate = typeof Element.prototype.animate === 'function';

root.classList.add('app-ready');

/* Безопасный конструктор DOM: текст всегда через textContent */
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, String(v));
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===================== ДАННЫЕ ===================== */
const PRODUCTS = Object.freeze({
  magniy: Object.freeze({
    id: 'magniy', name: 'Магния Хелат Оптимум', lab: ['МАГНИЙ ХЕЛАТ', 'ОПТИМУМ'], tone: ['#46564d', '#22302a', '#0a1410'],
    img: 'magniy.jpg', cut: 'magniy-cut.png',
    tag: 'Сон · Стресс · Энергия', price: 1290, old: 1490,
    why: 'назначение соответствует целям «сон», «стресс», «усталость». Хелатная форма — высокая биодоступность и мягкость для ЖКТ, дозировка активного вещества указана точно.',
    comp: [['Магний (бисглицинат)', '200 мг'], ['Глицин', '100 мг'], ['Витамин B6', '2 мг']],
    how: 'По 1 капсуле 2 раза в день во время еды. Вечером — за час до сна.',
    limits: 'Индивидуальная непереносимость. Беременность и лактация — после консультации со специалистом.'
  }),
  inozitol: Object.freeze({
    id: 'inozitol', name: 'Инозитол Оптимум', lab: ['ИНОЗИТОЛ', 'ОПТИМУМ'], tone: ['#66756c', '#46564d', '#22302a'],
    img: 'inozitol.jpg', cut: 'inozitol-cut.png',
    tag: 'Женское здоровье · Концентрация', price: 1490, old: null,
    why: 'мио-инозитол — наиболее изученная форма для женского здоровья и гормонального баланса; фолат в активной форме и D3 дополняют формулу.',
    comp: [['Мио-инозитол', '500 мг'], ['Фолат (5-MTHF)', '200 мкг'], ['Витамин D3', '10 мкг']],
    how: 'По 1 капсуле 2 раза в день во время еды.',
    limits: 'Индивидуальная непереносимость. Беременность и лактация — после консультации со специалистом.'
  })
});

const GOALS = Object.freeze({
  sleep:    { label: 'Сон', q: 'Сложнее заснуть или просыпаетесь ночью?', opts: ['Сложно заснуть', 'Просыпаюсь ночью', 'И то и другое'], main: 'magniy', tip: 'приглушите свет за час до сна и отложите гаджеты — магний работает в паре с вечерней гигиеной сна' },
  stress:   { label: 'Стресс', q: 'Стресс постоянный или эпизодами?', opts: ['Постоянный', 'Эпизодами'], main: 'magniy', tip: 'десять минут прогулки без телефона снижают нагрузку на нервную систему' },
  energy:   { label: 'Усталость', q: 'Усталость чувствуется с утра или к вечеру?', opts: ['С утра', 'К вечеру'], main: 'magniy', tip: 'начните день со стакана воды и белка — энергия любит стабильность' },
  focus:    { label: 'Концентрация', q: 'Фокус нужен для работы или учёбы?', opts: ['Для работы', 'Для учёбы'], main: 'inozitol', tip: 'формат «одна задача — 25 минут» помогает удерживать внимание' },
  women:    { label: 'Женское здоровье', q: null, opts: [], main: 'inozitol', tip: 'мио-инозитол — наиболее изученная форма для поддержки женского здоровья' },
  recovery: { label: 'Восстановление', q: 'Нагрузки скорее тренировочные или рабочие?', opts: ['Тренировки', 'Рабочие'], main: 'magniy', tip: 'сон 7–8 часов — главный фактор восстановления, магний помогает его углубить' }
});

/* ===================== БУТЫЛКА (SVG) ===================== */
let UID = 0;
function bottle(p) {
  const id = 'bt' + (++UID);
  const [t0, t1, t2] = p.tone;
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg viewBox="0 0 120 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${esc(t0)}"/><stop offset=".5" stop-color="${esc(t1)}"/><stop offset="1" stop-color="${esc(t2)}"/></linearGradient>
   <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2f38"/><stop offset=".45" stop-color="#171b22"/><stop offset="1" stop-color="#0b0d11"/></linearGradient>
   <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="40" y="4" width="40" height="24" rx="5" fill="url(#${id}c)"/>
  <rect x="40" y="9" width="40" height="2" fill="#2a2f38"/><rect x="40" y="15" width="40" height="2" fill="#2a2f38"/><rect x="40" y="21" width="40" height="2" fill="#2a2f38"/>
  <path d="M44 28 h32 v6 c0 5 12 9 12 18 v136 c0 12 -9 18 -20 18 H52 c-11 0 -20 -6 -20 -18 V52 c0 -9 12 -13 12 -18 z" fill="url(#${id}b)"/>
  <path d="M38 60 c0 -6 6 -9 8 -14 v150 c-5 -2 -8 -6 -8 -12 z" fill="url(#${id}h)"/>
  <rect x="32" y="93" width="56" height="78" rx="3" fill="#000" opacity=".18"/>
  <rect x="32" y="92" width="56" height="78" rx="3" fill="#F4EDDC"/>
  <rect x="35" y="96" width="50" height="1.6" fill="#9a7a2e"/><rect x="35" y="164" width="50" height="1.6" fill="#9a7a2e"/>
  <text x="60" y="116" text-anchor="middle" font-family="Marck Script" font-size="15" fill="#22302a">ХилСорт</text>
  <path d="M42 124 q9 -5 18 0 q9 -5 18 0" fill="none" stroke="#9a7a2e" stroke-width="1.1"/>
  <text x="60" y="140" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="7.5" letter-spacing=".8" fill="#22302a">${esc(p.lab[0])}</text>
  ${p.lab[1] ? `<text x="60" y="151" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="6" letter-spacing="1.5" fill="#22302a">${esc(p.lab[1])}</text>` : ''}
  <text x="60" y="161" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="5.5" letter-spacing="1" fill="#66756c">60 КАПСУЛ</text>
  <path d="M84 56 v128" stroke="#fff" stroke-opacity=".08" stroke-width="2" stroke-linecap="round"/>
 </svg>`;
  return tpl.content.firstElementChild;
}
/* Картинка товара: cut=true — вырезанная банка, иначе фото с фоном */
function productImage(p, cut) {
  return el('img', {
    src: cut && p.cut ? p.cut : p.img,
    alt: p.name,
    loading: 'lazy'
  });
}
/* ===================== ТОСТ ===================== */
let toastT;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ===================== СЛОИ: модалки, дровер, панель ===================== */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
const layers = [];
const focusables = node => $$(FOCUSABLE, node).filter(e => e.offsetParent !== null || e === document.activeElement);

function openLayer(node, { overlay = null, modal = true, trigger = null, focus = true } = {}) {
  if (layers.some(l => l.node === node)) return;
  const ret = document.activeElement;
  node.removeAttribute('inert');
  node.setAttribute('aria-hidden', 'false');
  node.classList.add('open');
  if (overlay) overlay.classList.add('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  layers.push({ node, overlay, modal, trigger, ret });
  syncLock();
  if (focus) {
    requestAnimationFrame(() => {
      const target = modal ? (focusables(node)[0] || node) : node;
      target.focus({ preventScroll: true });
    });
  }
}
function closeLayer(node) {
  const i = layers.findIndex(l => l.node === node);
  if (i < 0) return;
  const [l] = layers.splice(i, 1);
  node.classList.remove('open');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('inert', '');
  if (l.overlay) l.overlay.classList.remove('open');
  if (l.trigger) l.trigger.setAttribute('aria-expanded', 'false');
  syncLock();
  if (l.ret && document.contains(l.ret) && node.contains(document.activeElement)) l.ret.focus({ preventScroll: true });
  else if (l.ret && document.contains(l.ret) && l.modal) l.ret.focus({ preventScroll: true });
}
const isOpen = node => layers.some(l => l.node === node);
function syncLock() {
  document.body.classList.toggle('locked', layers.some(l => l.modal));
}
document.addEventListener('keydown', e => {
  if (!layers.length) return;
  const top = layers[layers.length - 1];
  if (e.key === 'Escape') {
    e.preventDefault();
    closeLayer(top.node);
    return;
  }
  if (e.key === 'Tab' && top.modal) {
    const f = focusables(top.node);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !top.node.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$$('[data-close]').forEach(b => b.addEventListener('click', () => {
  const host = b.closest('.modal, .drawer');
  if (host) closeLayer(host);
}));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeLayer(m); }));

/* ===================== КОРЗИНА ===================== */
const CART_KEY = 'healsort.cart.v1';
const MAX_QTY = 20;
const cart = new Map();
const drawer = $('#cartDrawer'), overlay = $('#cartOverlay'), cartBtn = $('#cartBtn');

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw || raw.length > 1000) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    for (const [id, q] of Object.entries(data)) {
      if (hasOwn(PRODUCTS, id) && Number.isInteger(q) && q > 0 && q <= MAX_QTY) cart.set(id, q);
    }
  } catch { /* повреждённые или недоступные данные — просто игнорируем */ }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(cart))); } catch { /* приватный режим */ }
}
function syncCart() {
  let n = 0, sum = 0;
  const list = $('#cartItems');
  const rows = [];
  cart.forEach((q, id) => {
    const p = PRODUCTS[id];
    n += q; sum += p.price * q;
    rows.push(el('div', { class: 'd-item' },
    productImage(p, true),
      el('div', { class: 'i' },
        el('b', { text: p.name }),
        el('div', { class: 'q' },
          el('button', { type: 'button', 'data-q': '-1', 'data-id': id, 'aria-label': 'Уменьшить количество: ' + p.name }, '−'),
          el('span', { 'aria-live': 'polite', text: String(q) }),
          el('button', { type: 'button', 'data-q': '1', 'data-id': id, 'aria-label': 'Увеличить количество: ' + p.name }, '+')
        )
      ),
      el('div', { class: 'price', text: fmt(p.price * q) })
    ));
  });
  if (rows.length) list.replaceChildren(...rows);
  else list.replaceChildren(el('p', { class: 'd-empty', text: 'Пока пусто. Олион поможет с выбором.' }));
  $('#cartTotal').textContent = fmt(sum);
  const c = $('#cartCount');
  c.textContent = String(n);
  c.classList.toggle('show', n > 0);
  cartBtn.setAttribute('aria-label', n ? `Открыть корзину, товаров: ${n}` : 'Открыть корзину');
  saveCart();
}
function bumpCart() {
  cartBtn.classList.remove('bump');
  void cartBtn.offsetWidth;
  cartBtn.classList.add('bump');
}
function flyToCart(from) {
  if (!from || reduceMotion() || !canAnimate) { bumpCart(); return; }
  const a = from.getBoundingClientRect(), b = cartBtn.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - Math.max(120, Math.abs(x1 - x0) * 0.25);
  const frames = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    frames.push({ transform: `translate(${x}px,${y}px) scale(${1 + Math.sin(t * Math.PI) * 0.5 - t * 0.5})`, opacity: t > 0.9 ? 0.5 : 1 });
  }
  const dot = el('div', { class: 'fly', 'aria-hidden': 'true' });
  document.body.append(dot);
  dot.animate(frames, { duration: 850, easing: 'cubic-bezier(.45,0,.4,1)' }).finished
    .catch(() => {}).then(() => { dot.remove(); bumpCart(); });
}
function addToCart(id, fromEl) {
  if (!hasOwn(PRODUCTS, id)) return;
  const q = cart.get(id) || 0;
  if (q >= MAX_QTY) { toast(`Не больше ${MAX_QTY} шт. одного продукта`); return; }
  cart.set(id, q + 1);
  syncCart();
  flyToCart(fromEl);
  toast(PRODUCTS[id].name + ' — в корзине');
  if (fromEl && fromEl.closest('#sortPanel')) botSay(['Принято. Продукт в корзине — оформить заказ можно в любой момент.']);
}
function openCart() { openLayer(drawer, { overlay, trigger: cartBtn }); }
cartBtn.addEventListener('click', openCart);
overlay.addEventListener('click', () => closeLayer(drawer));
$('#cartItems').addEventListener('click', e => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const id = b.dataset.id;
  if (!hasOwn(PRODUCTS, id)) return;
  const delta = b.dataset.q === '1' ? 1 : -1;
  const q = clamp((cart.get(id) || 0) + delta, 0, MAX_QTY);
  if (q <= 0) cart.delete(id); else cart.set(id, q);
  syncCart();
  const again = $(`#cartItems [data-id="${id}"][data-q="${delta > 0 ? 1 : -1}"]`);
  (again || drawer).focus({ preventScroll: true });
});
$('#checkoutBtn').addEventListener('click', () => {
  if (!cart.size) { toast('Корзина пуста'); return; }
  const pd = $('#consentPd'), of = $('#consentOffer');
  if (pd && !pd.checked) { toast('Нужно согласие на обработку персональных данных'); pd.focus(); return; }
  if (of && !of.checked) { toast('Нужно принять условия оферты'); of.focus(); return; }
  const emailInput = $('#orderEmail');
  const email = ((emailInput && emailInput.value) || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Укажите email для чека и кода заказа'); if (emailInput) emailInput.focus(); return; }
  const items = [];
  cart.forEach((q, id) => items.push({ id, name: PRODUCTS[id].name, qty: q, price: PRODUCTS[id].price }));
  const order = { code: 'HS-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), email, items, sum: items.reduce((sum, item) => sum + item.price * item.qty, 0), date: new Date().toISOString(), status: 'confirmed' };
  try {
    const orders = JSON.parse(localStorage.getItem('healsort.orders.v1') || '[]');
    if (Array.isArray(orders) && orders.length < 100) { orders.push(order); localStorage.setItem('healsort.orders.v1', JSON.stringify(orders)); }
  } catch {}
  cart.clear();
  syncCart();
  closeLayer(drawer);
  if (pd) pd.checked = false;
  if (of) of.checked = false;
  if (emailInput) emailInput.value = '';
  const code = $('#okCode');
  if (code) code.textContent = order.code;
  openLayer($('#okModal'));
  confetti();
});
loadCart();
syncCart();

function confetti() {
  if (reduceMotion() || !canAnimate) return;
  const colors = ['#c9a55c', '#e8d4a0', '#9a7a2e', '#46564d', '#f5ebd6'];
  const cx = innerWidth / 2, cy = innerHeight / 2 - 60;
  for (let i = 0; i < 46; i++) {
    const c = el('div', { class: 'confetti', 'aria-hidden': 'true' });
    c.style.background = colors[i % colors.length];
    document.body.append(c);
    const ang = Math.random() * Math.PI * 2, dist = 140 + Math.random() * 260;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - 80;
    const rot = (Math.random() - 0.5) * 900;
    c.animate([
      { transform: `translate(${cx}px,${cy}px) rotate(0) scale(.4)`, opacity: 1 },
      { transform: `translate(${cx + dx}px,${cy + dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${cx + dx * 1.1}px,${cy + dy + 260}px) rotate(${rot}deg) scale(.9)`, opacity: 0 }
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.catch(() => {}).then(() => c.remove());
  }
}

/* ===================== КАРТОЧКА ТОВАРА ===================== */
const prodModal = $('#prodModal');

/* Полноэкранная мобильная карточка: position:absolute/fixed внутри модалки
   ломается, если у модалки есть предок с transform/translate (секции с
   анимациями появления держат fill-both даже после завершения анимации).
   Тогда при скролле карточка «уезжает» вверх и снизу остаётся пустота.
   Лечение root-cause: модалка должна быть прямым ребёнком body. */
if (prodModal && prodModal.parentElement !== document.body) document.body.append(prodModal);
function openProduct(id, trigger) {
  if (!hasOwn(PRODUCTS, id)) return;
  const p = PRODUCTS[id];
 $('#pmImg').replaceChildren(productImage(p));
  const price = el('div', { class: 'p-price' }, fmt(p.price), p.old ? el('small', { text: fmt(p.old) }) : null);
  const kids = [
    el('div', { class: 'sec-tag', text: p.tag }),
    el('h3', { id: 'pmTitle', text: p.name }),
    price,
    el('div', { class: 'pm-why' }, el('b', { text: 'Почему этот продукт:' }), ' ' + p.why),
    el('div', { class: 'pm-block' }, el('h5', { text: 'Состав и дозировки' }),
      el('ul', null, p.comp.map(c => el('li', null, el('span', { text: c[0] }), el('b', { text: c[1] }))))),
    el('div', { class: 'pm-block' }, el('h5', { text: 'Как принимать' }), el('p', { text: p.how })),
    el('div', { class: 'pm-block' }, el('h5', { text: 'Ограничения' }), el('p', { text: p.limits })),
    el('div', { class: 'pm-block' }, el('h5', { text: 'Проверьте нас — документы' }),
      el('div', { class: 'pm-docs' }, ['СГР', 'Декларация', 'Протокол испытаний', 'Паспорт партии'].map(t => el('span', { text: t })))),
    el('div', { class: 'pm-cta' }, el('button', { class: 'btn btn-gold btn-block shine', type: 'button', 'data-add': p.id, 'data-close-modal': '' }, 'В корзину'))
  ];
  kids.forEach((k, i) => k.style.setProperty('--i', i));
  $('#pmInfo').replaceChildren(...kids);
  $('.modal-card', prodModal).scrollTop = 0;
  openLayer(prodModal, { trigger });
}

/* ===================== ДЕЛЕГИРОВАНИЕ КЛИКОВ ===================== */
document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;
  const add = t.closest('[data-add]');
  if (add) {
    const id = add.dataset.add;
    if (!hasOwn(PRODUCTS, id)) return;
    addToCart(id, add);
    if (add.hasAttribute('data-close-modal')) closeLayer(prodModal);
    return;
  }
  const op = t.closest('[data-open]');
  if (op) { openProduct(op.dataset.open, op); return; }
  const g = t.closest('[data-goal]');
  if (g) {
    if (!hasOwn(GOALS, g.dataset.goal)) return;
    openAssistant({ skipAsk: true });
    startQuiz(g.dataset.goal, true);
    return;
  }
  if (t.closest('[data-open-assist]')) {
    const fresh = !greeted;
    openAssistant();
    if (!fresh) askGoal();
  }
});

/* ===================== ОЛИОН — ПОМОЩНИК ===================== */
const panel = $('#sortPanel'), msgs = $('#chatMsgs'), quick = $('#quickRow'), fab = $('#sortFab'), hint = $('#sortHint');
let greeted = false, quiz = null, chain = Promise.resolve(), lastSend = 0;

const scrollChat = () => msgs.scrollTo({ top: msgs.scrollHeight, behavior: reduceMotion() ? 'auto' : 'smooth' });
/* Все реплики идут в одну очередь, чтобы не перемешивались */
function enqueue(fn) { chain = chain.then(fn).catch(() => {}); return chain; }
function botSay(parts, after) {
  return enqueue(() => new Promise(res => {
    const typing = el('div', { class: 'typing', 'aria-hidden': 'true' }, el('span'), el('span'), el('span'));
    msgs.append(typing);
    scrollChat();
    setTimeout(() => {
      typing.remove();
      msgs.append(el('div', { class: 'msg bot' }, parts));
      scrollChat();
      if (after) after();
      res();
    }, reduceMotion() ? 250 : 650 + Math.random() * 350);
  }));
}
function userSay(text) {
  return enqueue(() => { msgs.append(el('div', { class: 'msg user', text })); scrollChat(); });
}
function setChips(list) {
  quick.replaceChildren(...list.map((c, i) => {
    const b = el('button', { class: 'chip', type: 'button', 'data-a': c.a, 'data-v': c.v || '' }, c.t);
    b.style.setProperty('--i', i);
    return b;
  }));
}
const goalChips = () => Object.entries(GOALS).map(([k, g]) => ({ t: g.label, a: 'goal', v: k }))
  .concat([{ t: 'Документы', a: 'sys', v: 'docs' }, { t: 'Доставка', a: 'sys', v: 'delivery' }]);

function openAssistant({ skipAsk = false } = {}) {
  hint.classList.remove('show');
  if (!isOpen(panel)) {
    openLayer(panel, { modal: false, trigger: fab, focus: finePointer });
    fab.classList.add('hide');
  }
  if (!greeted) {
    greeted = true;
    botSay(['Здравствуйте. Я Олион — помощник ХилСорт. Я не врач, но помогу разобраться: что вам действительно нужно, а что покупать не стоит.']);
    if (!skipAsk) askGoal();
  }
}
function askGoal() {
  quiz = null;
  quick.replaceChildren();
  botSay(['Что вас беспокоит? Выберите вариант или напишите своими словами.'], () => setChips(goalChips()));
}
function closeAssistant() { closeLayer(panel); fab.classList.remove('hide'); }
fab.addEventListener('click', () => openAssistant());
$('#heroAssist').addEventListener('click', () => openAssistant());
$('#sortClose').addEventListener('click', closeAssistant);
new MutationObserver(() => { if (!panel.classList.contains('open')) fab.classList.remove('hide'); })
  .observe(panel, { attributes: true, attributeFilter: ['class'] });

function startQuiz(goal, echo) {
  if (!hasOwn(GOALS, goal)) return;
  quiz = { goal, safety: false, meds: false };
  quick.replaceChildren();
  const g = GOALS[goal];
  if (echo) userSay(g.label);
  if (g.q) botSay([g.q], () => setChips(g.opts.map(o => ({ t: o, a: 'clarify', v: o }))));
  else askSafety();
}
function askSafety() {
  botSay(['Подбираем честно. Есть ли заболевания, беременность или лактация? Это важно для безопасности.'],
    () => setChips([{ t: 'Да', a: 'safety', v: '1' }, { t: 'Нет', a: 'safety', v: '0' }]));
}
function askMeds() {
  botSay(['Принимаете сейчас добавки или лекарства?'],
    () => setChips([{ t: 'Да', a: 'meds', v: '1' }, { t: 'Нет', a: 'meds', v: '0' }]));
}
function finish() {
  if (!quiz || !hasOwn(GOALS, quiz.goal)) return;
  const g = GOALS[quiz.goal], p = PRODUCTS[g.main];
  const parts = [el('b', { text: 'На что обратить внимание' }), el('br'),
    '— Цель: ' + g.label.toLowerCase() + '.', el('br'), '— Совет: ' + g.tip + '.'];
  if (quiz.safety) parts.push(el('span', { class: 'safety', text: 'По вашим ответам самостоятельный подбор может быть некорректным. Рекомендуем обсудить приём со специалистом — ниже справочная информация.' }));
  if (quiz.meds) parts.push(el('br'), '— Если принимаете лекарства — сверьте совместимость со специалистом.');
  parts.push(el('br'), el('br'), 'Подходящий продукт — ', el('b', { text: p.name }), '. Почему он: ' + p.why);
  botSay(parts, () => {
    msgs.append(el('div', { class: 'chat-prod' },
      el('div', { class: 'cp-top' }, productImage(p, true), el('div', null, el('b', { text: p.name }), el('span', { class: 'pr', text: fmt(p.price) }))),
      el('div', { class: 'cp-btns' },
        el('button', { class: 'cp-add', type: 'button', 'data-add': p.id }, 'В корзину'),
        el('button', { class: 'cp-open', type: 'button', 'data-open': p.id }, 'Подробнее'))
    ));
    scrollChat();
    setChips([{ t: 'Документы', a: 'sys', v: 'docs' }, { t: 'Начать заново', a: 'sys', v: 'restart' }]);
  });
}
quick.addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const a = c.dataset.a, v = c.dataset.v;
  const label = c.textContent;
  quick.replaceChildren(); // защита от двойных кликов и «гонок» сценария
  if (a === 'goal' && hasOwn(GOALS, v)) { userSay(label); startQuiz(v, false); }
  else if (a === 'clarify' && quiz) { userSay(label); askSafety(); }
  else if (a === 'safety' && quiz) { userSay(v === '1' ? 'Да' : 'Нет'); quiz.safety = v === '1'; askMeds(); }
  else if (a === 'meds' && quiz) { userSay(v === '1' ? 'Да' : 'Нет'); quiz.meds = v === '1'; finish(); }
  else if (a === 'sys') sysAction(v, label, true);
  else setChips(goalChips());
});
function sysAction(v, label, echo) {
  if (v === 'restart') { if (echo) userSay(label); askGoal(); return; }
  if (v === 'docs') {
    if (echo) userSay('Документы');
    botSay(['Мы ничего не прячем. По каждому продукту доступны: СГР, декларация соответствия, протокол испытаний и паспорт качества партии. Всё — в карточке товара, раздел «Проверьте нас».'], () => setChips(goalChips()));
    return;
  }
  if (v === 'delivery') {
    if (echo) userSay('Доставка');
    botSay(['Доставка по России 2–5 дней. Бесплатно от 3 000 ₽. Адрес сохранится для быстрого повтора заказа.'], () => setChips(goalChips()));
  }
}
const INTENTS = [
  [/сплю|сон|бессон|засыпа/, 'sleep'], [/стресс|тревог|нервн/, 'stress'], [/уста|энерг|сил нет|разбит/, 'energy'],
  [/концентр|фокус|вниман/, 'focus'], [/женск|гормон|инозит/, 'women'], [/восстан|тренир|спорт/, 'recovery']
];
// Удаляем управляющие и «невидимые» символы (в т.ч. bidi-override), ограничиваем длину
const cleanInput = s => String(s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);

$('#chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#chatInput');
  const t = cleanInput(inp.value);
  if (!t) return;
  const now = Date.now();
  if (now - lastSend < 800) { toast('Секунду — Олион ещё отвечает'); return; }
  lastSend = now;
  inp.value = '';
  quick.replaceChildren();
  userSay(t);
  const low = t.toLowerCase();
  const hit = INTENTS.find(m => m[0].test(low));
  if (hit) return startQuiz(hit[1], false);
  if (/документ|сгр|сертифик/.test(low)) return sysAction('docs', '', false);
  if (/достав|курьер/.test(low)) return sysAction('delivery', '', false);
  if (/принимать|дозиров|как пить/.test(low)) return botSay(['Способ приёма указан по маркировке каждого продукта. Например, Магния Хелат Оптимум — по 1 капсуле 2 раза в день во время еды.'], () => setChips(goalChips()));
  if (/привет|здравств|добрый/.test(low)) return botSay(['Здравствуйте. Расскажите, что беспокоит — подберу формулу.'], () => setChips(goalChips()));
  if (/корзин|купить/.test(low)) return botSay(['Корзина — в шапке сайта. А если нужно подобрать продукт — начнём с цели.'], () => setChips(goalChips()));
  botSay(['Я ещё учусь понимать тонкости. Но отлично разбираюсь в целях — выберите ниже или опишите, что беспокоит: сон, стресс, усталость.'], () => setChips(goalChips()));
});

/* ===================== ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ ===================== */
function splitWords(title) {
  const out = [];
  let i = 0;
  const wrap = (node) => {
    const w = el('span', { class: 'w' });
    const wi = el('span', { class: 'wi' }, node);
    wi.style.setProperty('--i', i++);
    w.append(wi);
    return w;
  };
  title.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        out.push(/^\s+$/.test(part) ? document.createTextNode(' ') : wrap(document.createTextNode(part)));
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        out.push(/^\s+$/.test(part) ? document.createTextNode(' ') : wrap(el(tag, { text: part })));
      });
    }
  });
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  out.forEach(n => { if (n.nodeType === 1) n.setAttribute('aria-hidden', 'true'); });
  title.replaceChildren(...out);
}
$$('.sec-title').forEach(splitWords);

$$('.stg').forEach(g => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
$$('.t-table .t-row').forEach((r, i) => r.style.setProperty('--i', i));
$$('.story-stats .s-card').forEach((c, i) => c.style.setProperty('--i', i));
$$('.path-grid .step').forEach((s, i) => s.style.setProperty('--i', i));
$$('.prod-grid .p-card').forEach((c, i) => c.style.setProperty('--d', (i * 0.14) + 's'));

function countUp(node) {
  const target = parseInt(node.dataset.count, 10);
  if (!Number.isFinite(target)) return;
  const suffix = node.dataset.suffix || '';
  if (reduceMotion()) { node.textContent = target + suffix; return; }
  const dur = 1600, t0 = performance.now();
  const tick = now => {
    const k = clamp((now - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - k, 4);
    node.textContent = Math.round(target * e) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const revealIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    revealIO.unobserve(en.target);
    if (en.target.classList.contains('story-stats')) setTimeout(() => $$('[data-count]', en.target).forEach(countUp), 250);
  });
}, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
$$('.rv, .rv-group, .stg').forEach(n => revealIO.observe(n));

/* ===================== НАВИГАЦИЯ И СКРОЛЛ ===================== */
const nav = $('#nav'), bar = $('#progressBar'), hero = $('.hero');
const burger = $('#navBurger');
if (burger) {
  const setMenu = open => {
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
  $$('.hn-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => {
    if (nav.classList.contains('menu-open') && !e.target.closest('.hero-nav')) setMenu(false);
  });
}
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    nav.classList.toggle('scrolled', y > 40);
    if (!reduceMotion() && y < hero.offsetHeight * 1.2) hero.style.setProperty('--sy', y.toFixed(1));
  });
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const navLinks = $$('.hn-links a');
const spyIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => spyIO.observe(s));

/* Параллакс от курсора в hero */
if (finePointer) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const loop = () => {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    hero.style.setProperty('--mx', cx.toFixed(4));
    hero.style.setProperty('--my', cy.toFixed(4));
    raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(loop) : 0;
  };
  hero.addEventListener('pointermove', e => {
    if (reduceMotion()) return;
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
}

/* 3D-наклон карточек */
if (finePointer) {
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointerenter', () => card.classList.add('tilting'));
    card.addEventListener('pointermove', e => {
      if (reduceMotion()) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ===================== ПЫЛЬЦА (canvas) ===================== */
function pollen() {
  const c = $('#pollen');
  if (!c || reduceMotion()) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  let w = 0, h = 0, parts = [], raf = 0, visible = true;
  const spawn = any => ({
    x: Math.random() * w, y: any ? Math.random() * h : h + 10,
    r: 0.6 + Math.random() * 1.7, vy: -(0.12 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 0.15,
    ph: Math.random() * Math.PI * 2, sp: 0.008 + Math.random() * 0.018
  });
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(clamp(w * h / 24000, 18, 64));
    parts = Array.from({ length: n }, () => spawn(true));
  };
  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y += p.vy; p.ph += p.sp; p.x += p.vx + Math.sin(p.ph) * 0.22;
      if (p.y < -10 || p.x < -20 || p.x > w + 20) Object.assign(p, spawn(false));
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.ph * 1.7));
      const fade = clamp(p.y / (h * 0.35), 0, 1) * clamp((h - p.y) / (h * 0.15), 0, 1);
      ctx.globalAlpha = 0.18 * tw * fade;
      ctx.fillStyle = '#c9a55c';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85 * tw * fade;
      ctx.fillStyle = '#e8d4a0';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  resize();
  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 150); }, { passive: true });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(hero);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
}

/* ===================== МАСКОТ ОЛИОН ===================== */
const mascot = $('#mascot');
const M = {
  run: $('.m-run', mascot), hop: $('.m-hop', mascot), lean: $('.m-lean', mascot), shadow: $('.m-shadow', mascot),
  armL: $('.m-arm-l', mascot), armR: $('.m-arm-r', mascot), footL: $('.m-foot-l', mascot), footR: $('.m-foot-r', mascot),
  bubble: $('#mBubble')
};
let mState = 'offstage';

function puff(x, y, size, dx, dy, dur) {
  const d = el('div', { class: 'dust', 'aria-hidden': 'true' });
  d.style.width = d.style.height = size + 'px';
  hero.append(d);
  d.animate([
    { transform: `translate(${x - size / 2}px,${y - size / 2}px) scale(.35)`, opacity: 0.85 },
    { transform: `translate(${x - size / 2 + dx}px,${y - size / 2 + dy}px) scale(1.7)`, opacity: 0 }
  ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.catch(() => {}).then(() => d.remove());
}
function feetPoint() {
  const hr = hero.getBoundingClientRect();
  const r = M.hop.getBoundingClientRect();
  return { x: r.left - hr.left + r.width * 0.5, y: r.top - hr.top + r.height * 0.97, w: r.width };
}

async function runIn() {
  mState = 'running';
  const rect = mascot.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const startX = -(rect.left + W * 1.6);
  const RUN = clamp(Math.abs(startX) * 1.9, 1200, 2000);
  const STEP = 250;
  const steps = Math.max(2, Math.round(RUN / STEP / 2) * 2);
  const stepDur = RUN / steps;

  const run = M.run.animate([
    { transform: `translateX(${startX}px)` },
    { transform: `translateX(${W * 0.1}px)`, offset: 0.9 },
    { transform: 'translateX(0)' }
  ], { duration: RUN, easing: 'cubic-bezier(.3,.55,.4,1)', fill: 'backwards' });

  const lift = H * 0.1;
  M.hop.animate([
    { transform: 'translateY(0) scale(1.05,.95)', easing: 'cubic-bezier(.2,.7,.4,1)' },
    { transform: `translateY(${-lift}px) scale(.97,1.04)`, offset: 0.5, easing: 'cubic-bezier(.6,0,.8,.3)' },
    { transform: 'translateY(0) scale(1.05,.95)' }
  ], { duration: stepDur, iterations: steps });
  M.shadow.animate([
    { transform: 'translateX(-50%) scale(1)', opacity: 1 },
    { transform: 'translateX(-50%) scale(.7)', opacity: 0.55, offset: 0.5 },
    { transform: 'translateX(-50%) scale(1)', opacity: 1 }
  ], { duration: stepDur, iterations: steps });
  M.lean.animate([
    { transform: 'rotate(0deg) skewX(0deg)' },
    { transform: 'rotate(9deg) skewX(-5deg)', offset: 0.12 },
    { transform: 'rotate(9deg) skewX(-5deg)', offset: 0.86 },
    { transform: 'rotate(-6deg) skewX(3deg)' }
  ], { duration: RUN, easing: 'ease-out', fill: 'forwards' });
  const footKF = [
    { transform: 'translateY(0) rotate(0deg)' },
    { transform: `translateY(${-H * 0.075}px) rotate(-22deg)`, offset: 0.3 },
    { transform: 'translateY(0) rotate(8deg)', offset: 0.6 },
    { transform: 'translateY(0) rotate(0deg)' }
  ];
  M.footL.animate(footKF, { duration: stepDur * 2, iterations: steps / 2 });
  M.footR.animate(footKF, { duration: stepDur * 2, iterations: steps / 2, iterationStart: 0.5 });
  M.armL.animate([{ transform: 'rotate(-6deg)' }, { transform: 'rotate(26deg)' }, { transform: 'rotate(-6deg)' }], { duration: stepDur * 2, iterations: steps / 2, easing: 'ease-in-out' });
  M.armR.animate([{ transform: 'rotate(6deg)' }, { transform: 'rotate(-26deg)' }, { transform: 'rotate(6deg)' }], { duration: stepDur * 2, iterations: steps / 2, easing: 'ease-in-out', iterationStart: 0.5 });

  // пыль из-под ног
  const dustTimer = setInterval(() => {
    const f = feetPoint();
    if (f.x < -40) return;
    puff(f.x - f.w * 0.15, f.y, f.w * (0.18 + Math.random() * 0.12), -f.w * (0.35 + Math.random() * 0.3), -f.w * (0.05 + Math.random() * 0.12), 650 + Math.random() * 300);
  }, stepDur);

  await run.finished.catch(() => {});
  clearInterval(dustTimer);

  // торможение: облачко, отклонение назад, «пружинка»
  mState = 'braking';
  const f = feetPoint();
  for (let i = 0; i < 6; i++) {
    const s = (i % 2 ? 1 : -1);
    puff(f.x + f.w * 0.25 * s, f.y, f.w * (0.22 + Math.random() * 0.14), f.w * (0.25 + Math.random() * 0.35) * s, -f.w * (0.08 + Math.random() * 0.1), 700 + Math.random() * 300);
  }
  const lean = M.lean.getAnimations();
  const brake = M.lean.animate([
    { transform: 'rotate(-6deg) skewX(3deg)' },
    { transform: 'rotate(5deg) skewX(-2deg)', offset: 0.4 },
    { transform: 'rotate(-2deg) skewX(0deg)', offset: 0.7 },
    { transform: 'rotate(0deg) skewX(0deg)' }
  ], { duration: 700, easing: 'ease-out' });
  lean.forEach(a => a.cancel());
  M.hop.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.08,.9)', offset: 0.25 },
    { transform: 'translateY(-6px) scale(.97,1.05)', offset: 0.55 },
    { transform: 'scale(1)' }
  ], { duration: 700, easing: 'ease-out' });
  await brake.finished.catch(() => {});
  mState = 'idle';
}

function wave({ bubble = true } = {}) {
  if (mState !== 'idle' || reduceMotion() || !canAnimate) return Promise.resolve();
  mState = 'waving';
  const D = 2000;
  const ease = 'ease-in-out';
  const armA = M.armR.animate([
    { transform: 'rotate(0deg)', easing: 'cubic-bezier(.3,1.3,.5,1)' },
    { transform: 'rotate(-100deg)', offset: 0.2, easing: ease },
    { transform: 'rotate(-68deg)', offset: 0.33, easing: ease },
    { transform: 'rotate(-102deg)', offset: 0.46, easing: ease },
    { transform: 'rotate(-68deg)', offset: 0.59, easing: ease },
    { transform: 'rotate(-98deg)', offset: 0.72, easing: 'cubic-bezier(.5,0,.3,1)' },
    { transform: 'rotate(0deg)' }
  ], { duration: D, composite: 'add' });
  M.lean.animate([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(-4deg)', offset: 0.2 },
    { transform: 'rotate(-2deg)', offset: 0.46 },
    { transform: 'rotate(-4deg)', offset: 0.72 },
    { transform: 'rotate(0deg)' }
  ], { duration: D, easing: ease });
  M.armL.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)', offset: 0.25 }, { transform: 'rotate(8deg)', offset: 0.75 }, { transform: 'rotate(0deg)' }], { duration: D, easing: ease, composite: 'add' });
  M.hop.animate([
    { transform: 'translateY(0)' }, { transform: 'translateY(-8px) scale(1.02,.99)', offset: 0.18 },
    { transform: 'translateY(-3px)', offset: 0.5 }, { transform: 'translateY(0)' }
  ], { duration: D, easing: ease, composite: 'add' });
  if (bubble) {
    M.bubble.animate([
      { opacity: 0, transform: 'scale(.4) translateY(10px)' },
      { opacity: 1, transform: 'scale(1.06) translateY(0)', offset: 0.1 },
      { opacity: 1, transform: 'scale(1) translateY(0)', offset: 0.16 },
      { opacity: 1, transform: 'scale(1) translateY(0)', offset: 0.85 },
      { opacity: 0, transform: 'scale(.8) translateY(-6px)' }
    ], { duration: D + 600, easing: 'ease-out' });
  }
  return armA.finished.catch(() => {}).then(() => { mState = 'idle'; });
}

async function intro() {
  const imgs = $$('img', mascot);
  const ready = Promise.all(imgs.map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {})));
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([ready, fonts]), sleep(2200)]);

  // буквы заголовка
  const mega = $('#mega');
  const word = mega.textContent.trim();
  mega.setAttribute('aria-label', word);
  mega.replaceChildren(...[...word].map((ch, i) => {
    const inner = el('span', { class: 'ch', text: ch });
    inner.style.setProperty('--i', i);
    return el('span', { class: 'cw', 'aria-hidden': 'true' }, inner);
  }));

  const motion = root.classList.contains('intro') && !reduceMotion() && canAnimate;
  void document.body.offsetWidth;
  root.classList.add('play');

  if (motion) {
    await sleep(650);
    await runIn();
    mascot.classList.add('is-idle');
    await sleep(120);
    await wave();
  } else {
    mState = 'idle';
    mascot.classList.add('is-idle');
  }
  root.classList.remove('intro');
  root.classList.add('intro-done');

  setTimeout(() => { if (!isOpen(panel)) hint.classList.add('show'); }, motion ? 1800 : 2200);
  setTimeout(() => hint.classList.remove('show'), motion ? 11000 : 12000);
}

let hoverT = 0;
mascot.addEventListener('pointerenter', () => {
  if (!finePointer) return;
  clearTimeout(hoverT);
  hoverT = setTimeout(() => wave({ bubble: false }), 120);
});
mascot.addEventListener('pointerleave', () => clearTimeout(hoverT));
const mascotActivate = () => {
  wave();
  setTimeout(() => openAssistant(), reduceMotion() ? 0 : 900);
};
mascot.addEventListener('click', mascotActivate);
mascot.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mascotActivate(); }
});

/* ===================== СТАРТ ===================== */
const year = $('#year');
if (year) year.textContent = String(Math.max(2026, new Date().getFullYear()));
pollen();
intro();

})();