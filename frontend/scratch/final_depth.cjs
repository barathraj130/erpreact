const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div|<header|<section|<footer|<main|<aside/g) || []).length;
    const closes = (line.match(/<\/div>|<\/header>|<\/section>|<\/footer>|<\/main>|<\/aside>/g) || []).length;
    depth += opens;
    depth -= closes;
    if (i >= 1140 && i <= 1157) {
        console.log(`Line ${i+1}: ${line.trim()} | Depth: ${depth}`);
    }
}
