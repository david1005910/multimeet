import fs from 'fs';
import prisma from './prisma';
import { initSqlPath, dbPath } from './paths';

// Windows 배포본에는 prisma CLI가 없으므로 마이그레이션 대신
// 빌드 시 만들어 둔 init.sql을 최초 실행 때 직접 실행한다.
export async function initDatabase(): Promise<void> {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='User'`
  );
  if (tables.length > 0) return;

  if (!fs.existsSync(initSqlPath)) {
    throw new Error(`데이터베이스 초기화 SQL을 찾을 수 없습니다: ${initSqlPath}`);
  }

  const statements = fs
    .readFileSync(initSqlPath, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split('\n').every((line) => line.trim().startsWith('--')));

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log(`  데이터베이스를 새로 만들었습니다: ${dbPath}`);
}
