require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { verifyAdmin, changePassword, changeUsername, requireAuth, issueCsrfToken, requireCsrf } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3504;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-before-deploy';

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ['https://yandex.ru'],
    },
  },
}));

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.' },
});

app.use('/api/admin', (req, res, next) => {
  const isSafeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  const isLoginRoute = req.path === '/login';
  if (isSafeMethod || isLoginRoute) return next();
  return requireCsrf(req, res, next);
});

// ===================== ПУБЛИЧНОЕ API =====================

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

app.get('/api/services', (req, res) => {
  res.json(db.prepare('SELECT id, slug, title, short_desc, image FROM services ORDER BY sort_order').all());
});

app.get('/api/services/:slug', (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE slug = ?').get(req.params.slug);
  if (!service) return res.status(404).json({ error: 'Направление не найдено.' });
  res.json(service);
});

app.get('/api/price-categories', (req, res) => {
  res.json(db.prepare('SELECT id, slug, title, intro FROM price_categories ORDER BY sort_order').all());
});

app.get('/api/price-index', (req, res) => {
  const categories = db.prepare('SELECT id, slug, title, intro FROM price_categories ORDER BY sort_order').all();
  const allItems = db.prepare('SELECT id, category_id, title, price_note FROM price_items ORDER BY sort_order').all();
  res.json(categories.map(cat => ({
    ...cat,
    items: allItems.filter(i => i.category_id === cat.id),
  })));
});

app.get('/api/doctors', (req, res) => {
  res.json(db.prepare('SELECT * FROM doctors ORDER BY sort_order').all());
});

app.get('/api/reviews', (req, res) => {
  res.json(db.prepare('SELECT id, author_name, body, published_at FROM reviews ORDER BY published_at DESC').all());
});

app.post('/api/leads', (req, res) => {
  const { name, phone, service_or_doctor, preferred_time, message, consent, source } = req.body || {};
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: 'Укажите телефон.' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Нужно согласие на обработку персональных данных.' });
  }
  db.prepare(`
    INSERT INTO leads (name, phone, service_or_doctor, preferred_time, message, source, consent_given)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(name || null, String(phone).trim(), service_or_doctor || null, preferred_time || null, message || null, source || 'zapis-form');
  res.json({ ok: true });
});

// ===================== АДМИН: АВТОРИЗАЦИЯ =====================

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyAdmin(username, password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль.' });
  }
  // Регенерация session ID при логине — предотвращает session fixation
  // (старый ID сессии, выданный до аутентификации, становится бесполезен).
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Не удалось создать сессию. Попробуйте ещё раз.' });
    }
    req.session.adminUsername = username;
    const csrfToken = issueCsrfToken(req);
    res.json({ ok: true, username, csrfToken });
  });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.adminUsername) {
    const csrfToken = req.session.csrfToken || issueCsrfToken(req);
    return res.json({ username: req.session.adminUsername, csrfToken });
  }
  res.status(401).json({ error: 'Не авторизован.' });
});

app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 10) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 10 символов.' });
  }
  changePassword(req.session.adminUsername, newPassword);
  res.json({ ok: true });
});

app.post('/api/admin/change-username', requireAuth, (req, res) => {
  const { newUsername, currentPassword } = req.body || {};
  const trimmed = String(newUsername || '').trim();
  if (!trimmed || trimmed.length < 3) {
    return res.status(400).json({ error: 'Логин должен быть не короче 3 символов.' });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Укажите текущий пароль для подтверждения.' });
  }
  const result = changeUsername(req.session.adminUsername, trimmed, currentPassword);
  if (result.error === 'wrong_password') {
    return res.status(401).json({ error: 'Неверный текущий пароль.' });
  }
  if (result.error === 'taken') {
    return res.status(409).json({ error: 'Такой логин уже занят.' });
  }
  req.session.adminUsername = result.username;
  res.json({ ok: true, username: result.username });
});

// ===================== АДМИН: НАСТРОЙКИ =====================

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const updates = req.body || {};
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const tx = db.transaction(() => { Object.entries(updates).forEach(([k, v]) => upsert.run(k, String(v))); });
  tx();
  res.json({ ok: true });
});

// ===================== АДМИН: ПРАЙС-ЛИСТ =====================

app.put('/api/admin/price-categories/:id', requireAuth, (req, res) => {
  const { title, intro } = req.body || {};
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (intro !== undefined) { fields.push('intro = ?'); values.push(intro); }
  if (!fields.length) return res.status(400).json({ error: 'Нечего обновлять.' });
  values.push(req.params.id);
  db.prepare(`UPDATE price_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

app.put('/api/admin/price-items/:id', requireAuth, (req, res) => {
  const { title, price_note } = req.body || {};
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (price_note !== undefined) { fields.push('price_note = ?'); values.push(price_note); }
  if (!fields.length) return res.status(400).json({ error: 'Нечего обновлять.' });
  values.push(req.params.id);
  db.prepare(`UPDATE price_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

app.post('/api/admin/price-items', requireAuth, (req, res) => {
  const { category_id, title, price_note } = req.body || {};
  if (!category_id || !title) return res.status(400).json({ error: 'category_id и title обязательны.' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM price_items WHERE category_id = ?').get(category_id).m;
  const result = db.prepare('INSERT INTO price_items (category_id, title, price_note, sort_order) VALUES (?, ?, ?, ?)')
    .run(category_id, title, price_note || '', maxOrder + 1);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete('/api/admin/price-items/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM price_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===================== АДМИН: СПЕЦИАЛИСТЫ =====================

app.get('/api/admin/doctors', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM doctors ORDER BY sort_order').all());
});

app.put('/api/admin/doctors/:id', requireAuth, (req, res) => {
  const { full_name, role, experience_years, bio, photo } = req.body || {};
  const fields = [];
  const values = [];
  if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (experience_years !== undefined) { fields.push('experience_years = ?'); values.push(experience_years); }
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (photo !== undefined) { fields.push('photo = ?'); values.push(photo); }
  if (!fields.length) return res.status(400).json({ error: 'Нечего обновлять.' });
  values.push(req.params.id);
  db.prepare(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// ===================== АДМИН: ЗАЯВКИ =====================

app.get('/api/admin/leads', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all());
});

app.put('/api/admin/leads/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status обязателен.' });
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/leads/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===================== СТАТИКА И СТРАНИЦЫ =====================

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/o-klinike', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'o-klinike.html'));
});

app.get('/spetsialisty', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'spetsialisty.html'));
});

app.get('/uslugi', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'uslugi.html'));
});

app.get('/uslugi/:slug', (req, res) => {
  const service = db.prepare('SELECT title, short_desc FROM services WHERE slug = ?').get(req.params.slug);
  if (!service) {
    return res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
  }
  const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'usluga-detail.html'), 'utf8');
  const title = escapeHtml(service.title + ' — Медицинский центр «Планета Здоровья», Красноярск');
  const description = escapeHtml((service.short_desc || 'Медицинские услуги в Красноярске.')).slice(0, 160);
  const canonical = `https://planetazdorovya-site-1.onrender.com/uslugi/${escapeHtml(req.params.slug)}`;
  const html = template
    .replace('<title id="pageTitle">Направление — Медицинский центр «Планета Здоровья»</title>', `<title id="pageTitle">${title}</title>`)
    .replace(
      '<meta name="description" id="pageDescription" content="Медицинские услуги в Красноярске.">',
      `<meta name="description" id="pageDescription" content="${description}">\n<link rel="canonical" href="${canonical}">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${description}">\n<meta property="og:type" content="website">`
    );
  res.send(html);
});

app.get('/tseny', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'tseny.html'));
});

app.get('/otzyvy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'otzyvy.html'));
});

app.get('/litsenzii', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'litsenzii.html'));
});

app.get('/karyera', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'karyera.html'));
});

app.get('/kontakty', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'kontakty.html'));
});

app.get('/zapis', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'zapis.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`Медицинский центр «Планета Здоровья» запущен: http://localhost:${PORT}`);
  console.log(`Админ-панель: http://localhost:${PORT}/admin`);
});
