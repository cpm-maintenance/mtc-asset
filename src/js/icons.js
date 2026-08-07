/**
 * FA → Lucide Icon Mapper
 * Scan DOM for <i class="fas fa-xxx">, map ke Lucide SVG, replace.
 * SVG data from lucide-icons.js — zero imports, works in dev & prod.
 */
import { ICON_DATA } from './lucide-icons.js';

const FA_TO_LUCIBE = {
  'fa-arrow-left': 'arrow-left', 'fa-arrow-right': 'arrow-right',
  'fa-chevron-down': 'chevron-down', 'fa-chevron-left': 'chevron-left', 'fa-chevron-right': 'chevron-right',
  'fa-times': 'x', 'fa-xmark': 'x', 'fa-times-circle': 'circle-x',
  'fa-check': 'check', 'fa-check-circle': 'circle-check', 'fa-check-double': 'check-check',
  'fa-plus': 'plus', 'fa-plus-circle': 'circle-plus', 'fa-minus-circle': 'circle-minus',
  'fa-play': 'play', 'fa-sync': 'refresh-cw', 'fa-sync-alt': 'refresh-cw',
  'fa-download': 'download', 'fa-upload': 'upload', 'fa-save': 'save', 'fa-print': 'printer',
  'fa-filter': 'funnel', 'fa-search': 'search', 'fa-edit': 'pencil', 'fa-pen': 'pencil',
  'fa-pen-to-square': 'pencil', 'fa-crop': 'crop',
  'fa-trash': 'trash-2', 'fa-trash-alt': 'trash-2', 'fa-trash-can': 'trash-2',
  'fa-key': 'key', 'fa-cog': 'settings', 'fa-cogs': 'settings',
  'fa-history': 'history', 'fa-broom': 'brush-cleaning',
  'fa-external-link-alt': 'external-link', 'fa-layer-group': 'layers',
  'fa-exclamation-circle': 'circle-alert', 'fa-exclamation-triangle': 'triangle-alert',
  'fa-ban': 'ban', 'fa-bell': 'bell', 'fa-bell-slash': 'bell-off',
  'fa-info-circle': 'info', 'fa-question-circle': 'circle-question-mark',
  'fa-spinner': 'loader', 'fa-stopwatch': 'timer', 'fa-clock': 'clock',
  'fa-user': 'user', 'fa-user-plus': 'user-plus',
  'fa-users': 'users', 'fa-users-slash': 'users',
  'fa-user-tag': 'user-check', 'fa-user-pen': 'user-cog', 'fa-user-astronaut': 'user',
  'fa-sign-out-alt': 'log-out', 'fa-shield-alt': 'shield',
  'fa-file-pdf': 'file-text', 'fa-file-csv': 'file-spreadsheet', 'fa-file-excel': 'file-spreadsheet',
  'fa-file-powerpoint': 'file',
  'fa-clipboard-list': 'clipboard-list', 'fa-clipboard-check': 'clipboard-check',
  'fa-tasks': 'list-todo', 'fa-list': 'list', 'fa-copy': 'copy', 'fa-inbox': 'inbox',
  'fa-industry': 'factory', 'fa-building': 'building-2', 'fa-microchip': 'cpu',
  'fa-tools': 'wrench', 'fa-wrench': 'wrench',
  'fa-crosshairs': 'crosshair', 'fa-map-marker-alt': 'map-pin', 'fa-map-marked-alt': 'map',
  'fa-sitemap': 'git-branch', 'fa-heartbeat': 'activity', 'fa-fire': 'flame',
  'fa-robot': 'bot', 'fa-brain': 'brain', 'fa-lightbulb': 'lightbulb',
  'fa-coins': 'coins', 'fa-tag': 'tag', 'fa-barcode': 'barcode', 'fa-hashtag': 'hash',
  'fa-qrcode': 'qr-code', 'fa-box': 'box', 'fa-boxes': 'boxes', 'fa-box-open': 'package',
  'fa-shopping-cart': 'shopping-cart',
  'fa-calendar': 'calendar', 'fa-calendar-alt': 'calendar', 'fa-calendar-check': 'calendar-check',
  'fa-hourglass-end': 'hourglass',
  'fa-chart-bar': 'chart-bar', 'fa-chart-line': 'chart-line', 'fa-chart-pie': 'chart-pie', 'fa-chart-simple': 'chart-bar',
  'fa-comments': 'message-square', 'fa-paper-plane': 'send',
  'fa-atom': 'atom', 'fa-bolt': 'zap',
  'fa-camera': 'camera', 'fa-image': 'image',
  'fa-sun': 'sun', 'fa-moon': 'moon',
  'fa-wifi': 'wifi', 'fa-wifi-slash': 'wifi-off', 'fa-link': 'link',
  'fa-th-large': 'grid-2x2', 'fa-asterisk': 'a-arrow-down',
  // --- MISSING MAPPINGS ---
  'fa-columns': 'columns-2',
  'fa-file-alt': 'file-text',
  'fa-user-hard-hat': 'hard-hat',
  'fa-bars': 'panel-left',
  'fa-shopping-cart': 'shopping-cart',
};

function initLucide() {
  const elements = document.querySelectorAll('i[class*="fa-"]');
  elements.forEach(el => {
    const match = el.className.match(/fa-([a-z][a-z0-9-]*)/);
    if (!match) return;
    const lucideName = FA_TO_LUCIBE['fa-' + match[1]];
    if (!lucideName) return;
    const data = ICON_DATA[lucideName];
    if (!data) return;

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    for (const child of data) {
      const tag = child[0];
      const attrs = child[1] || {};
      svg += `<${tag}`;
      for (const [k, v] of Object.entries(attrs)) svg += ` ${k}="${v}"`;
      svg += `/>`;
    }
    svg += '</svg>';
    el.outerHTML = svg;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLucide);
} else {
  initLucide();
}

window.__initLucide = initLucide;
