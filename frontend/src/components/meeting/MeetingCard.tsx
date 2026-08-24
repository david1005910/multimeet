import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Mic, Trash2 } from 'lucide-react'
import { Meeting } from '../../types'
import { useDeleteMeeting } from '../../hooks/useMeetings'

const langLabel: Record<string, string> = { ko: '🇰🇷 한국어', en: '🇺🇸 영어', zh: '🇨🇳 중국어', vi: '🇻🇳 베트남어' }

const statusStyle: Record<string, { label: string; bg: string; color: string }> = {
  preparing:   { label: '준비중', bg: 'rgba(160,174,192,0.2)', color: 'rgba(255,255,255,0.5)' },
  in_progress: { label: '진행중', bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24' },
  completed:   { label: '완료',   bg: 'rgba(52,211,153,0.2)',  color: '#34d399' },
}

interface Props {
  meeting: Meeting
}

export default function MeetingCard({ meeting }: Props) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteMeeting()
  const status = statusStyle[meeting.status] || statusStyle.preparing

  // 실수 클릭 방지: 첫 클릭에 확인 상태가 되고, 3초 내 재클릭 시 삭제된다
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDeleteClick = () => {
    if (confirming) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      deleteMutation.mutate(meeting.id)
      return
    }
    setConfirming(true)
    confirmTimer.current = setTimeout(() => setConfirming(false), 3000)
  }

  const handleOpen = () => {
    if (meeting.mode === 'interpret') {
      navigate(`/meetings/${meeting.id}/interpret`)
    } else {
      if (meeting.minutes) {
        navigate(`/meetings/${meeting.id}/minutes/view`)
      } else {
        navigate(`/meetings/${meeting.id}/minutes`)
      }
    }
  }

  return (
    <div
      className="p-5 transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.14)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold truncate" style={{ color: '#ffffff' }}>{meeting.title}</h3>
          {meeting.company && (
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{meeting.company}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {langLabel[meeting.language] || meeting.language}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span
              className="text-xs px-2 py-0.5 font-medium"
              style={{
                background: status.bg,
                color: status.color,
                borderRadius: '8px',
              }}
            >
              {status.label}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {new Date(meeting.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
        <div className="flex gap-1 ml-3">
          <button
            onClick={handleOpen}
            className="p-2 transition-all"
            style={{ color: '#a78bfa', borderRadius: '10px' }}
            title={meeting.mode === 'interpret' ? '통역 시작' : '회의록 보기'}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {meeting.mode === 'interpret' ? <Mic className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-2 transition-all"
            style={{
              color: confirming ? '#f87171' : 'rgba(255,255,255,0.4)',
              background: confirming ? 'rgba(245,101,101,0.15)' : 'transparent',
              borderRadius: '10px',
              fontSize: confirming ? '10px' : undefined,
            }}
            title={confirming ? '다시 클릭하면 삭제됩니다' : '삭제'}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(245,101,101,0.15)'
              ;(e.currentTarget as HTMLElement).style.color = '#f87171'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = confirming ? 'rgba(245,101,101,0.15)' : 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = confirming ? '#f87171' : 'rgba(255,255,255,0.4)'
            }}
          >
            {confirming ? <span className="font-bold">삭제?</span> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
