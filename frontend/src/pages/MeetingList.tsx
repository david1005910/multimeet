import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useMeetings } from '../hooks/useMeetings'
import MeetingCard from '../components/meeting/MeetingCard'

const glassInput: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  padding: '8px 12px',
  color: '#ffffff',
  fontSize: '14px',
  outline: 'none',
}

export default function MeetingList() {
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('')
  const { data: meetings, isLoading } = useMeetings({
    search: search || undefined,
    language: language || undefined,
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>회의 목록</h1>
        <Link
          to="/meetings/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
            color: '#ffffff',
            boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
          }}
        >
          <Plus className="w-4 h-4" />
          새 회의
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회의명 또는 회사명 검색"
            style={{ ...glassInput, paddingLeft: '36px', width: '100%' }}
          />
        </div>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={glassInput}
        >
          <option value="" style={{ background: '#0d1b4b' }}>전체 언어</option>
          <option value="ko" style={{ background: '#0d1b4b' }}>🇰🇷 한국어</option>
          <option value="en" style={{ background: '#0d1b4b' }}>🇺🇸 영어</option>
          <option value="zh" style={{ background: '#0d1b4b' }}>🇨🇳 중국어</option>
          <option value="vi" style={{ background: '#0d1b4b' }}>🇻🇳 베트남어</option>
        </select>
      </div>

      {isLoading ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>불러오는 중...</p>
      ) : !meetings?.length ? (
        <div
          className="text-center py-16"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
          }}
        >
          <p className="mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>회의가 없습니다.</p>
          <Link to="/meetings/new" className="text-sm" style={{ color: '#a78bfa' }}>
            첫 번째 회의를 시작해보세요 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}
