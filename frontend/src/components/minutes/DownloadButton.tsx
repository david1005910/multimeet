import { Download } from 'lucide-react'
import { audioApi } from '../../services/api'

interface Props {
  meetingId: string
  content: string
}

export default function DownloadButton({ meetingId, content }: Props) {
  const download = async (format: 'docx' | 'md') => {
    try {
      const res = await audioApi.downloadMinutes(meetingId, format)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `minutes-${meetingId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('다운로드 실패:', err)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    alert('클립보드에 복사되었습니다.')
  }

  const glassButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '10px',
    padding: '8px 16px',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => download('docx')}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
        style={{
          background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
          cursor: 'pointer',
        }}
      >
        <Download className="w-4 h-4" />
        DOCX
      </button>
      <button
        onClick={() => download('md')}
        style={glassButtonStyle}
      >
        <Download className="w-4 h-4" />
        Markdown
      </button>
      <button
        onClick={copyToClipboard}
        style={glassButtonStyle}
      >
        클립보드 복사
      </button>
    </div>
  )
}
