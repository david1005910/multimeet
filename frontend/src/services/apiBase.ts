// 개발 시에는 Vite(5173)에서 백엔드(3001)로 붙고,
// exe/production 빌드에서는 프론트엔드가 백엔드와 같은 서버에서 서빙되므로
// 현재 origin을 그대로 사용한다.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')
