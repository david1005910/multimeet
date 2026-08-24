// paths를 import하는 쪽이 어디든 .env가 먼저 로드되도록 여기서 보장한다.
import './env';
import path from 'path';
import os from 'os';

export const isPackaged = Boolean((process as any).pkg);

// 개발: backend/ , 배포: exe가 있는 폴더
export const appRoot = isPackaged
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..', '..');

// pkg 스냅샷 안의 읽기 전용 리소스 루트 (backend/ 에 해당)
export const bundleRoot = path.join(__dirname, '..', '..');

// 쓰기 가능한 데이터 폴더. DB / 업로드 / 스냅샷 추출물이 전부 여기 모인다.
// exe는 Program Files 같은 읽기 전용 위치에 놓일 수 있어 사용자 폴더를 기본으로 쓴다.
function resolveDataDir(): string {
  if (process.env.MULTIMEET_DATA_DIR) {
    return path.resolve(process.env.MULTIMEET_DATA_DIR);
  }
  if (!isPackaged) {
    return appRoot;
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'MultiMeet');
  }
  return path.join(os.homedir(), '.multimeet');
}

export const dataDir = resolveDataDir();

// 스냅샷에서 꺼낸 네이티브 바이너리 / 정적 파일을 두는 곳
export const runtimeDir = path.join(dataDir, 'runtime');

export const uploadDir = path.isAbsolute(process.env.UPLOAD_DIR || '')
  ? (process.env.UPLOAD_DIR as string)
  : path.resolve(dataDir, process.env.UPLOAD_DIR || './uploads');

export const frontendDir = isPackaged
  ? path.join(runtimeDir, 'public')
  : path.join(appRoot, '..', 'frontend', 'dist');

// 개발 모드에서는 .env의 DATABASE_URL을 그대로 쓴다.
// prisma CLI가 상대 경로를 schema.prisma 위치 기준으로 푸는 것과 맞춘다.
function resolveDevDbPath(): string {
  const url = (process.env.DATABASE_URL || '').replace(/^file:/, '');
  if (!url) return path.join(appRoot, 'prisma', 'multimeet.db');
  return path.isAbsolute(url) ? url : path.resolve(appRoot, 'prisma', url);
}

export const dbPath = isPackaged
  ? path.join(dataDir, 'multimeet.db')
  : resolveDevDbPath();

export const initSqlPath = path.join(bundleRoot, 'prisma', 'init.sql');

export const engineFileName =
  process.platform === 'win32'
    ? 'query_engine-windows.dll.node'
    : process.platform === 'darwin'
      ? 'libquery_engine-darwin.dylib.node'
      : 'libquery_engine-debian-openssl-3.0.x.so.node';
