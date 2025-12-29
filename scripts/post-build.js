#!/usr/bin/env node

/**
 * Post-build script to verify dist/ structure for n8n community node
 * Ensures all required files are present after TypeScript compilation
 * Copies non-TypeScript assets (icons, etc.) to dist/
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const SRC_DIR = path.join(__dirname, '..');

const REQUIRED_FILES = [
  'nodes/SecureVector/SecureVector.node.js',
  'credentials/SecureVectorApi.credentials.js',
  'index.js',
];

const ASSETS_TO_COPY = [
  {
    src: 'nodes/SecureVector/securevector.svg',
    dest: 'nodes/SecureVector/securevector.svg',
  },
];

function copyAssets() {
  console.log('Copying assets...');
  for (const asset of ASSETS_TO_COPY) {
    const srcPath = path.join(SRC_DIR, asset.src);
    const destPath = path.join(DIST_DIR, asset.dest);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied: ${asset.src}`);
    } else {
      console.error(`❌ Asset not found: ${asset.src}`);
      process.exit(1);
    }
  }
}

function checkFiles() {
  console.log('\nVerifying build output...');
  let allPresent = true;

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(DIST_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing required file: ${file}`);
      allPresent = false;
    } else {
      console.log(`✓ Found: ${file}`);
    }
  }

  if (!allPresent) {
    console.error('\n❌ Build verification failed: Required files missing');
    process.exit(1);
  }

  console.log('\n✓ Build verification passed');
}

copyAssets();
checkFiles();
