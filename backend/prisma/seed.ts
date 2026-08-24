import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@multimeet.com' },
    update: {},
    create: {
      email: 'demo@multimeet.com',
      password: hashedPassword,
      name: '데모 사용자',
    },
  });

  console.log('Seed 완료:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
