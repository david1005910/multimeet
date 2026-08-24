import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useMeeting } from '../hooks/useMeetings'
import { audioApi, meetingsApi } from '../services/api'
import { API_BASE_URL } from '../services/apiBase'
import { useAuthStore } from '../stores/authStore'
import AudioRecorder from '../components/audio/AudioRecorder'
import AudioUploader from '../components/audio/AudioUploader'

type Step = 'input' | 'uploading' | 'transcribing' | 'generating' | 'done'

export default function MinutesMode() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { data: meeting } = useMeeting(meetingId!)


  const [step, setStep] = useState<Step>('input')
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [inputMode, setInputMode] = useState<'record' | 'upload'>('record')
  const [error, setError] = useState('')
  const socketRef = useRef<Socket | null>(null)

  // WebSocket으로 STT 진행상황 수신
  const waitForTranscript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const apiUrl = API_BASE_URL
      // Read the latest token from the store (may have been refreshed during upload)
      const currentToken = useAuthStore.getState().token
      const socket = io(apiUrl, { auth: { token: currentToken }, reconnection: false })
      socketRef.current = socket

      let settled = false
      let progressTimer: ReturnType<typeof setInterval> | null = null
      let timeout: ReturnType<typeof setTimeout> | null = null

      // 모든 종료 경로(완료/에러/타임아웃/연결 끊김)를 한 곳에서 정리한다.
      // settled 플래그 덕분에 promise가 이중으로 settle되거나 영구 미결되는 일이 없다.
      const finish = (settle: () => void) => {
        if (settled) return
        settled = true
        if (progressTimer) clearInterval(progressTimer)
        if (timeout) clearTimeout(timeout)
        socket.disconnect()
        settle()
      }

      // 진행률 애니메이션
      progressTimer = setInterval(() => {
        setProgress((p) => Math.min(p + 3, 85))
      }, 1500)

      // 안전망 타임아웃 5분 — 연결이 끊겨도 반드시 종료된다 (hang 방지)
      timeout = setTimeout(() => {
        // 타임아웃 시 DB에서 직접 확인
        meetingsApi.get(meetingId!).then((res) => {
          finish(() => {
            if (res.data.transcript) resolve()
            else reject(new Error('STT 처리 시간이 초과되었습니다.'))
          })
        }).catch(() => finish(() => reject(new Error('STT 처리 시간이 초과되었습니다.'))))
      }, 5 * 60 * 1000)

      socket.on('connect_error', (err) => {
        finish(() => reject(new Error(`소켓 연결 실패: ${err.message}`)))
      })

      // 재접속 없는 소켓(reconnection:false)이므로 유실 시 실패 처리해야 한다
      socket.on('disconnect', (reason) => {
        if (!settled && reason !== 'io client disconnect') {
          finish(() => reject(new Error('STT 대기 중 서버와의 연결이 끊어졌습니다.')))
        }
      })

      socket.emit('join-session', meetingId)

      socket.on('transcribe:complete', () => {
        setProgress(100)
        finish(resolve)
      })

      socket.on('transcribe:error', (data: { error: string }) => {
        finish(() => reject(new Error(data.error || 'STT 처리 실패')))
      })
    })
  }

  const generateMinutes = async (): Promise<void> => {
    const apiUrl = API_BASE_URL
    const response = await fetch(`${apiUrl}/api/meetings/${meetingId}/minutes/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || '회의록 생성에 실패했습니다.')
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    // 멀티바이트/라인이 청크 경계에 걸쳐질 수 있어 버퍼로 이어붙인다
    let lineBuffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6))
            if (json.done) return
          } catch { /* partial chunk */ }
        }
      }
      setProgress((p) => Math.min(p + 2, 95))
    }
  }

  const processFile = async (file: File | Blob) => {
    if (!meetingId) return
    setError('')

    try {
      // 1. 업로드
      setStep('uploading')
      setProgress(0)
      setStatusMsg('파일 업로드 중...')
      const fileToUpload = file instanceof File
        ? file
        : new File([file], 'recording.webm', { type: 'audio/webm' })
      try {
        await audioApi.upload(meetingId, fileToUpload, setProgress)
      } catch (err: any) {
        throw new Error(`[업로드 실패] ${err.message}`)
      }

      // 2. STT (WebSocket으로 완료 수신)
      setStep('transcribing')
      setProgress(0)
      setStatusMsg('음성을 텍스트로 변환 중... (Whisper AI)')
      try {
        // 짧은 오디오에서는 transcribe:complete가 transcribe API 응답보다
        // 먼저 올 수 있으므로, 반드시 소켓 join을 먼저 하고 STT를 시작한다.
        const waitPromise = waitForTranscript()
        await audioApi.transcribe(meetingId)
        await waitPromise
      } catch (err: any) {
        throw new Error(`[STT 실패] ${err.message}`)
      }

      // 3. 회의록 생성 (SSE 스트림)
      setStep('generating')
      setProgress(0)
      setStatusMsg('AI가 한국어 회의록을 작성 중...')
      try {
        await generateMinutes()
      } catch (err: any) {
        throw new Error(`[회의록 생성 실패] ${err.message}`)
      }

      setStep('done')
      navigate(`/meetings/${meetingId}/minutes/view`)
    } catch (err: any) {
      setError(err.message || '처리 중 오류가 발생했습니다.')
      setStep('input')
      socketRef.current?.disconnect()
    }
  }

  // 페이지 벗어날 때 소켓 정리
  useEffect(() => {
    return () => { socketRef.current?.disconnect() }
  }, [])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>회의록 모드</h1>
      {meeting && <p className="mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>{meeting.title}</p>}

      {step !== 'input' ? (
        <div
          className="p-8 text-center"
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
            className="w-16 h-16 rounded-full animate-spin mx-auto mb-4"
            style={{
              border: '4px solid rgba(255,255,255,0.2)',
              borderTopColor: '#ffffff',
            }}
          />
          <p className="font-semibold mb-1" style={{ color: '#ffffff' }}>{statusMsg}</p>
          <div
            className="w-full rounded-full h-2 mt-4"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #a78bfa, #6366f1)',
              }}
            />
          </div>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{progress}%</p>
          {step === 'transcribing' && (
            <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              음성 길이에 따라 수 분이 소요될 수 있습니다
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-3">
            {(['record', 'upload'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: inputMode === mode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  color: inputMode === mode ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  border: inputMode === mode ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              >
                {mode === 'record' ? '🎙️ 직접 녹음' : '📁 파일 업로드'}
              </button>
            ))}
          </div>

          {inputMode === 'record' ? (
            <AudioRecorder onRecordingComplete={processFile} />
          ) : (
            <AudioUploader onFileSelected={processFile} />
          )}

          {error && (
            <div
              className="p-3 text-sm rounded-lg"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
