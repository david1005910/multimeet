import { Mic, Pause, Play, Square } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

interface Props {
  onRecordingComplete: (blob: Blob) => void
}

export default function AudioRecorder({ onRecordingComplete }: Props) {
  const { isRecording, isPaused, duration, audioLevel, start, pause, resume, stop } = useAudioRecorder()

  const handleStop = async () => {
    const blob = await stop()
    if (blob) onRecordingComplete(blob)
  }

  return (
    <div
      className="flex flex-col items-center gap-4 p-6"
      style={{
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        border: '2px dashed rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
      }}
    >
      {!isRecording ? (
        <button
          onClick={start}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 6px 20px rgba(239,68,68,0.45)',
            cursor: 'pointer',
          }}
        >
          <Mic className="w-5 h-5" />
          녹음 시작
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-lg font-mono font-bold" style={{ color: '#ffffff' }}>
              {formatDuration(duration)}
            </span>
          </div>
          <div
            className="w-full rounded-full h-2"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(audioLevel, 100)}%`,
                background: 'linear-gradient(90deg, #ef4444, #dc2626)',
              }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={isPaused ? resume : pause}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
              }}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? '재개' : '일시정지'}
            </button>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
                cursor: 'pointer',
              }}
            >
              <Square className="w-4 h-4" />
              녹음 완료
            </button>
          </div>
        </>
      )}
    </div>
  )
}
