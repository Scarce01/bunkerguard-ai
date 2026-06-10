import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PortCopilot } from '../PortCopilot';

export function AppLayout() {
  /* App shell:
   *   - Outer flex pins viewport height + hides outer scroll so the chrome
   *     (sidebar + topbar) never scrolls.
   *   - <main> is the page-scroll container — overflowY:auto means EVERY
   *     route can flow content past the viewport bottom and scroll, even
   *     on a 13" laptop. Pages should NOT set their own `height:100vh` —
   *     they live inside main and grow naturally. Pages that need a
   *     non-scrolling layout (e.g. LiveSessionPage's 3D scene + side rail)
   *     can still opt out by setting overflow:hidden + flex:1 on their
   *     own root div. */
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
      <PortCopilot />
    </div>
  );
}
