const path = require('path');
const fs = require('fs');

// Copy Prisma schema and migrations to dist
const prismaSource = path.join(__dirname, 'prisma');
const prismaDest = path.join(__dirname, 'dist', 'prisma');

if (!fs.existsSync(prismaDest)) {
  fs.mkdirSync(prismaDest, { recursive: true });
}

// Copy schema.prisma
fs.copyFileSync(
  path.join(prismaSource, 'schema.prisma'),
  path.join(prismaDest, 'schema.prisma')
);

// Copy migrations folder
const migrationsSource = path.join(prismaSource, 'migrations');
const migrationsDest = path.join(prismaDest, 'migrations');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

copyFolderRecursiveSync(migrationsSource, migrationsDest);

console.log('Prisma files copied to dist folder');