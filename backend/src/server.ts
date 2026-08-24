import './utils/bootstrap';
import http from 'http';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './socket/socketHandler';
import { setIo } from './utils/socket';
import { isPackaged, uploadDir, dataDir, dbPath } from './utils/paths';
import { initDatabase } from './utils/initDb';

const PORT = Number(process.env.PORT) || 3001;
const server = http.createServer(app);

// exe 모드에서는 프론트엔드가 같은 포트에서 서빙되므로 자기 자신도 허용한다.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  maxHttpBufferSize: 5e7,
});

setIo(io);
setupSocketHandlers(io);

async function start(): Promise<void> {
  // SQLite 파일이 없으면 여기서 스키마를 만든다. 별도 설치 과정이 필요 없다.
  await initDatabase();

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('=============================================');
    console.log('  MultiMeet - 회의 통역/회의록 시스템');
    console.log('=============================================');
    console.log(`  주소       : ${url}`);
    console.log(`  데이터 폴더 : ${dataDir}`);
    console.log(`  데이터베이스 : ${dbPath}`);
    console.log(`  업로드 폴더 : ${uploadDir}`);
    console.log('  종료하려면 이 창에서 Ctrl+C 를 누르세요.');
    console.log('=============================================');

    if (isPackaged && process.env.NO_BROWSER !== '1') {
      const opener =
        process.platform === 'win32'
          ? `start "" "${url}"`
          : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;
      exec(opener, () => undefined);
    }
  });
}

start().catch((err) => {
  console.error('[FATAL] 시작 실패:', err.message);
  process.exit(1);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] 포트 ${PORT} 이(가) 이미 사용 중입니다.`);
    console.error('        기존 MultiMeet를 종료하거나 .env의 PORT를 변경하세요.');
  } else {
    console.error('[FATAL] 서버 시작 실패:', err.message);
  }
  process.exit(1);
});
