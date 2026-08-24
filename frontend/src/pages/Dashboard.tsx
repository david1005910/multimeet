import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useMeetings } from '../hooks/useMeetings'
import { useAuthStore } from '../stores/authStore'
import MeetingCard from '../components/meeting/MeetingCard'

const glassCard = {
  background: 'rgba(255, 255, 255, 0.14)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.20), inset 0 0 12px rgba(255,255,255,0.06)',
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { data: meetings, isLoading } = useMeetings()
  const recent = meetings?.slice(0, 5) || []

  const stats = {
    total: meetings?.length || 0,
    ko: meetings?.filter((m) => m.language === 'ko').length || 0,
    en: meetings?.filter((m) => m.language === 'en').length || 0,
    zh: meetings?.filter((m) => m.language === 'zh').length || 0,
    vi: meetings?.filter((m) => m.language === 'vi').length || 0,
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#ffffff' }}>
            안녕하세요, {user?.name || user?.email}님 👋
          </h1>
          <p className="mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>오늘도 성공적인 미팅 되세요.</p>
        </div>
        <Link
          to="/meetings/new"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
            color: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 6px 20px rgba(139,92,246,0.45)',
          }}
        >
          <Plus className="w-4 h-4" />
          새 회의 시작
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: '전체 회의', value: stats.total },
          { label: '🇰🇷 한국어', value: stats.ko },
          { label: '🇺🇸 영어', value: stats.en },
          { label: '🇨🇳 중국어', value: stats.zh },
          { label: '🇻🇳 베트남어', value: stats.vi },
        ].map((stat) => (
          <div key={stat.label} style={{ ...glassCard, padding: '20px' }}>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{stat.label}</p>
            <p className="text-3xl font-semibold mt-1" style={{ color: '#ffffff' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium mb-4" style={{ color: 'rgba(255,255,255,0.8)' }}>최근 회의</h2>
        {isLoading ? (
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>불러오는 중...</p>
        ) : recent.length === 0 ? (
          <div
            className="text-center py-12"
            style={glassCard}
          >
            <p className="mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>아직 회의가 없습니다.</p>
            <Link to="/meetings/new" style={{ color: '#a78bfa', fontSize: '14px' }}>
              첫 번째 회의를 시작해보세요 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
