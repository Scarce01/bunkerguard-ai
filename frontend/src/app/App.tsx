import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LiveSessionPage } from './pages/LiveSessionPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { IntelligencePage } from './pages/IntelligencePage';
import { EvidenceCenterPage } from './pages/EvidenceCenterPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnomalyMonitorPage } from './pages/AnomalyMonitorPage';
import { BlockchainPage } from './pages/BlockchainPage';
import { SupplierReputationPage } from './pages/SupplierReputationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/live" element={<LiveSessionPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/evidence" element={<EvidenceCenterPage />} />
          <Route path="/anomalies" element={<AnomalyMonitorPage />} />
          <Route path="/blockchain" element={<BlockchainPage />} />
          <Route path="/suppliers" element={<SupplierReputationPage />} />
          <Route path="/suppliers/:supplierId" element={<SupplierReputationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
