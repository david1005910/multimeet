import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Mic, MicOff, Maximize2, ArrowLeft, Save, Volume2, VolumeX, ArrowRightLeft, Play, Square } from 'lucide-react'
import { useRealtimeInterpret } from '../hooks/useRealtimeInterpret'
import { useMeeting } from '../hooks/useMeetings'
import { audioApi, meetingsApi } from '../services/api'
import { TranslationItem } from '../types'

const langLabel: Record<string, string> = {
  ko: '🇰🇷 한국어',
  en: '🇺🇸 English',
  zh: '🇨🇳 中文',
  vi: '🇻🇳 Tiếng Việt',
}

type Direction = 'to-ko' | 'to-foreign'

export default function InterpretMode() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { data: meeting } = useMeeting(meetingId!)

  // 회의 언어가 한국어면 처음부터 to-foreign 방향 고정
  const meetingLang = meeting?.language || 'en'
  const isKoreanMeeting = meetingLang === 'ko'
  const [direction, setDirection] = useState<Direction>(isKoreanMeeting ? 'to-foreign' : 'to-ko')
  const [sourceLang, setSourceLang] = useState<string>(meetingLang)   // to-ko 선택 언어
  const [targetLang, setTargetLang] = useState<string>('zh')           // to-foreign 선택 언어
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [ttsVolume, setTtsVolume] = useState(3.0)   // 0.0 ~ 4.0 (GainNode)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const sourceLanguage = direction === 'to-ko' ? sourceLang : 'ko'
  const resolvedTarget = direction === 'to-foreign' ? targetLang : undefined

  const { isActive, items, error: interpretError, start, stop, clearItems } = useRealtimeInterpret(
    meetingId!, sourceLanguage, resolvedTarget
  )

  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const lastSpokenId = useRef<string>('')
  const ttsAudioCtxRef = useRef<AudioContext | null>(null)
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const ttsGainRef = useRef<GainNode | null>(null)

  // 볼륨 슬라이더를 재생 중인 오디오에도 즉시 반영
  useEffect(() => {
    if (ttsGainRef.current) ttsGainRef.current.gain.value = ttsVolume
  }, [ttsVolume])

  // 핵심 TTS 재생 함수 (itemId: null이면 자동재생, 있으면 수동재생)
  const playTts = useCallback(async (text: string, lang: string, itemId: string | null = null) => {
    try {
      ttsSourceRef.current?.stop()
      ttsAudioCtxRef.current?.close()
      ttsAudioCtxRef.current = null
      ttsSourceRef.current = null
      ttsGainRef.current = null
      setIsSpeaking(true)
      if (itemId) setPlayingId(itemId)

      const res = await audioApi.tts(text, lang)
      const arrayBuffer = await (res.data as Blob).arrayBuffer()

      const audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer

      const gainNode = audioCtx.createGain()
      gainNode.gain.value = ttsVolume
      source.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      ttsAudioCtxRef.current = audioCtx
      ttsSourceRef.current = source
      ttsGainRef.current = gainNode

      source.onended = () => {
        audioCtx.close()
        ttsAudioCtxRef.current = null
        ttsSourceRef.current = null
        ttsGainRef.current = null
        setIsSpeaking(false)
        setPlayingId(null)
      }
      source.start()
    } catch {
      setIsSpeaking(false)
      setPlayingId(null)
    }
  }, [ttsVolume])

  // 자동재생: 새 번역 도착 시 (방향 무관)
  const speak = useCallback((text: string, lang: string) => {
    if (!ttsEnabled) return
    playTts(text, lang, null)
  }, [ttsEnabled, playTts])

  // 수동재생 중지
  const stopTts = useCallback(() => {
    ttsSourceRef.current?.stop()
    ttsAudioCtxRef.current?.close()
    ttsAudioCtxRef.current = null
    ttsSourceRef.current = null
    ttsGainRef.current = null
    setIsSpeaking(false)
    setPlayingId(null)
  }, [])

  // 회의 언어 로드 후 sourceLang 초기화, 한국어 회의는 to-foreign 고정
  useEffect(() => {
    if (!meeting?.language) return
    if (meeting.language !== 'ko') setSourceLang(meeting.language)
    if (meeting.language === 'ko' && !isActive) setDirection('to-foreign')
  }, [meeting?.language, isActive])

  useEffect(() => {
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = leftPanelRef.current.scrollHeight
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight

    if (items.length > 0) {
      const last = items[items.length - 1]
      if (last.id !== lastSpokenId.current) {
        lastSpokenId.current = last.id
        // to-ko: 번역 결과는 한국어, to-foreign: 선택 언어
        const ttsLang = direction === 'to-ko' ? 'ko' : targetLang
        speak(last.translated, ttsLang)
      }
    }
  }, [items, direction, targetLang, speak])

  const handleEnd = async () => {
    stop()
    ttsSourceRef.current?.stop()
    ttsAudioCtxRef.current?.close()
    if (items.length > 0) {
      setSaving(true)
      try {
        await audioApi.saveInterpretLogs(meetingId!, items.map(item => ({
          timestamp: item.timestamp,
          original: item.original,
          translated: item.translated,
          targetLanguage: item.targetLanguage,
        })))
        await meetingsApi.update(meetingId!, { status: 'completed' })
        navigate('/')
      } catch {
        // 저장 실패해도 세션은 정리됐으므로 사용자에게 알리고 화면 유지
        setSaveError('통역 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        setSaving(false)
      }
      return
    }
    navigate('/')
  }

  const handleLeave = () => {
    stop()
    ttsSourceRef.current?.stop()
    ttsAudioCtxRef.current?.close()
    navigate('/')
  }

  const handleToggleDirection = () => {
    if (!isActive) {
      setDirection(d => d === 'to-ko' ? 'to-foreign' : 'to-ko')
      clearItems()
      lastSpokenId.current = ''
    }
  }

  // to-foreign 모드에서 왼쪽 패널 원문 중복 제거
  const originItems: TranslationItem[] = direction === 'to-foreign'
    ? items.filter((item, idx, arr) =>
        arr.findIndex(i => i.original === item.original && i.timestamp === item.timestamp) === idx
      )
    : items

  return (
    <div
      className="flex flex-col h-screen text-white"
      style={{ background: 'rgba(10,10,20,0.95)' }}
    >
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center gap-4">
          <button onClick={handleLeave} style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{meeting?.title || '실시간 통역'}</h1>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {direction === 'to-ko'
                ? <>{langLabel[sourceLang] || sourceLang} → 🇰🇷 한국어</>
                : <>🇰🇷 한국어 → {langLabel[targetLang]}</>
              }
            </span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {isActive && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              통역 중
            </span>
          )}
          {!isKoreanMeeting && (
            <button
              onClick={handleToggleDirection}
              disabled={isActive}
              title={isActive ? '통역 중에는 방향 변경 불가' : '통역 방향 전환'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.15)',
                color: isActive ? 'rgba(255,255,255,0.3)' : '#a78bfa',
                cursor: isActive ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {direction === 'to-ko' ? '외국어→한국어' : '한국어→외국어'}
            </button>
          )}
          <button onClick={() => document.documentElement.requestFullscreen?.()}>
            <Maximize2 className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
      </header>

      {/* TTS 설정 바: 언어 선택(to-foreign만) + TTS 토글 (양방향 공통) */}
      <div
        className="flex items-center gap-4 px-6 py-3"
        style={{
          background: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {direction === 'to-ko' && (
          <>
            <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>통역 언어</span>
            <div className="flex gap-2">
              {(['zh', 'en', 'vi'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => { if (!isActive) { setSourceLang(lang); clearItems() } }}
                  disabled={isActive}
                  className="text-sm px-4 py-1.5 rounded-lg font-medium transition-all"
                  style={{
                    background: sourceLang === lang ? 'linear-gradient(135deg,#a78bfa,#8b5cf6)' : 'rgba(255,255,255,0.07)',
                    color: sourceLang === lang ? '#fff' : 'rgba(255,255,255,0.45)',
                    boxShadow: sourceLang === lang ? '0 4px 12px rgba(139,92,246,0.35)' : 'none',
                    cursor: isActive ? 'not-allowed' : 'pointer',
                    opacity: isActive && sourceLang !== lang ? 0.4 : 1,
                  }}
                >
                  {langLabel[lang]}
                </button>
              ))}
            </div>
          </>
        )}
        {direction === 'to-foreign' && (
          <>
            <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>번역 언어</span>
            <div className="flex gap-2">
              {(['en', 'zh', 'vi'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => { if (!isActive) setTargetLang(lang) }}
                  disabled={isActive}
                  className="text-sm px-4 py-1.5 rounded-lg font-medium transition-all"
                  style={{
                    background: targetLang === lang ? 'linear-gradient(135deg,#a78bfa,#8b5cf6)' : 'rgba(255,255,255,0.07)',
                    color: targetLang === lang ? '#fff' : 'rgba(255,255,255,0.45)',
                    boxShadow: targetLang === lang ? '0 4px 12px rgba(139,92,246,0.35)' : 'none',
                    cursor: isActive ? 'not-allowed' : 'pointer',
                    opacity: isActive && targetLang !== lang ? 0.4 : 1,
                  }}
                >
                  {langLabel[lang]}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setTtsEnabled(e => !e)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
              style={{
                background: ttsEnabled ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: ttsEnabled ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}
            >
              {ttsEnabled
                ? isSpeaking
                  ? <><span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" /><span>출력 중</span></>
                  : <><Volume2 className="w-3.5 h-3.5" /><span>켜짐</span></>
                : <><VolumeX className="w-3.5 h-3.5" /><span>꺼짐</span></>
              }
            </button>
            {ttsEnabled && (
              <div className="flex items-center gap-2">
                <VolumeX className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <input
                  type="range"
                  min={0.5}
                  max={4.0}
                  step={0.1}
                  value={ttsVolume}
                  onChange={(e) => setTtsVolume(Number(e.target.value))}
                  className="w-24 accent-purple-500"
                  title={`볼륨 ${Math.round(ttsVolume * 100)}%`}
                />
                <Volume2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
                <span className="text-xs w-9 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(ttsVolume * 100)}%</span>
              </div>
            )}
          </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 원문 */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-y-auto p-4"
          style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-4 sticky top-0 py-1"
            style={{
              color: 'rgba(255,255,255,0.4)',
              background: 'rgba(10,10,20,0.9)',
            }}
          >
            원문
          </h2>
          {originItems.length === 0 && !isActive && (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>통역 시작 버튼을 눌러 시작하세요.</p>
          )}
          {originItems.map((item) => (
            <div
              key={item.id}
              className="mb-4 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
              </div>
              <p className="text-white leading-relaxed">{item.original}</p>
            </div>
          ))}
        </div>

        {/* 오른쪽: 번역 */}
        <div ref={rightPanelRef} className="flex-1 overflow-y-auto p-4">
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-4 sticky top-0 py-1"
            style={{
              color: 'rgba(255,255,255,0.4)',
              background: 'rgba(10,10,20,0.9)',
            }}
          >
            {direction === 'to-ko' ? '🇰🇷 한국어 번역' : `${langLabel[targetLang]} 번역`}
          </h2>
          {items.map((item) => {
            const isPlaying = playingId === item.id
            const lang = direction === 'to-ko' ? 'ko' : targetLang
            const bgColor = direction === 'to-ko' ? 'rgba(29,78,216,0.2)' : 'rgba(255,255,255,0.06)'
            const borderColor = direction === 'to-ko' ? 'rgba(59,130,246,0.3)' : 'rgba(139,92,246,0.25)'
            const timeColor = direction === 'to-ko' ? '#60a5fa' : '#a78bfa'
            const textColor = direction === 'to-ko' ? '#eff6ff' : '#ffffff'
            return (
              <div
                key={item.id}
                className="mb-4 p-3 rounded-lg"
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: timeColor }}>
                    {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
                  </span>
                  <button
                    onClick={() => isPlaying ? stopTts() : playTts(item.translated, lang, item.id)}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
                    style={{
                      background: isPlaying ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                      color: isPlaying ? '#f87171' : 'rgba(255,255,255,0.4)',
                    }}
                    title={isPlaying ? '중지' : '다시 듣기'}
                  >
                    {isPlaying
                      ? <><Square className="w-3 h-3" /><span>중지</span></>
                      : <><Play className="w-3 h-3" /><span>재생</span></>
                    }
                  </button>
                </div>
                <p className="text-lg leading-relaxed" style={{ color: textColor }}>{item.translated}</p>
              </div>
            )
          })}
          {items.length === 0 && !isActive && direction === 'to-foreign' && (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>통역 시작 버튼을 눌러 시작하세요.</p>
          )}
        </div>
      </div>

      {(interpretError || saveError) && (
        <div
          className="flex items-center justify-center px-6 py-2"
          style={{
            background: 'rgba(127,29,29,0.5)',
            borderTop: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <span className="text-red-400 text-sm">⚠️ {interpretError || saveError}</span>
        </div>
      )}

      <div
        className="flex justify-center items-center gap-4 py-6"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {!isActive ? (
          <button
            onClick={start}
            className="flex items-center gap-2 px-8 py-3 rounded-full font-semibold transition-colors"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 6px 20px rgba(239,68,68,0.45)',
              cursor: 'pointer',
            }}
          >
            <Mic className="w-5 h-5" />
            통역 시작
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-8 py-3 rounded-full font-semibold transition-colors"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <MicOff className="w-5 h-5" />
            중지
          </button>
        )}
        <button
          onClick={handleEnd}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
            opacity: saving ? 0.6 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          <Save className="w-5 h-5" />
          {saving ? '저장 중...' : '종료 및 저장'}
        </button>
      </div>
    </div>
  )
}
