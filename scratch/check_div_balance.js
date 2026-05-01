
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const openings = (line.match(/<div/g) || []).length;
  const closings = (line.match(/<\/div>/g) || []).length;
  
  const oldDepth = depth;
  depth += openings - closings;
  
  if (depth < 0) {
    console.log(`Error: Extra closing </div> at line ${i + 1}`);
    console.log(line);
    depth = 0; // Reset to keep finding others
  }
}

console.log(`Final depth: ${depth}`);
