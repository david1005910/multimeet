import { Request, Response, NextFunction } from 'express';

// multer가 던지는 에러를 적절한 상태코드로 매핑한다
function resolveStatus(err: Error): number {
  const anyErr = err as any;

  // 파일 크기 초과 (upload.middleware: 200MB)
  if (anyErr?.code === 'LIMIT_FILE_SIZE') return 413;

  // fileFilter 등에서 명시적으로 만든 사용자 안내성 에러
  if (
    err.message.includes('지원하지 않는 파일') ||
    err.message.includes('잘못된 회의 식별자')
  ) {
    return 400;
  }

  return 500;
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = resolveStatus(err);
  if (status >= 500) {
    // 진단용 스택은 서버 로그에만 남긴다
    console.error('[Error]', err.stack || err.message);
  } else {
    console.warn('[Error]', status, err.message);
  }
  res.status(status).json({ error: err.message || '서버 오류가 발생했습니다.' });
}
