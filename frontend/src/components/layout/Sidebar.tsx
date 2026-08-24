import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, List, Plus, Settings, LogOut, Mic } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/meetings', icon: List, label: '회의 목록' },
  { to: '/meetings/new', icon: Plus, label: '새 회의' },
  { to: '/settings', icon: Settings, label: '설정' },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <aside
      className="w-56 flex flex-col"
      style={{
        background: 'rgba(255, 255, 255, 0.10)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-5 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Mic className="w-6 h-6" style={{ color: '#a78bfa' }} />
        <span className="text-lg font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
          MultiMeet
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex items-center gap-3 px-5 py-3 text-sm transition-all"
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    borderRadius: '12px',
                    margin: '2px 8px',
                    padding: '10px 16px',
                    boxShadow: 'inset 0 0 12px rgba(255,255,255,0.06)',
                    borderLeft: '3px solid #a78bfa',
                  }
                : {
                    color: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: '12px',
                    margin: '2px 8px',
                    padding: '10px 16px',
                  }
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="flex items-center gap-3 mx-2 mb-3 px-4 py-3 text-sm transition-all"
        style={{
          color: 'rgba(255, 255, 255, 0.55)',
          borderRadius: '12px',
          background: 'transparent',
          border: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'
        }}
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>
    </aside>
  )
}
