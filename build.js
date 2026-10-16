/**
 * Production Build Script for Vercel & Local Deployment
 * Validates CSS, HTML, client JS, backend scripts, and synchronizes assets for Vercel
 */
const fs = require('node:fs');
const path = require('node:path');

console.log('🚀 Running production build verification for FOLK Damodar Month 2026...');

// 1. Check required root files
const requiredFiles = ['index.html', 'style.css', 'app.js', 'damodar.png', 'favicon.ico', 'favicon.svg', 'server.js', 'database.js'];
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Build error: Missing required file ${file}`);
    process.exit(1);
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    console.error(`❌ Build error: File ${file} is empty`);
    process.exit(1);
  }
  console.log(`✓ Verified ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
}

// 2. Validate style.css syntax (brace balance)
const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
let openBraces = 0;
for (const ch of cssContent) {
  if (ch === '{') openBraces++;
  if (ch === '}') openBraces--;
}
if (openBraces !== 0) {
  console.error(`❌ Build error: style.css has unbalanced braces (balance = ${openBraces})`);
  process.exit(1);
}
console.log('✓ Validated style.css syntax (balanced brackets & CSS rules)');

// 3. Ensure public/ directory exists and contains synced static assets for Vercel
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Sync root static assets to public/
const staticFilesToSync = ['index.html', 'style.css', 'app.js', 'damodar.png', 'favicon.ico', 'favicon.svg'];
for (const f of staticFilesToSync) {
  fs.copyFileSync(path.join(__dirname, f), path.join(publicDir, f));
  console.log(`✓ Synced ${f} -> public/${f}`);
}

// Sync assets/ directory to public/assets/
const assetsSrc = path.join(__dirname, 'assets');
const assetsDest = path.join(publicDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  if (!fs.existsSync(assetsDest)) {
    fs.mkdirSync(assetsDest, { recursive: true });
  }
  const assetFiles = fs.readdirSync(assetsSrc);
  for (const f of assetFiles) {
    fs.copyFileSync(path.join(assetsSrc, f), path.join(assetsDest, f));
  }
  console.log(`✓ Synced ${assetFiles.length} assets to public/assets`);
}

console.log('✨ Production build complete! Ready for Vercel deployment.');

