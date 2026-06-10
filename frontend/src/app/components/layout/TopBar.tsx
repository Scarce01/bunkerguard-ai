import { Search, Bell, User, X, AlertTriangle, CheckCircle2, Info, Fuel } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useFuelReference } from '../../../lib/useFuelReference';
import { useNow, SyncBadge } from '../../../lib/useNowClock';

export function TopBar() {
  const navigate = useNavigate();
  // Wall clock + per-tab refetch heartbeat now come from the single
  // NowClockProvider mounted at the App root, so every page derives "now"
  // from the same source. The old per-component setInterval is gone.
  const nowMs = useNow();
  const currentTime = new Date(nowMs);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const fuel = useFuelReference();
  const vlsfo = fuel.priceFor('VLSFO RMG 380');
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div
      className="h-16 border-b flex items-center justify-between px-8"
      style={{
        background: '#08131F',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search sessions, vessels, suppliers..."
            className="w-full rounded-2xl pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none transition-all"
            style={{
              background: '#0E1C2D',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(46,168,255,0.30)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-8">
        {/* Live Indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2 rounded"
            style={{
              background: 'rgba(0,212,126,0.07)',
              border: '1px solid rgba(0,212,126,0.18)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full bg-success"
              style={{ boxShadow: '0 0 6px rgba(0,212,126,0.5)', animation: 'livePulse 2s ease-in-out infinite' }}
            />
            <span className="text-xs font-bold text-success tracking-wider">LIVE</span>
          </div>

          {/* VLSFO price ticker — live from fuel_prices */}
          {vlsfo && (
            <div
              title={`${vlsfo.grade} · source: ${vlsfo.source} · updated ${new Date(vlsfo.recorded_at).toLocaleDateString()}`}
              className="flex items-center gap-2 px-3 py-2 rounded"
              style={{
                background: 'rgba(255,169,64,0.07)',
                border: '1px solid rgba(255,169,64,0.22)',
              }}>
              <Fuel size={11} style={{ color: '#FFA940' }} />
              <span className="text-[10px] font-bold tracking-wider" style={{ color: '#FFA940' }}>VLSFO</span>
              <span className="text-xs font-bold text-foreground tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                ${vlsfo.price_usd_per_mt.toFixed(0)}
              </span>
              <span className="text-[9px] text-foreground-muted">/MT</span>
            </div>
          )}
          <SyncBadge />
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-foreground-muted">{formatDate(currentTime)}</div>
          </div>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2.5 rounded-2xl transition-all"
            style={{
              background: '#0E1C2D',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#102033';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0E1C2D';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
            }}
          >
            <Bell className="w-5 h-5 text-foreground-secondary" strokeWidth={1.5} />
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-critical rounded-full"
              style={{ border: '1px solid #08131F' }}
            />
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-96 rounded-lg shadow-xl z-50"
              style={{
                background: '#0A1521',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                <button onClick={() => setNotificationsOpen(false)}>
                  <X className="w-4 h-4 text-foreground-muted" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {[
                  { icon: AlertTriangle, color: '#FF5A5A', title: 'Critical Session Alert', desc: 'Session #16 flagged for quantity mismatch', time: '2 min ago', path: '/sessions' },
                  { icon: AlertTriangle, color: '#FFB84D', title: 'Supplier Warning', desc: 'Supplier Gamma: 3 incidents in last 24h', time: '15 min ago', path: '/intelligence' },
                  { icon: CheckCircle2, color: '#00D98E', title: 'Evidence Verified', desc: 'Blockchain anchor confirmed for Session #15', time: '1 hour ago', path: '/evidence' },
                  { icon: Info, color: '#4A9EFF', title: 'System Update', desc: 'MFM calibration completed successfully', time: '3 hours ago', path: '/' },
                ].map((notif, i) => {
                  const Icon = notif.icon;
                  return (
                    <div
                      key={i}
                      onClick={() => { navigate(notif.path); setNotificationsOpen(false); }}
                      className="p-4 border-b border-border hover:bg-surface-secondary/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${notif.color}15`, border: `1px solid ${notif.color}30` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: notif.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground mb-1">{notif.title}</div>
                          <div className="text-xs text-foreground-muted mb-2">{notif.desc}</div>
                          <div className="text-xs text-foreground-secondary">{notif.time}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-border text-center">
                <button onClick={() => { setNotificationsOpen(false); }} className="text-xs font-semibold text-primary hover:text-primary/80">
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={userMenuRef}>
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 pl-6 border-l border-border cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-right">
              <div className="text-sm font-semibold text-foreground">BDN Officer</div>
              <div className="text-xs text-foreground-muted">Port of Singapore</div>
            </div>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(46, 168, 255, 0.10)',
                border: '1px solid rgba(46, 168, 255, 0.22)',
              }}
            >
              <User className="w-5 h-5 text-primary" strokeWidth={2} />
            </div>
          </div>

          {/* User Menu Dropdown */}
          {userMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl z-50"
              style={{
                background: '#0A1521',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="p-4 border-b border-border">
                <div className="text-sm font-bold text-foreground mb-1">BDN Officer</div>
                <div className="text-xs text-foreground-muted">officer@portofsingapore.sg</div>
              </div>
              <div className="py-2">
                {[
                  { label: 'Profile Settings', path: '/settings' },
                  { label: 'My Sessions', path: '/sessions' },
                  { label: 'Notification Preferences', path: '/settings' },
                  { label: 'Help & Documentation', path: '/' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(item.path); setUserMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-secondary/30 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <button
                  onClick={() => { alert('Logging out...'); setUserMenuOpen(false); }}
                  className="w-full px-4 py-2 text-sm font-semibold text-critical hover:bg-critical/10 rounded transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
