
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');
let inString = false;
let stringChar = '';
let inComment = false;
let commentType = '';
let slashCount = 0;

const lines = content.split('\n');

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const next = content[i+1];
  const prev = content[i-1];
  
  if (inComment) {
    if (commentType === '//' && c === '\n') inComment = false;
    if (commentType === '/*' && c === '*' && next === '/') {
      inComment = false;
      i++;
    }
    continue;
  }
  
  if (inString) {
    if (c === stringChar && content[i-1] !== '\\') inString = false;
    continue;
  }
  
  if (c === '/' && next === '/') {
    inComment = true;
    commentType = '//';
    i++;
    continue;
  }
  if (c === '/' && next === '*') {
    inComment = true;
    commentType = '/*';
    i++;
    continue;
  }
  
  if (c === "'" || c === '"' || c === '`') {
    inString = true;
    stringChar = c;
    continue;
  }
  
  if (c === '/') {
    // Check if it is a closing tag </
    if (prev === '<') continue;
    // Check if it is a self-closing tag />
    if (next === '>') continue;
    
    const lineNumber = content.slice(0, i).split('\n').length;
    console.log(`Slash at index ${i} (line ${lineNumber}): ...${content.slice(Math.max(0, i-20), i + 20).replace(/\n/g, ' ')}...`);
    slashCount++;
  }
}
console.log('Total non-tag slashes found: ' + slashCount);
