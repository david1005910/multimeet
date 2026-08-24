#!/usr/bin/env node
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Building MultiMeet executable...');

// Configuration for pkg
const pkgConfig = {
  name: 'multimeet',
  version: '1.0.0',
  bin: 'backend/dist/server.js',
  pkg: {
    targets: ['node20-macos-x64'],
    assets: [
      'backend/dist/**/*',
      'backend/prisma/**/*',
      'frontend/dist/**/*',
      'backend/.env',
      'backend/uploads/**/*'
    ],
    outputPath: 'dist'
  }
};

// Update backend package.json for pkg
const backendPackageJsonPath = path.join(__dirname, 'backend', 'package.json');
const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));

backendPackageJson.pkg = pkgConfig.pkg;
backendPackageJson.bin = 'dist/server.js';

fs.writeFileSync(backendPackageJsonPath, JSON.stringify(backendPackageJson, null, 2));

// Run build config to copy Prisma files
exec('cd backend && node build-config.js', (error, stdout, stderr) => {
  if (error) {
    console.error('Error copying Prisma files:', error);
    return;
  }
  
  console.log(stdout);
  
  // Build executable with pkg
  exec('cd backend && npx pkg . --targets node20-macos-x64 --output ../multimeet', (error, stdout, stderr) => {
    if (error) {
      console.error('Error building executable:', error);
      console.error(stderr);
      return;
    }
    
    console.log('✅ Executable built successfully: multimeet');
    console.log('\nTo run the application:');
    console.log('1. Ensure PostgreSQL, Redis, and Ollama services are running');
    console.log('2. Run: ./multimeet');
    console.log('\nThe application will be available at:');
    console.log('- Frontend: http://localhost:5173');
    console.log('- Backend API: http://localhost:3001');
  });
});