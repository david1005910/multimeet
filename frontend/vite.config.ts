import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 참고: dev에서도 apiBase.ts가 절대 경로(http://localhost:3001)로 호출하므로
    // 프록시 설정은 사용되지 않는다. CORS는 백엔드 FRONTEND_URL로 허용된다.
  },
})
