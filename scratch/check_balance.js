
const fs = require('fs');
const content = fs.readFileSync('/Users/barathraj/Desktop/ERPREACT/frontend/src/pages/CreateInvoice.tsx', 'utf8');

function checkBalance(text) {
  const stack = [];
  const pairs = { '{': '}', '(': ')', '[': ']' };
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let commentType = '';
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    
    if (inComment) {
      if (commentType === '//' && c === '\n') inComment = false;
      if (commentType === '/*' && c === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }
    
    if (inString) {
      if (c === stringChar && text[i-1] !== '\\') inString = false;
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
    
    if (pairs[c]) {
      stack.push({ char: c, line: text.slice(0, i).split('\n').length });
    } else if (Object.values(pairs).includes(c)) {
      const last = stack.pop();
      if (!last || pairs[last.char] !== c) {
        console.log(`Unmatched closing ${c} at line ${text.slice(0, i).split('\n').length}`);
        return false;
      }
    }
  }
  
  if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed ${s.char} from line ${s.line}`));
    return false;
  }
  
  if (inString) {
    console.log(`Unterminated string starting with ${stringChar}`);
    return false;
  }
  
  return true;
}

if (checkBalance(content)) {
  console.log('Brackets and strings are balanced.');
} else {
  console.log('Balance check failed.');
}
