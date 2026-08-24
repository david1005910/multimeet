// bootstrap이 PRISMA_QUERY_ENGINE_LIBRARY / DATABASE_URL을 설정한 뒤에
// PrismaClient를 만들어야 한다. import 순서가 곧 실행 순서다.
import './bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
