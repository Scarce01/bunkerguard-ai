# BunkerGuard AI - UI Demo Flow Guide

## 核心功能模块完整清单

### ✅ 1. Live Dashboard (/)
**实时监控中心 - 主页面**

包含功能：
- ✅ Active Session Overview (当前会话概览)
- ✅ Session Information Strip (会话信息条)
- ✅ Grouped KPI Strip (关键指标组 - 视觉突出 Mismatch 和 Risk Score)
- ✅ BDN vs MFM Comparison Chart (对比图表)
- ✅ AI Copilot Recommendation (AI建议 - 92% confidence)
- ✅ Live Anomaly Feed (实时异常提要 - 操作表格样式)
- ✅ Risk Assessment Gauge (风险评分仪表盘 - 半圆环设计)
- ✅ MFM Live Metrics Strip (实时 MFM 指标条)
- ✅ **Live Bunkering Session View (3D 数字孪生视图 - WOW Hero Section)**
  - 3D vessel + barge + pipeline 可视化
  - 实时燃料传输动画（渐变流动效果）
  - 异常红色脉冲（检测到关键异常时）
  - HUD 四角数据覆盖
  - 3D/2D 视图切换
  - Session Intelligence Panel
- ✅ Quick Actions (快速操作)
- ✅ Blockchain Verification Card (小型验证卡 - 降低视觉权重)

---

### ✅ 2. Session Investigation (/sessions/:sessionId)
**会话详细调查 - 点击 Sessions 列表任意行进入**

7个标签页：

#### Tab 1: Overview
- ✅ Quick Stats (4个关键指标卡)
- ✅ Session Information (完整会话信息)
- ✅ Document Checklist (文档清单 - 8项检查)
- ✅ Risk Breakdown (风险分解)

#### Tab 2: BDN Data
- ✅ 完整 BDN 数据表格（16个字段）
- ✅ Validation Status

#### Tab 3: MFM Stream
- ✅ MFM Summary (4个关键指标)
- ✅ Cumulative Mass Chart
- ✅ Mass Flow Rate Chart
- ✅ 完整时间序列数据可视化

#### Tab 4: AIS Data
- ✅ AIS Track Verified Status
- ✅ Geofence Verification
- ✅ Vessel Identity Verification
- ✅ Vessel AIS Data (MMSI, Call Sign, Flag, etc.)
- ✅ Barge AIS Data
- ✅ Geofence Zone Information

#### Tab 5: Anomaly Details
- ✅ 完整异常列表表格
- ✅ Rule ID, Severity, Finding, Evidence
- ✅ Acknowledged/Resolved Status

#### Tab 6: Evidence
- ✅ AI Analysis Summary
- ✅ Quantity Comparison Table
- ✅ Recommendation Display

#### Tab 7: Blockchain
- ✅ BDN Hash, MFM Hash
- ✅ Validation Hash, Transaction Hash
- ✅ Block Number, Timestamp
- ✅ Verification Status

**操作流程**: Sessions List → Click Row → Session Detail → 7 Tabs Navigation

---

### ✅ 3. Sessions (/sessions)
**所有会话列表**

- ✅ Search by vessel/supplier/session ID
- ✅ Filter by Status (Bunkering, Completed, Alert, Refused)
- ✅ Filter by Risk Level (Low, Moderate, High, Critical)
- ✅ 完整会话表格（11列）
- ✅ Click row → Navigate to Session Detail
- ✅ Real-time session count display

---

### ✅ 4. Anomaly Monitor (/anomalies)
**异常检测监控中心**

#### Anomaly Detection Rules (A01-A24)
- ✅ 17个检测规则卡片
- ✅ 每个规则显示：Rule ID, Name, Trigger Condition, Severity, Check Frequency, Data Sources

#### Triggered Anomalies
- ✅ 操作表格样式
- ✅ Columns: Rule, Session, Severity, Finding, Source A/B, Deviation, Timestamp, Status, Actions
- ✅ Acknowledge / Resolve 操作按钮
- ✅ Status indicators (acknowledged/resolved icons)

---

### ✅ 5. Risk Scoring (Integrated in Dashboard & Session Detail)
**风险评分系统**

- ✅ Score 0-100 display
- ✅ Risk Levels: LOW / MODERATE / HIGH / CRITICAL
- ✅ Risk Breakdown (4 factors):
  - Quantity Mismatch (max 40)
  - Data Integrity (max 20)
  - Regulatory Compliance (max 20)
  - Supplier History (max 20)
- ✅ Visual progress bars
- ✅ Semi-radial gauge visualization
- ✅ Real-time deviation tracking

---

### ✅ 6. AI Copilot (Integrated in Dashboard & Session Detail)
**AI 副驾驶**

- ✅ Plain-English Explanation (分析)
- ✅ Evidence Display (证据)
- ✅ Recommendation (REFUSE TO SIGN / Issue LoP)
- ✅ Confidence Score (92%)
- ✅ Visual prominence (Critical alert style)

---

### ✅ 7. Evidence Report (/evidence)
**证据报告生成**

- ✅ Report Header (Generated time, Session ID, Status)
- ✅ BDN Summary (15个字段完整表格)
- ✅ MFM Summary
- ✅ Quantity Comparison Table
- ✅ Anomaly Report Section
- ✅ Risk Assessment Display
- ✅ AI Analysis (Summary, Concerns, Recommendation, Confidence)
- ✅ LoP Draft (完整 Letter of Protest 文本)
- ✅ Blockchain Record Display
- ✅ Export PDF Button
- ✅ Copy Summary Button
- ✅ Generate New Report Button

---

### ✅ 8. Blockchain / Signed Bundle (/blockchain)
**区块链验证记录**

#### Signed Bundles Table
- ✅ Session ID, BDN Hash, MFM Hash, Validation Hash, Transaction Hash
- ✅ Block Number, Timestamp
- ✅ Copy hash buttons
- ✅ View Explorer links

#### Bundle Detail View
- ✅ 4个完整 Hash 显示卡片
- ✅ Block Number & Timestamp
- ✅ QR Code placeholder
- ✅ Verification Status
- ✅ View on Block Explorer button

---

### ✅ 9. Supplier Reputation (/supplier)
**供应商信誉系统**

- ✅ Supplier Profile (Name, Licence, Status)
- ✅ Reputation Score (38/100)
- ✅ Score Change Trend (-14)
- ✅ Score Factors (5项权重显示):
  - Average Discrepancy (30%)
  - Dispute Rate (25%)
  - Critical Anomaly Frequency (20%)
  - Document Compliance (15%)
  - Trend Direction (10%)
- ✅ Reputation Trend Chart (6 weeks history)
- ✅ Pattern Alert Banner ("3 of 6 sessions show >1% short delivery")
- ✅ Historical Transactions Table (完整历史)
- ✅ Recommendation ("Engage independent surveyor")

---

### ✅ 10. Fleet Alert / Port Copilot (/fleet)
**舰队警报 / 港口副驾驶**

每个 Alert 卡片包含：
- ✅ Alert Type (SUPPLIER_FLAG / FLEET_ALERT / INFO)
- ✅ Supplier Name & Reputation Score
- ✅ Trigger Session ID
- ✅ Trigger Reason
- ✅ Pattern Detected ("3 of 6 sessions in 5 days show >1% short delivery")
- ✅ Estimated Total Loss
- ✅ Affected Active Sessions (session ID badges)
- ✅ Recommendation
- ✅ Created Timestamp
- ✅ Visual status indicators

---

### ✅ 11. Settings (/settings)
**系统设置**

- ✅ Data Source Mode (Mock / Supabase)
- ✅ Refresh Interval
- ✅ Theme Selection
- ✅ Risk Thresholds Configuration
- ✅ Notification Preferences (5项开关)
- ✅ Export Options (CSV/JSON/PDF)
- ✅ Save/Reset buttons

---

## 完整 UI Demo Flow 推荐路径

### 流程 A: 实时监控发现问题流程
```
1. Dashboard (/) 
   → 查看 Active Session #16
   → 发现 Mismatch 18.8 MT (3.76%)
   → Risk Score 78/100 CRITICAL
   → AI 建议 "REFUSE TO SIGN"
   → Live Bunkering View 显示红色异常脉冲
   
2. Click "Sessions" in sidebar
   → Sessions (/sessions)
   → 点击 Session #16 行
   
3. Session Detail (/sessions/16)
   → Tab: Overview - 查看完整概览
   → Tab: BDN Data - 验证 BDN 声明 500.0 MT
   → Tab: MFM Stream - 确认 MFM 记录 481.2 MT
   → Tab: AIS Data - 验证船舶身份和地理围栏
   → Tab: Anomaly Details - 查看 4个异常（包括 A02 CRITICAL）
   → Tab: Evidence - 查看 AI 分析
   → Tab: Blockchain - 验证区块链记录
   
4. Click "Generate Report"
   → Evidence Report (/evidence)
   → 查看完整证据报告
   → 阅读 LoP Draft
   → Click "Download PDF"
```

### 流程 B: 供应商调查流程
```
1. Dashboard (/)
   → 注意到 Supplier: MegaFuel Pte Ltd
   
2. Click "Supplier Reputation" in sidebar
   → Supplier Reputation (/supplier)
   → 发现 Reputation Score 38/100 (FLAGGED)
   → Score 下降 -14
   → Pattern Alert: "3 of 6 sessions show >1% short delivery"
   → Historical Transactions 显示多次短交付
   
3. Click "Fleet Alerts" in sidebar
   → Fleet Alerts (/fleet)
   → 查看 SUPPLIER_FLAG alert
   → 影响 2个活跃会话 (#19, #20)
   → Recommendation: "Engage independent surveyor"
```

### 流程 C: 异常监控流程
```
1. Dashboard (/)
   → Live Anomaly Feed 显示 4个异常
   
2. Click "Anomaly Monitor" in sidebar
   → Anomaly Monitor (/anomalies)
   → 查看 17个检测规则 (A01-A24)
   → Triggered Anomalies 表格显示所有异常
   → Click "Acknowledge" on A02
   → Click "Resolve" on A22
```

### 流程 D: 区块链验证流程
```
1. Dashboard (/)
   → Blockchain Verification Card 显示 hash 预览
   
2. Click "Blockchain" in sidebar
   → Blockchain (/blockchain)
   → Signed Bundles 表格显示所有记录
   → Click Session #16 row
   → Bundle Detail 显示完整 hashes
   → Click "View on Block Explorer"
```

---

## 关键 UI/UX 特性

### ✅ Premium Enterprise Design
- 深色海洋主题配色
- 单一主色 Cyan Blue #38BDF8
- 语义颜色：Success/Warning/Critical
- 无过度渐变/发光
- 企业级操作感

### ✅ Information Hierarchy
- 大号关键指标 (48-56px for Risk Score & Mismatch)
- 分组表面替代独立卡片
- 清晰的阅读路径
- 左对齐布局

### ✅ Operational Realism
- Bloomberg Terminal 风格表格
- 专业操作界面
- 真实工具感
- 非装饰性 UI

### ✅ Hero Section
- Live Bunkering Session View (3D Digital Twin)
- 实时动画流动效果
- 异常状态视觉反馈
- 四角 HUD 数据覆盖

### ✅ Interactive Features
- Click-through navigation (Sessions → Session Detail)
- Tab-based detailed investigation
- Filter & search capabilities
- Toggle switches (3D/2D view)
- Action buttons throughout

---

## 技术实现

- ✅ React + TypeScript
- ✅ React Router (页面路由)
- ✅ Recharts (数据可视化)
- ✅ Tailwind CSS v4
- ✅ Lucide Icons
- ✅ 完整 Mock Data
- ✅ 响应式布局
- ✅ 动画效果（CSS + SVG）

所有核心功能已完整实现，UI 演示流程清晰有序！
