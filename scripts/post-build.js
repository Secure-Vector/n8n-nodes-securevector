#!/usr/bin/env node

/**
 * Post-build script to verify dist/ structure for n8n community node
 * Ensures all required files are present after TypeScript compilation
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const REQUIRED_FILES = [
  'nodes/SecureVector/SecureVector.node.js',
  'credentials/SecureVectorApi.credentials.js',
  'index.js',
];

function checkFiles() {
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

checkFiles();
