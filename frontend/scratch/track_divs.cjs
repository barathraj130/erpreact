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
    
    if (line.includes('className="ci-split"')) {
        console.log(`Line ${i+1}: ci-split start. Depth: ${depth}`);
    }
    if (line.includes('className="ci-form-pane"')) {
        console.log(`Line ${i+1}: ci-form-pane start. Depth: ${depth}`);
    }
    if (line.includes('className="ci-preview-pane"')) {
        console.log(`Line ${i+1}: ci-preview-pane start. Depth: ${depth}`);
    }
    if (i >= 1150 && i <= 1160) {
        console.log(`Line ${i+1}: ${line.trim()} | Depth: ${depth}`);
    }
}
console.log("Final depth:", depth);
