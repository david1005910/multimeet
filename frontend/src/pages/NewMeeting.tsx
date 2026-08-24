import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Mic } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import LanguageSelector from '../components/meeting/LanguageSelector'
import { useCreateMeeting } from '../hooks/useMeetings'
import { settingsApi } from '../services/api'

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

export default function NewMeeting() {
  const navigate = useNavigate()
  const createMutation = useCreateMeeting()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  })

  const [form, setForm] = useState({
    title: '',
    company: '',
    language: 'zh',
    mode: 'minutes',
    participants: [''],
  })

  // Apply user's default language from settings (only on initial load)
  useEffect(() => {
    if (settings?.defaultLanguage) {
      setForm((f) => ({ ...f, language: settings.defaultLanguage }))
    }
  }, [settings?.defaultLanguage])
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) {
      setError('회의명을 입력해주세요.')
      return
    }
    try {
      const participants = form.participants.filter((p) => p.trim())
      const meeting = await createMutation.mutateAsync({ ...form, participants })
      if (form.mode === 'minutes') {
        navigate(`/meetings/${meeting.id}/minutes`)
      } else {
        navigate(`/meetings/${meeting.id}/interpret`)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '회의 생성에 실패했습니다.')
    }
  }

  const updateParticipant = (i: number, value: string) => {
    const list = [...form.participants]
    list[i] = value
    setForm((f) => ({ ...f, participants: list }))
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#ffffff' }}>새 회의 시작</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>회의명 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={inputStyle}
            placeholder="예: ABC사 영업 미팅"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>상대방 회사명</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            style={inputStyle}
            placeholder="예: ABC Corporation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>회의 언어</label>
          <LanguageSelector
            value={form.language}
            onChange={(lang) => setForm((f) => ({ ...f, language: lang }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>모드 선택</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { mode: 'minutes', icon: FileText, title: '회의록 모드', desc: '녹음 후 AI로 회의록 생성' },
              { mode: 'interpret', icon: Mic, title: '실시간 통역 모드', desc: '외국어↔한국어 양방향 실시간 통역' },
            ].map(({ mode, icon: Icon, title, desc }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm((f) => ({ ...f, mode }))}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: form.mode === mode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  border: form.mode === mode ? '2px solid rgba(255,255,255,0.5)' : '2px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                <Icon
                  className="w-6 h-6 mb-2"
                  style={{ color: form.mode === mode ? '#a78bfa' : 'rgba(255,255,255,0.4)' }}
                />
                <p
                  className="font-semibold text-sm"
                  style={{ color: form.mode === mode ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
                >
                  {title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>참석자</label>
          {form.participants.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text"
                value={p}
                onChange={(e) => updateParticipant(i, e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder={`참석자 ${i + 1}`}
              />
              {i === form.participants.length - 1 && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, participants: [...f.participants, ''] }))}
                  className="px-3 py-2 text-sm transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  + 추가
                </button>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full py-3 rounded-xl font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
            opacity: createMutation.isPending ? 0.7 : 1,
            cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {createMutation.isPending ? '생성 중...' : '회의 시작하기'}
        </button>
      </form>
    </div>
  )
}
