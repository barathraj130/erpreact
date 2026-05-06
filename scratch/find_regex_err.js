
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');

let inString = false;
let stringChar = '';
let inRegex = false;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const next = content[i+1];
  const prev = content[i-1];

  if (inString) {
    if (c === stringChar && prev !== '\\') inString = false;
    continue;
  }
  
  if (inRegex) {
    if (c === '/' && prev !== '\\') inRegex = false;
    continue;
  }

  if (c === "'" || c === '"' || c === '`') {
    inString = true;
    stringChar = c;
    continue;
  }

  if (c === '/') {
    // Not in string or regex.
    // Is it a tag?
    if (prev === '<' || next === '>') continue;
    // Is it a comment? (Wait, I removed them, but just in case)
    if (next === '/' || next === '*') continue;
    
    // If it's a division, it's usually preceded by a number or variable.
    // If it's a regex, it's usually preceded by ( = , etc.
    console.log(`Potential Regex Start at line ${content.slice(0, i).split('\n').length}: ...${content.slice(i-10, i+10).replace(/\n/g, ' ')}...`);
    // Assume it's a regex and look for the end.
    inRegex = true;
  }
}

if (inRegex) {
  console.log('Error: Found an unterminated regular expression start!');
} else {
  console.log('No unterminated regex found by this script.');
}
