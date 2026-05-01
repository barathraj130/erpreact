
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');

let depth = 0;
let pos = 0;
while ((pos = content.indexOf('<div', pos)) !== -1) {
  depth++;
  pos += 4;
}
pos = 0;
while ((pos = content.indexOf('</div>', pos)) !== -1) {
  depth--;
  pos += 6;
}
console.log('Final depth:', depth);
