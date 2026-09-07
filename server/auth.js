const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

function verifyAdmin(username, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) return false;
  return bcrypt.compareSync(password, admin.password_hash);
}

function changePassword(username, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, username);
}

// Возвращает новый логин при успехе, либо код ошибки: 'wrong_password' | 'taken'
function changeUsername(currentUsername, newUsername, currentPassword) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(currentUsername);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return { error: 'wrong_password' };
  }
  const clash = db.prepare('SELECT id FROM admins WHERE username = ? AND id != ?').get(newUsername, admin.id);
  if (clash) {
    return { error: 'taken' };
  }
  db.prepare('UPDATE admins SET username = ? WHERE id = ?').run(newUsername, admin.id);
  return { username: newUsername };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.adminUsername) {
    return next();
  }
  return res.status(401).json({ error: 'Требуется вход в админ-панель.' });
}

// CSRF: double-submit — токен создаётся при логине, хранится в сессии
// (недоступной со стороны браузерного JS чужой страницы) и должен быть
// повторён клиентом в заголовке X-CSRF-Token на каждый мутирующий запрос.
function issueCsrfToken(req) {
  const token = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  return token;
}

function requireCsrf(req, res, next) {
  const headerToken = req.get('X-CSRF-Token');
  const sessionToken = req.session && req.session.csrfToken;
  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ error: 'Недействительный CSRF-токен. Обновите страницу и войдите заново.' });
  }
  return next();
}

module.exports = { verifyAdmin, changePassword, changeUsername, requireAuth, issueCsrfToken, requireCsrf };
