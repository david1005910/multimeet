import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../services/api'

export default function Settings() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: object) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const [form, setForm] = useState({
    defaultLanguage: 'en',
    autoDeleteAudio: false,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        defaultLanguage: settings.defaultLanguage,
        autoDeleteAudio: settings.autoDeleteAudio,
      })
    }
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#ffffff' }}>설정</h1>
      <form
        onSubmit={handleSubmit}
        className="p-6 space-y-6"
        style={{
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 0 12px rgba(255,255,255,0.10)',
        }}
      >
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>기본 회의 언어</label>
          <select
            value={form.defaultLanguage}
            onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#ffffff',
              fontSize: '14px',
              outline: 'none',
            }}
          >
            <option value="ko" style={{ background: '#0d1b4b' }}>🇰🇷 한국어</option>
            <option value="en" style={{ background: '#0d1b4b' }}>🇺🇸 영어</option>
            <option value="zh" style={{ background: '#0d1b4b' }}>🇨🇳 중국어</option>
            <option value="vi" style={{ background: '#0d1b4b' }}>🇻🇳 베트남어</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>오디오 파일 자동 삭제</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>회의록 생성 후 오디오 파일 자동 삭제</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, autoDeleteAudio: !f.autoDeleteAudio }))}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{
              background: form.autoDeleteAudio ? 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)' : 'rgba(255,255,255,0.2)',
              border: 'none',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{
                transform: form.autoDeleteAudio ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-2.5 rounded-lg font-medium transition-all"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                : 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: saved
                ? '0 6px 20px rgba(52,211,153,0.35)'
                : '0 6px 20px rgba(139,92,246,0.45)',
              opacity: mutation.isPending ? 0.7 : 1,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {mutation.isPending ? '저장 중...' : saved ? '✓ 저장됨' : '설정 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
