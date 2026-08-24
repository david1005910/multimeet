#!/usr/bin/env node
/**
 * MultiMeet Windows 단일 exe 빌드
 *
 * 산출물: dist-win/MultiMeet.exe  (이 파일 하나만 복사하면 된다)
 *
 * exe 안에 들어가는 것: Node 18 런타임, 백엔드, 빌드된 프론트엔드,
 *                       Prisma Windows 쿼리 엔진, DB 초기화 SQL.
 * 최초 실행 시 %LOCALAPPDATA%\MultiMeet 에 DB / uploads / runtime 을 만든다.
 *
 * 외부 의존성은 Ollama 하나뿐이다 (로컬 LLM, 별도 설치 필요).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const OUT = path.join(ROOT, 'dist-win');
const BIN = path.join(ROOT, 'node_modules', '.bin');

// pkg가 exe 안에 넣을 리소스를 모으는 폴더 (backend/bundled)
const BUNDLED = path.join(BACKEND, 'bundled');

const ENGINE = 'query_engine-windows.dll.node';
const PKG_TARGET = 'node18-win-x64';
const TOTAL_STEPS = 7;

function run(cmd, args, cwd) {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  execFileSync(path.join(BIN, cmd), args, { cwd, stdio: 'inherit' });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function step(n, msg) {
  console.log(`\n[${n}/${TOTAL_STEPS}] ${msg}`);
}

console.log('MultiMeet Windows 단일 exe 빌드를 시작합니다.');

step(1, 'Prisma 클라이언트 생성 (Windows 엔진 포함)');
run('prisma', ['generate'], BACKEND);

const enginePath = path.join(ROOT, 'node_modules', '.prisma', 'client', ENGINE);
if (!fs.existsSync(enginePath)) {
  console.error(`\n[실패] Windows 쿼리 엔진이 없습니다: ${enginePath}`);
  console.error('       backend/prisma/schema.prisma의 binaryTargets에 "windows"가 있는지 확인하세요.');
  process.exit(1);
}

step(2, 'DB 초기화 SQL 생성 (prisma/init.sql)');
// Windows PC에는 prisma CLI가 없으므로 스키마 전체를 하나의 SQL로 만들어 exe에 넣는다.
// 최초 실행 시 backend/src/utils/initDb.ts가 이걸 그대로 실행한다.
const initSql = execFileSync(
  path.join(BIN, 'prisma'),
  ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
  { cwd: BACKEND, encoding: 'utf8' }
);
if (!/CREATE TABLE/i.test(initSql)) {
  console.error('\n[실패] init.sql 생성 결과가 비어 있습니다.');
  process.exit(1);
}
fs.writeFileSync(path.join(BACKEND, 'prisma', 'init.sql'), initSql);
console.log(`  + prisma/init.sql (${initSql.split('\n').length}줄)`);

step(3, '프론트엔드 빌드');
run('tsc', [], FRONTEND);
run('vite', ['build'], FRONTEND);

step(4, '백엔드 컴파일');
run('tsc', [], BACKEND);

step(5, 'exe에 넣을 리소스 수집 (backend/bundled)');
// .node 네이티브 바이너리는 pkg 스냅샷에서 require할 수 없다.
// 원시 파일로 넣어 두고 최초 실행 때 디스크로 꺼낸다 (utils/bootstrap.ts).
fs.rmSync(BUNDLED, { recursive: true, force: true });
fs.mkdirSync(BUNDLED, { recursive: true });
fs.copyFileSync(enginePath, path.join(BUNDLED, ENGINE));
console.log(`  + bundled/${ENGINE}`);
copyDir(path.join(FRONTEND, 'dist'), path.join(BUNDLED, 'public'));
console.log('  + bundled/public/');

step(6, `pkg로 단일 실행 파일 생성 (${PKG_TARGET})`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
run('pkg', ['.', '--targets', PKG_TARGET, '--output', path.join(OUT, 'MultiMeet.exe')], BACKEND);

step(7, '동봉 문서 복사');
// Windows 기본 압축 해제기가 한글 파일명을 깨뜨리므로 파일명은 ASCII로 유지한다.
for (const name of ['README-KR.txt']) {
  const src = path.join(ROOT, 'windows', name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT, name));
    console.log(`  + ${name}`);
  }
}

const exeSize = (fs.statSync(path.join(OUT, 'MultiMeet.exe')).size / 1024 / 1024).toFixed(1);
console.log(`\n완료. dist-win/MultiMeet.exe (${exeSize}MB)`);
console.log('exe 하나만 Windows PC에 복사해 더블클릭하면 실행됩니다. (Ollama는 별도 설치)');
