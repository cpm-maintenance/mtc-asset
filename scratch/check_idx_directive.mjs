// Search directive/x-page impl in index.html script tags
import fs from 'fs';
const s = fs.readFileSync('index.html', 'utf8');
for (const kw of ['Alpine.directive', "directive('", 'x-page', 'PAGE_', 'pageHtml', 'innerHTML', 'insertAdjacent']) {
  const idx = s.indexOf(kw);
  console.log(kw, '->', idx);
  if (idx > -1 && kw !== 'x-page') console.log(s.slice(Math.max(0, idx - 100), idx + 300).replace(/\r/g, ''));
}
