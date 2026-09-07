// Создаёт компактную копию базы данных в data/backups/ с меткой времени.
// Запуск: npm run backup
// На реальном хостинге поставьте эту команду в cron (например, раз в сутки)
// и синхронизируйте папку data/backups на внешнее хранилище.
//
// Восстановление: 1) остановить сервер (WAL держит правки в отдельном
// файле -wal, при подмене .db во время работы сервера старые данные из
// WAL перезапишут восстановленную копию), 2) удалить *.db-wal/*.db-shm,
// 3) скопировать нужный файл из data/backups/ поверх data/planetazdorovya.db,
// 4) запустить сервер заново.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'planetazdorovya.db');
const backupDir = path.join(__dirname, '..', 'data', 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `planetazdorovya-${timestamp}.db`);

const db = new Database(dbPath, { readonly: true });
db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
db.close();

console.log(`Бэкап создан: ${backupPath}`);

const files = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('planetazdorovya-') && f.endsWith('.db'))
  .sort();
const excess = files.length - 14;
if (excess > 0) {
  files.slice(0, excess).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
  console.log(`Удалено старых бэкапов: ${excess}`);
}
