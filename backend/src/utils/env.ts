import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

// paths.ts가 이 파일을 먼저 import하므로 여기서는 paths를 쓸 수 없다 (순환 참조).
// 데이터 폴더 경로 계산이 paths.ts와 중복되지만 의도된 것이다.
function packagedCandidates(): string[] {
  const exeDir = path.dirname(process.execPath);
  const dataDir =
    process.env.MULTIMEET_DATA_DIR ||
    (process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'MultiMeet')
      : path.join(os.homedir(), '.multimeet'));

  // exe 옆 .env가 우선. 없으면 데이터 폴더의 .env를 쓴다.
  return [path.join(exeDir, '.env'), path.join(dataDir, '.env'), path.join(process.cwd(), '.env')];
}

const candidates = (process as any).pkg
  ? packagedCandidates()
  : [path.join(__dirname, '..', '..', '.env'), path.join(process.cwd(), '.env')];

const envPath = candidates.find((p) => fs.existsSync(p));

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const loadedEnvPath = envPath;
