/* Личный кабинет. Это локальный прототип: для production нужны серверные сессии и хэширование паролей на сервере. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const USERS = 'healsort.users.v1', SESSION = 'healsort.session.v1', ORDERS = 'healsort.orders.v1';
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const weakHash = value => { let hash = 5381; for (let i = 0; i < value.length; i++) hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0; return hash.toString(16); };
  async function hash(value, salt) {
    const input = new TextEncoder().encode(salt + ':' + value);
    if (window.crypto && crypto.subtle) return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input))).map(x => x.toString(16).padStart(2, '0')).join('');
    return weakHash(salt + ':' + value);
  }
  const auth = $('#authBlock'), cabinet = $('#cabBlock'), login = $('#loginForm'), registration = $('#regForm');
  const loginError = $('#loginErr'), registrationError = $('#regErr');
  function showTab(reg) { $('#tabLogin').classList.toggle('active', !reg); $('#tabReg').classList.toggle('active', reg); $('#tabLogin').setAttribute('aria-selected', String(!reg)); $('#tabReg').setAttribute('aria-selected', String(reg)); login.hidden = reg; registration.hidden = !reg; loginError.textContent = ''; registrationError.textContent = ''; }
  $('#tabLogin').addEventListener('click', () => showTab(false)); $('#tabReg').addEventListener('click', () => showTab(true)); $('#toLogin').addEventListener('click', () => showTab(false)); $('#toReg').addEventListener('click', () => showTab(true));
  registration.addEventListener('submit', async event => {
    event.preventDefault(); registrationError.textContent = ''; const form = new FormData(registration);
    const name = String(form.get('name') || '').trim(), phone = String(form.get('phone') || '').trim(), email = String(form.get('email') || '').trim().toLowerCase(), pass = String(form.get('pass') || '');
    if (name.length < 2) { registrationError.textContent = 'Укажите имя'; return; }
    if (!/^[+\d][\d\s()\-]{9,17}$/.test(phone)) { registrationError.textContent = 'Укажите корректный телефон'; return; }
    if (!validEmail(email)) { registrationError.textContent = 'Введите корректный email'; return; }
    if (pass.length < 8) { registrationError.textContent = 'Пароль должен быть не короче 8 символов'; return; }
    if (!form.get('pd') || !form.get('offer')) { registrationError.textContent = 'Нужны оба обязательных согласия'; return; }
    const users = read(USERS, {}); if (users[email]) { registrationError.textContent = 'Пользователь уже зарегистрирован'; return; }
    const salt = crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => x.toString(16).padStart(2, '0')).join('') : Math.random().toString(36).slice(2);
    users[email] = { name, phone, salt, passHash: await hash(pass, salt), promo: Boolean(form.get('promo')), createdAt: new Date().toISOString() }; write(USERS, users); write(SESSION, { email }); render();
  });
  login.addEventListener('submit', async event => { event.preventDefault(); loginError.textContent = ''; const form = new FormData(login); const email = String(form.get('email') || '').trim().toLowerCase(), pass = String(form.get('pass') || ''); const user = read(USERS, {})[email]; if (!user || user.passHash !== await hash(pass, user.salt)) { loginError.textContent = 'Неверный email или пароль'; return; } write(SESSION, { email }); render(); });
  $('#logoutBtn').addEventListener('click', () => { localStorage.removeItem(SESSION); render(); });
  $('#deleteBtn').addEventListener('click', () => { const session = read(SESSION, null); if (!session || !window.confirm('Удалить аккаунт и историю заказов?')) return; const users = read(USERS, {}); delete users[session.email]; write(USERS, users); write(ORDERS, read(ORDERS, []).filter(order => order.email !== session.email)); localStorage.removeItem(SESSION); render(); });
  function addText(parent, tag, text, className) { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; parent.append(node); return node; }
  function render() {
    const session = read(SESSION, null), user = session && read(USERS, {})[session.email]; auth.hidden = Boolean(user); cabinet.hidden = !user; if (!user) { showTab(false); return; }
    $('#cabHello').textContent = 'Здравствуйте, ' + user.name + '!'; $('#cabEmail').textContent = session.email; const box = $('#ordersList'); box.replaceChildren(); const orders = read(ORDERS, []).filter(order => order.email === session.email).sort((a, b) => b.date.localeCompare(a.date));
    if (!orders.length) { addText(box, 'p', 'Заказов пока нет. Первый заказ появится здесь вместе с кодом.'); return; }
    orders.forEach(order => { const card = document.createElement('article'); card.className = 'order-card'; const top = document.createElement('div'); top.className = 'order-top'; addText(top, 'span', order.code, 'order-code'); addText(top, 'span', 'Подтверждён', 'order-status'); card.append(top); addText(card, 'div', order.items.map(item => item.name + ' x' + item.qty).join(', ') + ' — ' + order.sum.toLocaleString('ru-RU') + ' ₽', 'order-items'); addText(card, 'div', new Date(order.date).toLocaleString('ru-RU'), 'order-date'); const buttons = document.createElement('div'); buttons.className = 'order-btns'; const receipt = document.createElement('button'); receipt.type = 'button'; receipt.className = 'btn btn-gold'; receipt.textContent = 'Чек'; receipt.addEventListener('click', () => printReceipt(order, user)); const repeat = document.createElement('button'); repeat.type = 'button'; repeat.className = 'btn btn-ghost dark'; repeat.textContent = 'Повторить заказ'; repeat.addEventListener('click', () => repeatOrder(order)); buttons.append(receipt, repeat); card.append(buttons); box.append(card); });
  }
  function repeatOrder(order) { const cart = read('healsort.cart.v1', {}); order.items.forEach(item => { cart[item.id] = Math.min(20, (cart[item.id] || 0) + item.qty); }); write('healsort.cart.v1', cart); location.href = 'index.html#catalog'; }
  function printReceipt(order, user) { const doc = $('#printDoc'); doc.replaceChildren(); addText(doc, 'h1', 'Квитанция заказа ' + order.code); addText(doc, 'p', 'Продавец: ООО «ХилСорт». Реквизиты необходимо заменить на реальные.'); addText(doc, 'p', 'Покупатель: ' + user.name + ', ' + order.email); addText(doc, 'p', 'Дата: ' + new Date(order.date).toLocaleString('ru-RU')); const table = document.createElement('table'); const header = document.createElement('tr'); ['Товар', 'Количество', 'Цена', 'Сумма'].forEach(text => addText(header, 'th', text)); table.append(header); order.items.forEach(item => { const row = document.createElement('tr'); [item.name, String(item.qty), item.price.toLocaleString('ru-RU') + ' ₽', (item.price * item.qty).toLocaleString('ru-RU') + ' ₽'].forEach(text => addText(row, 'td', text)); table.append(row); }); doc.append(table); addText(doc, 'p', 'Итого: ' + order.sum.toLocaleString('ru-RU') + ' ₽'); document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing'); }
  render();
})();
