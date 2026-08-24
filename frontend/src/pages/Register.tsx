import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

export default function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.register(email, password, name)
      setAuth(data.user, data.token, data.refreshToken)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '10px 14px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a0533 0%, #0d1b4b 35%, #0a2a4a 65%, #062a3a 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <div
        className="w-full max-w-sm p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 0 12px rgba(255,255,255,0.10)',
        }}
      >
        <div className="flex items-center gap-2 justify-center mb-6">
          <Mic className="w-6 h-6" style={{ color: '#a78bfa' }} />
          <span className="text-xl font-bold" style={{ color: '#ffffff' }}>MultiMeet</span>
        </div>
        <h1 className="text-xl font-bold text-center mb-6" style={{ color: '#ffffff' }}>회원가입</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>
        <p className="text-center text-sm mt-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: '#a78bfa' }}>로그인</Link>
        </p>
      </div>
    </div>
  )
}
