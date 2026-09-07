// Общий JS для всех публичных страниц: навигация, футер, вспомогательные утилиты.

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escMultiline(str) {
  return esc(str).replace(/\n/g, '<br>');
}

const NAV_LINKS = [
  { href: '/o-klinike', label: 'О клинике' },
  { href: '/uslugi', label: 'Направления' },
  { href: '/spetsialisty', label: 'Специалисты' },
  { href: '/tseny', label: 'Цены' },
  { href: '/otzyvy', label: 'Отзывы' },
  { href: '/kontakty', label: 'Контакты' },
];

const BRAND_MARK_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="30" fill="#1B2430"/>
  <path d="M32 50 A18 18 0 0 1 17.7 21.6" stroke="#F5F0E7" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.55"/>
  <path d="M32 50 A18 18 0 0 0 46.3 21.6" stroke="#E2543F" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  <line x1="32" y1="50" x2="32" y2="14" stroke="#F5F0E7" stroke-width="2" opacity="0.4"/>
  <line x1="32" y1="50" x2="46.3" y2="21.6" stroke="#F5F0E7" stroke-width="2" opacity="0.85"/>
  <circle cx="32" cy="50" r="3.6" fill="#E2543F"/>
  <circle cx="32" cy="14" r="2" fill="#F5F0E7" opacity="0.6"/>
  <circle cx="46.3" cy="21.6" r="2" fill="#F5F0E7"/>
</svg>`;

function renderNav(settings) {
  const brand = settings.brand_name || 'Медицинский центр «Планета Здоровья»';
  const path = window.location.pathname;
  const html = `
    <header class="site-header">
      <div class="wrap header-inner">
        <a href="/" class="brand" aria-label="${esc(brand)} — на главную">
          <span class="brand-mark">${BRAND_MARK_SVG}</span>
          <span class="brand-name">${esc(brand)}</span>
        </a>
        <nav class="main-nav" aria-label="Основная навигация">
          ${NAV_LINKS.map(l => `<a href="${l.href}" class="${path === l.href ? 'is-active' : ''}">${l.label}</a>`).join('')}
        </nav>
        <a class="nav-cta" href="/zapis">Записаться</a>
        <button type="button" class="nav-burger" id="navBurger" aria-label="Открыть меню" aria-expanded="false" aria-controls="navMobilePanel">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="wrap">
        <div class="nav-mobile-panel" id="navMobilePanel">
          <ul class="nav-mobile-links">
            ${NAV_LINKS.map(l => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
            <li><a href="/zapis" style="color:var(--signal);">Записаться на приём →</a></li>
          </ul>
        </div>
      </div>
    </header>
  `;
  const placeholder = document.getElementById('navPlaceholder');
  if (placeholder) placeholder.outerHTML = html;

  const burger = document.getElementById('navBurger');
  const panel = document.getElementById('navMobilePanel');
  if (burger && panel) {
    burger.addEventListener('click', () => {
      const isOpen = panel.classList.contains('is-open');
      panel.classList.toggle('is-open', !isOpen);
      burger.setAttribute('aria-expanded', String(!isOpen));
    });
  }
}

function renderFooter(settings) {
  const brand = settings.brand_name || 'Медицинский центр «Планета Здоровья»';
  const html = `
    <footer>
      <div class="wrap footer-inner">
        <div>
          <div class="footer-brand">
            <span class="brand-mark">${BRAND_MARK_SVG}</span>
          </div>
          <p style="font-size:0.9rem; max-width:34ch;">${esc(settings.legal_address || '')}</p>
          <p class="footer-license">Лицензия ${esc(settings.license_number || '')} от ${esc(settings.license_date || '')}.<br>${esc(settings.legal_name || '')}.</p>
        </div>
        <div>
          <h4>Разделы</h4>
          <div class="footer-links">
            <a href="/o-klinike">О клинике</a>
            <a href="/spetsialisty">Специалисты</a>
            <a href="/uslugi">Направления</a>
            <a href="/tseny">Цены</a>
            <a href="/otzyvy">Отзывы</a>
          </div>
        </div>
        <div>
          <h4>Пациентам</h4>
          <div class="footer-links">
            <a href="/litsenzii">Лицензии</a>
            <a href="/karyera">Карьера</a>
            <a href="/kontakty">Контакты</a>
            <a href="/privacy">Обработка данных</a>
          </div>
          <p style="margin-top:14px; font-weight:700; color:#fff;">${esc(settings.phone_display || settings.phone || '')}</p>
        </div>
      </div>
      <div class="footer-disclaimer">
        <strong>Имеются противопоказания.</strong> Необходима консультация специалиста.
      </div>
      <div class="footer-bottom">© 2026 ${esc(brand)}. Все права защищены.</div>
    </footer>
  `;
  const placeholder = document.getElementById('footerPlaceholder');
  if (placeholder) placeholder.outerHTML = html;
}

// Фоновый мотив "гониометр" — инструмент измерения угла сустава: дуга с
// делениями и опорная точка. Отражает специфику ортопедии/ортезирования
// (в отличие от сети линий/точек "Меридиан" у другого сайта очереди).
function renderGoniometerField(target, opts = {}) {
  const el = document.querySelector(target);
  if (!el) return;
  const color = opts.color || 'currentColor';
  const dotColor = opts.dotColor || 'var(--signal)';
  el.innerHTML = `
    <svg viewBox="0 0 600 600" fill="none" preserveAspectRatio="xMidYMid slice">
      <circle cx="440" cy="440" r="230" stroke="${color}" stroke-opacity="0.10" stroke-width="1"/>
      <path d="M440 440 A230 230 0 0 1 245 300" stroke="${color}" stroke-opacity="0.22" stroke-width="1.4"/>
      <path d="M440 440 A230 230 0 0 0 210 440" stroke="${color}" stroke-opacity="0.14" stroke-width="1.4"/>
      <line x1="440" y1="440" x2="440" y2="150" stroke="${color}" stroke-opacity="0.16" stroke-width="1"/>
      <line x1="440" y1="440" x2="245" y2="300" stroke="${color}" stroke-opacity="0.3" stroke-width="1.2"/>
      <line x1="440" y1="440" x2="210" y2="440" stroke="${color}" stroke-opacity="0.18" stroke-width="1"/>
      ${Array.from({ length: 12 }).map((_, i) => {
        const a0 = (180 + i * 7) * Math.PI / 180;
        const x1 = 440 + Math.cos(a0) * 220, y1 = 440 + Math.sin(a0) * 220;
        const x2 = 440 + Math.cos(a0) * 232, y2 = 440 + Math.sin(a0) * 232;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-opacity="0.16" stroke-width="1"/>`;
      }).join('')}
      <circle cx="440" cy="440" r="5" fill="${dotColor}"/>
      <circle cx="245" cy="300" r="3.5" fill="${dotColor}" fill-opacity="0.85"/>
      <circle cx="210" cy="440" r="3" fill="${color}" fill-opacity="0.4"/>
      <path d="M60 520 Q100 500 130 520 T200 520 T270 520" stroke="${color}" stroke-opacity="0.14" stroke-width="1.4" stroke-dasharray="2 10" stroke-linecap="round"/>
    </svg>
  `;
}

function renderServiceCards(services) {
  const icons = {
    'nevrologiya': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 4a4 4 0 0 0-4 4c0 1 .3 1.7.8 2.3C5.3 11 5 11.9 5 13a4 4 0 0 0 4 4"/><path d="M15 4a4 4 0 0 1 4 4c0 1-.3 1.7-.8 2.3.5.7.8 1.6.8 2.7a4 4 0 0 1-4 4"/><path d="M9 4a3 3 0 0 1 6 0v13a3 3 0 0 1-6 0"/><path d="M9 9h2M13 9h2M9 14h2M13 14h2"/></svg>',
    'ortopediya': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v6M8 9h8l1.5 4a3.5 3.5 0 1 1-3 1.7M8 9l-1.5 4a3.5 3.5 0 1 0 3 1.7M9.5 14.7h5"/></svg>',
    'ekspress-ortezirovanie': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3v8a5 5 0 0 0 10 0V3"/><path d="M7 3h10M9 21l1-8h4l1 8"/><circle cx="12" cy="6.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="9.5" cy="8" r="0.8" fill="currentColor" stroke="none"/><circle cx="14.5" cy="8" r="0.8" fill="currentColor" stroke="none"/></svg>',
    'psihologiya': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a5 5 0 0 1 5 5c0 2-1 3-1 5v1H8v-1c0-2-1-3-1-5a5 5 0 0 1 5-5Z"/><path d="M9.5 18h5M10 20.5h4"/></svg>',
    'razvivayushchie-zanyatiya': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="7" height="7" rx="1"/><circle cx="17.5" cy="8.5" r="3.5"/><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5M14 20c.3-2 2-4 4-4s3.7 1.5 4.2 3.3"/></svg>',
  };
  return services.map(s => `
    <a class="service-card" href="/uslugi/${esc(s.slug)}">
      <div class="glyph">${icons[s.slug] || ''}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.short_desc)}</p>
      <span class="go">Подробнее →</span>
    </a>
  `).join('');
}

let cachedSettings = null;
async function loadSettingsGlobal() {
  if (cachedSettings) return cachedSettings;
  const res = await fetch('/api/settings');
  cachedSettings = await res.json();
  return cachedSettings;
}

async function initLayout() {
  try {
    const settings = await loadSettingsGlobal();
    renderNav(settings);
    renderFooter(settings);
  } catch (err) {
    console.error('Не удалось загрузить настройки сайта:', err);
  }
}
initLayout();
