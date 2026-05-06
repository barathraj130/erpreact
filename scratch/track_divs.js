
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');

const lines = content.split('\n');
const stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Find all <div or </div>
  const matches = line.matchAll(/<(div|<\/div)/g);
  for (const match of matches) {
    if (match[1] === 'div') {
      stack.push(i + 1);
    } else {
      if (stack.length === 0) {
        console.log(`Extra </div> at line ${i + 1}`);
      } else {
        stack.pop();
      }
    }
  }
}

if (stack.length > 0) {
  stack.forEach(line => console.log(`Unclosed <div> at line ${line}`));
} else {
  console.log('Divs are perfectly balanced!');
}
