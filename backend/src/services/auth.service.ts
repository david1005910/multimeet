import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { signToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

export class AuthService {
  async register(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('이미 사용 중인 이메일입니다.');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    const token = signToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('이메일 또는 비밀번호가 잘못되었습니다.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('이메일 또는 비밀번호가 잘못되었습니다.');

    const token = signToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw new Error('유효하지 않은 리프레시 토큰입니다.');

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    const token = signToken({ id: user.id, email: user.email });
    return { token };
  }
}

export const authService = new AuthService();
