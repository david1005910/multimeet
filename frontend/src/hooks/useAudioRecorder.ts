import { useState, useRef, useCallback } from 'react'

interface AudioRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
}

interface UseAudioRecorder extends AudioRecorderState {
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<Blob | null>
}

export function useAudioRecorder(): UseAudioRecorder {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const updateLevel = () => {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setState((s) => ({ ...s, audioLevel: Math.round(avg) }))
      animFrameRef.current = requestAnimationFrame(updateLevel)
    }
    updateLevel()

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '' // webm 미지원(Safari 등) 환경에서는 브라우저 기본 코덱 사용
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.start(1000)

    timerRef.current = setInterval(() => {
      setState((s) => ({ ...s, duration: s.duration + 1 }))
    }, 1000)

    setState((s) => ({ ...s, isRecording: true, isPaused: false }))
  }, [])

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    setState((s) => ({ ...s, isPaused: true }))
  }, [])

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume()
    // pause 없이 resume이 중복 호출돼도 타이머가 쌓이지 않도록 먼저 정리
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setState((s) => ({ ...s, duration: s.duration + 1 }))
    }, 1000)
    setState((s) => ({ ...s, isPaused: false }))
  }, [])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder) return resolve(null)

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        resolve(blob)
      }

      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()

      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

      setState({ isRecording: false, isPaused: false, duration: 0, audioLevel: 0 })
    })
  }, [])

  return { ...state, start, pause, resume, stop }
}
