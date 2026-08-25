import { useState, useRef, useCallback, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'
import { API_BASE_URL } from '../services/apiBase'
import { startMicStreaming, MicStreamerHandle } from '../services/micStreamer'
import { TranslationItem } from '../types'

// 청크 주기: 짧으면 대기 지연이 줄지만 Whisper 받아쓰기 정확도가 떨어진다 (4초가 실용적 하한)
const CHUNK_INTERVAL_MS = 4000
// RMS 0~1 범위에서 이 값 이상이면 유효한 발화로 판단
const AUDIO_RMS_THRESHOLD = 0.015
// 서버의 session-config 응답 대기 시간 (초과 시 청크 모드로 폴백)
const CONFIG_TIMEOUT_MS = 1500

function sendBlob(socket: Socket, blob: Blob, meetingId: string, language: string, targetLanguage?: string) {
  if (blob.size < 500) return
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1]
    socket.emit('audio-chunk', {
      meetingId,
      language,
      audioBase64: base64,
      timestamp: Date.now(),
      ...(targetLanguage && { targetLanguage }),
    })
  }
  reader.readAsDataURL(blob)
}

/** 서버가 스트리밍 STT(Deepgram)를 지원하는지 확인. 응답이 없으면 청크 모드. */
function waitForSessionConfig(socket: Socket): Promise<{ streaming: boolean }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off('session-config', handler)
      resolve({ streaming: false })
    }, CONFIG_TIMEOUT_MS)
    const handler = (cfg: { streaming?: boolean }) => {
      clearTimeout(timer)
      socket.off('session-config', handler)
      resolve({ streaming: !!cfg?.streaming })
    }
    socket.once('session-config', handler)
  })
}

export function useRealtimeInterpret(meetingId: string, language: string, targetLanguage?: string) {
  const [isActive, setIsActive] = useState(false)
  const [items, setItems] = useState<TranslationItem[]>([])
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 현재 청크 윈도우에 유효한 발화가 있었는지
  const windowHasAudioRef = useRef(false)
  // onstop 시점에 실제 전송 여부를 전달하는 ref
  const shouldSendRef = useRef(true)
  // 현재 동작 모드와 스트리밍 핸들
  const modeRef = useRef<'chunked' | 'streaming'>('chunked')
  const micStreamerRef = useRef<MicStreamerHandle | null>(null)

  const startChunkRecorder = useCallback((stream: MediaStream, socket: Socket) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      if (!shouldSendRef.current) return // 무음 윈도우 → 전송 건너뜀
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      sendBlob(socket, blob, meetingId, language, targetLanguage)
    }

    recorder.start()
    return recorder
  }, [meetingId, language, targetLanguage])

  const start = useCallback(async () => {
    setError(null)
    // 중복 시작 방지: 이미 세션이 있으면 무시 (버튼 연타/재클릭 시 소켓·리스너 중첩 차단)
    if (socketRef.current || streamRef.current) return
    shouldSendRef.current = true // 이전 세션의 teardown이 끈 플래그 복원

    const apiUrl = API_BASE_URL
    const token = useAuthStore.getState().token
    const socket = io(apiUrl, { auth: { token } })
    socketRef.current = socket

    socket.emit('join-session', meetingId)

    socket.on('translation-result', (data: Omit<TranslationItem, 'id'>) => {
      setInterim('') // 확정 결과가 오면 임시 자막은 소비된 것
      setItems((prev) => [...prev, { ...data, id: `${Date.now()}-${Math.random()}` }])
    })

    socket.on('transcript-interim', (data: { text: string }) => {
      setInterim(data.text)
    })

    socket.on('translation-error', (data: { message: string }) => {
      setError(data.message)
      setTimeout(() => setError(null), 3000)
    })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // 권한 거부 등: 생성해둔 소켓을 즉시 정리하고 사용자에게 알린다
      socket.disconnect()
      socketRef.current = null
      setError('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.')
      return
    }
    streamRef.current = stream

    // ── 모드 결정: 서버가 Deepgram 스트리밍을 지원하면 실시간 경로 ──
    const config = await waitForSessionConfig(socket)

    if (config.streaming) {
      try {
        const mic = await startMicStreaming(stream, (pcm) => {
          socket.emit('audio-stream', pcm)
        })
        micStreamerRef.current = mic
        modeRef.current = 'streaming'
        socket.emit('stream-start', {
          meetingId,
          language,
          ...(targetLanguage && { targetLanguage }),
        })
        setIsActive(true)
        return
      } catch {
        // AudioWorklet 미지원 등 → 청크 모드로 계속 진행
        modeRef.current = 'chunked'
      }
    } else {
      modeRef.current = 'chunked'
    }

    // ── 청크 모드 (폴백): MediaRecorder 4초 윈도우 ──
    // AnalyserNode로 실시간 음량 모니터링
    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    audioCtx.createMediaStreamSource(stream).connect(analyser)
    audioCtxRef.current = audioCtx
    windowHasAudioRef.current = false

    // 100ms마다 RMS 측정 → 유효 발화 감지
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    audioPollRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(dataArray)
      const rms = Math.sqrt(
        dataArray.reduce((s, v) => s + Math.pow((v - 128) / 128, 2), 0) / dataArray.length
      )
      if (rms > AUDIO_RMS_THRESHOLD) windowHasAudioRef.current = true
    }, 100)

    startChunkRecorder(stream, socket)

    intervalRef.current = setInterval(() => {
      // 이번 윈도우 전송 여부 확정 후 플래그 리셋
      shouldSendRef.current = windowHasAudioRef.current
      windowHasAudioRef.current = false

      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
      }
      setTimeout(() => {
        if (streamRef.current && socketRef.current) {
          startChunkRecorder(streamRef.current, socketRef.current)
        }
      }, 20)
    }, CHUNK_INTERVAL_MS)

    setIsActive(true)
  }, [meetingId, startChunkRecorder, language, targetLanguage])

  // refs만 다루는 정리 로직 — stop()과 언마운트 cleanup이 공용으로 쓴다
  const teardown = useCallback(() => {
    shouldSendRef.current = false // 마지막 청크가 끊긴 소켓으로 버퍼링되지 않도록
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (audioPollRef.current) { clearInterval(audioPollRef.current); audioPollRef.current = null }
    if (modeRef.current === 'streaming') {
      socketRef.current?.emit('stream-stop')
      micStreamerRef.current?.stop()
      micStreamerRef.current = null
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    socketRef.current?.emit('leave-session', meetingId)
    socketRef.current?.disconnect()
    socketRef.current = null
    setInterim('')
  }, [meetingId])

  const stop = useCallback(() => {
    teardown()
    setIsActive(false)
  }, [teardown])

  // 컴포넌트 언마운트(뒤로가기 등) 시에도 마이크·소켓·타이머가 남지 않도록 보장
  useEffect(() => {
    return () => { teardown() }
  }, [teardown])

  const clearItems = useCallback(() => setItems([]), [])

  return { isActive, items, interim, error, start, stop, clearItems }
}
