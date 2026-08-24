import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadedEnvPath } from './env';
import {
  isPackaged,
  bundleRoot,
  dataDir,
  runtimeDir,
  uploadDir,
  dbPath,
  engineFileName,
} from './paths';

// pkg 스냅샷은 읽기 전용이고 .node 네이티브 바이너리는 스냅샷에서 로드할 수 없다.
// exe 안에 넣어 둔 리소스를 최초 실행 시 쓰기 가능한 폴더로 꺼낸다.
const bundledDir = path.join(bundleRoot, 'bundled');

function copyFileIfNeeded(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  const srcStat = fs.statSync(src);
  if (fs.existsSync(dest) && fs.statSync(dest).size === srcStat.size) return;

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.writeFileSync(dest, fs.readFileSync(src));
  } catch (err: any) {
    // 실행 중인 다른 인스턴스가 파일을 잠갔을 수 있다. 기존 파일이 있으면 그대로 쓴다.
    if (!fs.existsSync(dest)) throw err;
  }
}

function copyDirIfNeeded(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirIfNeeded(from, to);
    else copyFileIfNeeded(from, to);
  }
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

if (isPackaged) {
  // .env가 아예 없으면 데이터 폴더에 템플릿을 만들어 준다.
  // JWT_SECRET은 PC마다 다르게 랜덤 생성한다.
  if (!loadedEnvPath) {
    const secret = crypto.randomBytes(32).toString('hex');
    const template = [
      '# MultiMeet 설정 파일',
      '# 값을 수정한 뒤 MultiMeet를 다시 실행하세요.',
      '',
      '# 음성 인식(Whisper)에 필요합니다. https://platform.openai.com/api-keys',
      'OPENAI_API_KEY=',
      '',
      '# 회의록 생성/번역 AI. https://aistudio.google.com/apikey 에서 발급하세요.',
      'GEMINI_API_KEY=',
      'GEMINI_MODEL=gemini-2.5-flash',
      '',
      '# 웹 서버 포트',
      'PORT=3001',
      '',
      `JWT_SECRET=${secret}`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dataDir, '.env'), template);
    process.env.JWT_SECRET = secret;
    console.log(`  설정 파일을 만들었습니다: ${path.join(dataDir, '.env')}`);
    console.log('  음성 인식은 OPENAI_API_KEY, 회의록/번역은 GEMINI_API_KEY를 넣고 다시 실행하세요.');
  }

  fs.mkdirSync(runtimeDir, { recursive: true });
  copyFileIfNeeded(path.join(bundledDir, engineFileName), path.join(runtimeDir, engineFileName));
  copyDirIfNeeded(path.join(bundledDir, 'public'), path.join(runtimeDir, 'public'));

  const enginePath = path.join(runtimeDir, engineFileName);
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
  } else {
    console.error(`[FATAL] Prisma 쿼리 엔진을 꺼내지 못했습니다: ${enginePath}`);
  }

  // SQLite 상대 경로는 schema.prisma 위치(=읽기 전용 스냅샷) 기준으로 풀리므로
  // 반드시 절대 경로로 덮어써야 한다.
  process.env.DATABASE_URL = `file:${dbPath}`;
}

export const bootstrapped = true;
