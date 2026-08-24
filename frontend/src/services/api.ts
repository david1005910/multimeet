import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { API_BASE_URL } from './apiBase'

const BASE_URL = API_BASE_URL

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const url: string = original?.url ?? ''
    // 로그인/회원가입의 401은 "자격증명 오류"이지 세션 만료가 아니다 → refresh 흐름 제외
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register')

    if (err.response?.status === 401 && original && !original._retry && !isAuthCall) {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(new Error('세션이 만료되었습니다. 다시 로그인해주세요.'))
      }
      original._retry = true
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
        const state = useAuthStore.getState()
        useAuthStore.getState().setAuth(state.user!, data.token, refreshToken)
        original.headers.Authorization = `Bearer ${data.token}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(new Error('세션이 만료되었습니다. 다시 로그인해주세요.'))
      }
    }
    // Use server error message if available, otherwise Axios default
    const serverMsg = err.response?.data?.error
    if (serverMsg) err.message = serverMsg
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  register: (email: string, password: string, name?: string) =>
    api.post('/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
}

// Meetings
export const meetingsApi = {
  list: (params?: { language?: string; search?: string }) =>
    api.get('/meetings', { params }),
  get: (id: string) => api.get(`/meetings/${id}`),
  create: (data: { title: string; company?: string; language: string; mode: string; participants?: string[] }) =>
    api.post('/meetings', data),
  update: (id: string, data: object) => api.put(`/meetings/${id}`, data),
  delete: (id: string) => api.delete(`/meetings/${id}`),
}

// Audio / Minutes
export const audioApi = {
  upload: (meetingId: string, file: File, onProgress?: (p: number) => void) => {
    const form = new FormData()
    form.append('audio', file)
    return api.post(`/meetings/${meetingId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  },
  transcribe: (meetingId: string) => api.post(`/meetings/${meetingId}/transcribe`),
  getMinutes: (meetingId: string) => api.get(`/meetings/${meetingId}/minutes`),
  updateMinutes: (meetingId: string, content: string) =>
    api.put(`/meetings/${meetingId}/minutes`, { content }),
  downloadMinutes: (meetingId: string, format: 'docx' | 'md') =>
    api.get(`/meetings/${meetingId}/minutes/download`, {
      params: { format },
      responseType: 'blob',
    }),
  saveInterpretLogs: (meetingId: string, logs: Array<{ timestamp: number; original: string; translated: string; targetLanguage?: string }>) =>
    api.post(`/meetings/${meetingId}/interpret-logs`, { logs }),
  tts: (text: string, language: string) =>
    api.post('/meetings/tts', { text, language }, { responseType: 'blob' }),
}

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: object) => api.put('/settings', data),
}
