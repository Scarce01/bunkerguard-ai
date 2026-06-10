import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Activity,
  Database,
  BarChart2,
  Shield,
  Settings,
  AlertTriangle,
  Users,
  FileText,
} from 'lucide-react';

const navigationItems = [
  { path: '/',             label: 'Dashboard',       icon: LayoutDashboard },
  { path: '/live',         label: 'Live Session',    icon: Activity },
  { path: '/sessions',     label: 'Sessions',        icon: Database },
  { path: '/anomalies',    label: 'Anomaly Monitor', icon: AlertTriangle },
  { path: '/intelligence', label: 'Intelligence',    icon: BarChart2 },
  { path: '/suppliers',    label: 'Suppliers',       icon: Users },
  { path: '/evidence',     label: 'Evidence Center', icon: Shield },
  { path: '/reports',      label: 'Reports',         icon: FileText },
  { path: '/settings',     label: 'Settings',        icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  /* match /intelligence even on sub-paths */
  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  return (
    <div
      className="w-64 h-screen flex flex-col"
      style={{
        background: '#08131F',
        borderRight: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="flex items-center gap-2.5 mb-0.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(46,168,255,0.12)',
              border: '1px solid rgba(46,168,255,0.25)',
            }}
          >
            <Shield className="w-4 h-4" style={{ color: '#2EA8FF' }} />
          </div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#EFF4F9' }}>
            BunkerGuard AI
          </h1>
        </div>
        <p className="text-[10px] mt-1 pl-9" style={{ color: '#4A6B88', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
          Maritime Intelligence
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-0.5">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          /* Settings gets extra top spacing to push toward bottom */
          const isSettings = item.path === '/settings';

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg"
              style={{
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                borderLeft: active ? '3px solid #2EA8FF' : '3px solid transparent',
                background: active ? 'rgba(46,168,255,0.14)' : 'transparent',
                color: active ? '#E5F2FF' : '#557A96',
                boxShadow: 'none',
                marginTop: isSettings ? 'auto' : undefined,
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(46,168,255,0.08)';
                  (e.currentTarget as HTMLElement).style.color = '#8BB4D6';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#557A96';
                }
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                strokeWidth={active ? 2 : 1.5}
                style={{ color: active ? '#2EA8FF' : 'currentColor' }}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Status */}
      <div className="px-4 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <div
          className="px-3.5 py-3 rounded-lg"
          style={{
            background: 'rgba(7,17,29,0.8)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#00D47E',
                boxShadow: '0 0 6px rgba(0,212,126,0.55)',
                animation: 'livePulse 3s ease-in-out infinite',
              }}
            />
            <span
              className="text-[10px] font-semibold"
              style={{ color: '#3D5A75', textTransform: 'uppercase', letterSpacing: '0.12em' }}
            >
              System Online
            </span>
          </div>
          <p className="text-[10px] pl-3.5" style={{ color: 'rgba(61,90,117,0.55)' }}>
            All 12 sensors active · 0 faults
          </p>
        </div>
      </div>
    </div>
  );
}
