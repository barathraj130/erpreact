const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('frontend/src/pages', (file) => {
  if (!file.endsWith('.tsx')) return;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Remove redundant marginBottom from header divs (page-container handles gap)
  const marginRegex = /marginBottom:\s*["']22px["']/g;
  if (content.match(marginRegex)) {
    content = content.replace(marginRegex, 'marginBottom: "0"');
    changed = true;
  }

  // 2. Ensure all text inside banners uses Geist explicitly if not already
  if (content.includes('header"')) {
    if (!content.includes("fontFamily: \"'Geist', sans-serif\"")) {
       // already added in fix_banners.js but checking
    }
    
    // Fix existing styles that might be missing Geist
    content = content.replace(/style=\{\{\s*fontSize:\s*["']20px["']/g, 'style={{ fontFamily: "\'Geist\', sans-serif", fontSize: "20px"');
    content = content.replace(/style=\{\{\s*fontSize:\s*["']12.5px["']/g, 'style={{ fontFamily: "\'Geist\', sans-serif", fontSize: "12.5px"');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});

// Also check common CSS files
const cssFiles = ['frontend/src/pages/PageShared.css', 'frontend/src/components/Layout/Sidebar.css', 'frontend/src/pages/Dashboard.css'];
cssFiles.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes("font-family: 'Geist'")) {
      content = "body { font-family: 'Geist', sans-serif; }\n" + content;
      fs.writeFileSync(f, content);
      console.log(`Updated font in ${f}`);
    }
  }
});

console.log('Done script');
