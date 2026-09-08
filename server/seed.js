const bcrypt = require('bcryptjs');
const db = require('./db');
const { settings } = require('./seed_settings');
const { services } = require('./seed_services');
const { categories, items } = require('./seed_prices');
const { doctors } = require('./seed_doctors');
const { reviews } = require('./seed_reviews');

function seedSettings() {
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`);
  const tx = db.transaction(() => {
    Object.entries(settings).forEach(([k, v]) => upsert.run(k, String(v)));
  });
  tx();
  console.log('Настройки сайта инициализированы.');
}

function seedServices() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
  if (count > 0) {
    console.log('Направления уже загружены, пропускаю.');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO services (slug, title, short_desc, body, image, sort_order) VALUES (@slug, @title, @short_desc, @body, @image, @sort_order)
  `);
  const tx = db.transaction(() => { services.forEach(s => insert.run(s)); });
  tx();
  console.log(`Загружено направлений: ${services.length}.`);
}

function seedPrices() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM price_categories').get().c;
  if (count > 0) {
    console.log('Прайс-лист уже загружен, пропускаю.');
    return;
  }
  const insertCat = db.prepare(`
    INSERT INTO price_categories (slug, title, intro, sort_order) VALUES (@slug, @title, @intro, @sort_order)
  `);
  const insertItem = db.prepare(`
    INSERT INTO price_items (category_id, title, price_note, sort_order) VALUES (@category_id, @title, @price_note, @sort_order)
  `);
  const tx = db.transaction(() => {
    categories.forEach(cat => {
      const result = insertCat.run(cat);
      const categoryId = result.lastInsertRowid;
      const list = items[cat.slug] || [];
      list.forEach(item => {
        insertItem.run({ category_id: categoryId, title: item.title, price_note: item.price_note, sort_order: item.sort_order });
      });
    });
  });
  tx();
  const total = Object.values(items).reduce((sum, list) => sum + list.length, 0);
  console.log(`Загружено разделов прайс-листа: ${categories.length}, позиций: ${total}.`);
}

function seedDoctors() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM doctors').get().c;
  if (count > 0) {
    console.log('Специалисты уже загружены, пропускаю.');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO doctors (full_name, role, experience_years, bio, photo, is_chief, sort_order)
    VALUES (@full_name, @role, @experience_years, @bio, @photo, @is_chief, @sort_order)
  `);
  const tx = db.transaction(() => { doctors.forEach(d => insert.run(d)); });
  tx();
  console.log(`Загружено специалистов: ${doctors.length}.`);
}

function seedReviews() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM reviews').get().c;
  if (count > 0) {
    console.log('Отзывы уже загружены, пропускаю.');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO reviews (author_name, body, published_at, sort_order) VALUES (@author_name, @body, @published_at, @sort_order)
  `);
  const tx = db.transaction(() => { reviews.forEach(r => insert.run(r)); });
  tx();
  console.log(`Загружено отзывов: ${reviews.length}.`);
}

function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count > 0) {
    console.log('Админ уже существует, пропускаю.');
    return;
  }
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'planeta2026';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Создан админ: логин "${username}", пароль "${password}" (смените после первого входа!).`);
}

seedSettings();
seedServices();
seedPrices();
seedDoctors();
seedReviews();
seedAdmin();
console.log('Готово.');
