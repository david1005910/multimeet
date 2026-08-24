import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Edit3, Eye } from 'lucide-react'
import { audioApi } from '../../services/api'

interface Props {
  meetingId: string
  content: string
  onUpdate: (content: string) => void
}

export default function MinutesEditor({ meetingId, content, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [localContent, setLocalContent] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    setLocalContent(content)
  }, [content])

  const save = useCallback(async (text: string) => {
    setSaving(true)
    setSaveError(false)
    try {
      await audioApi.updateMinutes(meetingId, text)
      onUpdate(text)
    } catch {
      // 자동저장 실패를 조용히 넘기지 않는다 — 다음 키 입력 시 재시도됨
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }, [meetingId, onUpdate])

  useEffect(() => {
    if (!isEditing) return
    const timer = setTimeout(() => save(localContent), 3000)
    return () => clearTimeout(timer)
  }, [localContent, isEditing, save])

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <h2 className="font-semibold" style={{ color: '#ffffff' }}>회의록</h2>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>저장 중...</span>}
          {!saving && saveError && (
            <span className="text-xs" style={{ color: '#f87171' }}>저장 실패 — 입력 시 재시도</span>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: isEditing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
              color: isEditing ? '#ffffff' : 'rgba(255,255,255,0.6)',
              border: isEditing ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? '미리보기' : '편집'}
          </button>
        </div>
      </div>
      <div className="p-5">
        {isEditing ? (
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="w-full h-[60vh] font-mono text-sm resize-none focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '16px',
              color: '#ffffff',
            }}
          />
        ) : (
          <div className="prose prose-sm max-w-none" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <ReactMarkdown>{localContent}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
