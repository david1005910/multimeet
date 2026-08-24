import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { audioApi } from '../services/api'
import { Minutes } from '../types'
import MinutesEditor from '../components/minutes/MinutesEditor'
import DownloadButton from '../components/minutes/DownloadButton'

export default function MinutesViewer() {
  const { meetingId } = useParams<{ meetingId: string }>()
  // null = 서버 값 미반영 상태. 사용자의 빈 문자열('') 편집도 구분하기 위해 null을 쓴다.
  const [content, setContent] = useState<string | null>(null)

  const { data: minutes, isLoading } = useQuery<Minutes>({
    queryKey: ['minutes', meetingId],
    queryFn: () => audioApi.getMinutes(meetingId!).then((r) => r.data),
    enabled: !!meetingId,
    // 포커스 복귀 시 refetch가 편집 중인 내용을 덮어쓰지 않도록 끈다
    refetchOnWindowFocus: false,
  })

  // 최초 로드 시 한 번만 서버 값을 에디터에 반영한다
  useEffect(() => {
    if (minutes && content === null) setContent(minutes.content)
  }, [minutes, content])

  if (isLoading || (minutes && content === null)) {
    return <div className="p-8" style={{ color: 'rgba(255,255,255,0.5)' }}>불러오는 중...</div>
  }
  if (!minutes || content === null) {
    return <div className="p-8" style={{ color: 'rgba(255,255,255,0.5)' }}>회의록을 찾을 수 없습니다.</div>
  }

  return (
    <div className="p-8 max-w-4xl" style={{ background: 'transparent' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>회의록</h1>
        </div>
        <DownloadButton meetingId={meetingId!} content={content} />
      </div>
      <MinutesEditor
        meetingId={meetingId!}
        content={content}
        onUpdate={setContent}
      />
    </div>
  )
}
