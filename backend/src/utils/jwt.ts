import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

let warnedAboutSecret = false;

// 모듈 로드 시점이 아닌 호출 시점에 env를 읽는다.
// bootstrap.ts가 JWT_SECRET을 확정하기 전에 이 모듈이 로드돼도 안전하다.
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (!warnedAboutSecret) {
      warnedAboutSecret = true;
      console.warn('[WARN] JWT_SECRET 미설정 — 개발용 기본 시크릿 사용 (개발 환경에서만 허용)');
    }
    return 'dev-secret';
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret() + '-refresh', {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret() + '-refresh') as JwtPayload;
  } catch {
    return null;
  }
}
