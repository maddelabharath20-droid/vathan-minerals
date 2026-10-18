const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const frontendDir = path.resolve(__dirname, '../frontend');
const frontendDist = path.join(frontendDir, 'dist');
const rootDist = path.resolve(__dirname, '../dist');

console.log('[build.js] Building frontend with Vite...');
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

console.log('[build.js] Cleaning root dist...');
if (fs.existsSync(rootDist)) {
  fs.rmSync(rootDist, { recursive: true, force: true });
}

console.log('[build.js] Copying frontend/dist to root dist...');
fs.mkdirSync(rootDist, { recursive: true });
fs.cpSync(frontendDist, rootDist, { recursive: true });

console.log('[build.js] Production build and dist sync completed successfully!');
