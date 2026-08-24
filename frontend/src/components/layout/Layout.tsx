import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex h-screen" style={{ background: 'transparent' }}>
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
