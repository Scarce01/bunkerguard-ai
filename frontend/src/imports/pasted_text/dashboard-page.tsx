Build a complete React + Vite + TypeScript frontend for “BunkerGuard AI”, a maritime AI dashboard for real-time bunkering fraud detection.

Use:
- React
- TypeScript
- Tailwind CSS
- Recharts
- lucide-react
- Supabase client setup prepared, but use mock data first

Product:
BunkerGuard AI is a smart bunkering protection platform that detects mismatch between BDN declared quantity and MFM delivered quantity during bunkering. It generates anomaly alerts, risk score, AI recommendation, evidence report, LoP draft, blockchain hash record, and supplier reputation update.

Design style:
Create a restrained premium dark maritime operations dashboard.

Avoid:
- excessive card nesting
- too much glassmorphism
- purple/blue gradients everywhere
- overuse of neon glow
- everything centered
- generic crypto dashboard look

Use:
- deep navy background
- subtle glass surfaces
- thin borders
- strong typography hierarchy
- left-aligned content
- clear reading flow
- operational enterprise feel

Color system:
Background: #07111F, #0B1627, #101A2E
Surface: #111C31, #162338
Primary accent: #38BDF8
Success: #22C55E
Warning: #F59E0B
Critical: #EF4444
Text primary: #F8FAFC
Text secondary: #CBD5E1
Text muted: #94A3B8

Typography:
Use Inter or similar sans-serif.
H1: 36px semi-bold
Main KPI: 48–56px bold
Section title: 18–20px
Card title: 14–15px
Body: 13–14px
Meta: 11–12px
Body line-height: 1.6

Layout:
Desktop-first, widescreen dashboard.
Use a left sidebar + top header + main content grid.
Do not make every metric its own card. Group related metrics into shared surfaces with dividers.

Main navigation:
1. Dashboard
2. Sessions
3. Anomaly Monitor
4. Evidence Reports
5. Supplier Reputation
6. Fleet Alerts
7. Blockchain
8. Settings

Create these pages:

PAGE 1: Dashboard

Purpose:
Show live bunkering monitoring and mismatch detection.

Top header:
- Product name: BunkerGuard AI
- Tagline: Smart Bunkering Protection
- Search bar: “Search sessions, vessels, suppliers…”
- Notification icon
- User profile: BDN Officer, Port of Singapore
- Live pill: LIVE
- Last updated timestamp

Hero session strip:
Show:
- Active Session #16
- Vessel: MV PACIFIC HARMONY
- IMO: 9876543
- Supplier: MegaFuel Pte Ltd
- Barge: MT FUEL STAR 7
- Location: Singapore, Eastern Anchorage
- Fuel Grade: VLSFO RMG 380
- Status: BUNKERING

Grouped KPI strip:
One shared horizontal surface, divided into 5 columns:
1. BDN Quantity: 500.0 MT, Declared
2. MFM Delivered: 481.2 MT, Recorded
3. Mismatch: 18.8 MT, 3.76% Short, critical red
4. Risk Score: 78/100, CRITICAL
5. Estimated Loss: USD $11,000

Risk Score and Mismatch should be visually dominant.

Main chart:
Card title: BDN vs MFM Cumulative Comparison
Use Recharts line chart.
- BDN declared line: dashed, target reaching 500.0 MT
- MFM delivered line: solid cyan, ending at 481.2 MT
- Mark final gap with red annotation: “18.8 MT short”
- Add legend
- Add dropdown: Cumulative Mass

AI Copilot Recommendation panel:
Title: AI Copilot Recommendation
Content:
“Significant quantity discrepancy detected. MFM recorded 481.2 MT, while BDN declares 500.0 MT.”
Evidence:
“MFM final reading is 18.8 MT lower than declared BDN quantity.”
Recommendation:
REFUSE TO SIGN
Sub-action:
Issue Letter of Protest and request independent quantity verification.
Show confidence: 92%

Risk Assessment panel:
Show gauge or radial progress:
78/100 CRITICAL
Breakdown:
- Quantity Mismatch: 35/40
- Data Integrity: 18/20
- Regulatory Compliance: 12/20
- Supplier History: 13/20

Live Anomaly Feed:
Use list/table style, not many nested cards.
Columns:
Severity, Rule, Finding, Evidence, Time
Rows:
- CRITICAL | A02 | Quantity Final Mismatch | MFM 481.2 MT vs BDN 500.0 MT | 10:30:12
- HIGH | A01 | Quantity Trajectory Deviation | Projected final qty deviates >2% | 10:25:41
- MEDIUM | A07 | Meter Health | Drive gain above normal range | 10:12:05
- LOW | A22 | Temperature Anomaly | Temperature fluctuated within 10 minutes | 09:58:33

MFM Live Metrics:
Show 4 compact mini chart panels:
1. Mass Flow Rate: 125.3 MT/h
2. Cumulative Mass: 481.2 MT
3. Density: 991.5 kg/m³
4. Temperature: 42.3°C

Quick Actions:
Buttons:
- Generate Evidence Report
- Generate LoP
- View Blockchain Record
- Alert Fleet
- Mark as Reviewed

Blockchain Verification panel:
Show:
- Validation Hash: 0x7a3f...b8e92c
- Transaction Hash: 0x9d8c...f4a12e
- Block: #186,543,219
- Timestamp: 10 Jun 2026 10:30:22 UTC
- QR code placeholder
- Status banner: Data immutably recorded on blockchain

PAGE 2: Sessions

Purpose:
Show all bunkering sessions.

Features:
- Search sessions
- Filter by status: Active, Completed, Alert, Refused
- Filter by risk category: Low, Moderate, High, Critical
- Sort by newest, risk score, mismatch percentage
- Session table columns:
  - Session ID
  - Vessel
  - Supplier
  - Barge
  - Port
  - Fuel Grade
  - BDN Qty
  - MFM Qty
  - Mismatch %
  - Risk Score
  - Verdict
  - Status
- Clicking a row opens Session Detail page / modal.

Session detail should include tabs:
Overview, BDN Data, MFM Stream, Anomalies, Evidence, Blockchain.

PAGE 3: Anomaly Monitor

Purpose:
Show all anomaly detection rules and triggered anomalies.

Sections:
1. Rule Library
Show anomaly rules:
A01 Quantity Trajectory Deviation
A02 Quantity Final Mismatch
A03 Density Deviation
A04 Flow Rate Anomaly
A05 Reverse Flow
A06 Meter Fault
A08 Sulphur Non-Compliance
A10 Grade Mismatch
A11 Vessel Name Mismatch
A12 IMO Mismatch
A15 Supplier Unlicensed
A16 Missing Signature
A19 Invoice Qty Mismatch
A21 Sample Seal Mismatch
A24 Tank Overfill Risk

For each rule show:
- Rule ID
- Name
- Trigger condition
- Severity
- Check frequency
- Data sources

2. Triggered Anomalies
Use operational table:
- Rule ID
- Severity
- Source A
- Source B
- Deviation
- Description
- Acknowledged
- Resolved

Allow UI actions:
- Acknowledge
- Mark Resolved
- View Evidence

PAGE 4: Evidence Reports

Purpose:
Generate and view formal evidence reports.

Features:
- Report list
- Generate new report button
- Report viewer with sections
- Download PDF button
- Copy report summary
- Generate LoP button

Report Viewer sections:
1. Header
- Session ID
- Date
- Vessel
- Supplier
- Barge

2. BDN Summary
Show all BDN fields with validation status:
- BDN reference
- Vessel name
- Vessel IMO
- Supplier name
- Supplier licence
- Barge name
- Barge IMO
- Port
- Product grade
- Sulphur %
- Density 15C
- Flash point
- Quantity MT
- Sample seal number
- Supplier signed
- Officer signed

3. MFM Summary
- Final quantity
- Duration
- Average flow rate
- Density average
- Temperature average
- Small chart

4. Quantity Comparison
Table:
- BDN Qty
- MFM Qty
- Survey Qty
- Invoice Qty
- Difference
- Status

5. Anomaly Report
Sorted by severity.

6. Risk Assessment
- Score
- Category
- Financial impact
- Supplier history context

7. AI Analysis
Show:
- Summary
- Specific concerns
- Recommendation
- Confidence

8. LoP Draft
Pre-filled Letter of Protest text.
Include copy button and edit button.

9. Blockchain Record
Show:
- BDN hash
- MFM hash
- Validation hash
- Transaction hash
- QR code

PAGE 5: Supplier Reputation

Purpose:
Show Stage 6 supplier reputation update.

Main supplier profile:
- Supplier: MegaFuel Pte Ltd
- Licence: MPA-BKR-2024-0042
- Status: Flagged
- Reputation Score: 38/100
- Previous Score: 52/100
- Change: -14

Reputation score factors:
- Average discrepancy %: 30%
- Dispute rate: 25%
- Critical anomaly frequency: 20%
- Document compliance rate: 15%
- Trend direction: 10%

Show reputation trend chart.

Historical transactions table:
Columns:
- Session ID
- Date
- Vessel
- BDN Qty
- MFM Qty
- Discrepancy MT
- Discrepancy %
- Risk Score
- Verdict
- LoP Issued
- Blockchain Tx

Pattern alert:
“3 of 6 sessions in 5 days show >1% short delivery.”

Recommendation:
“Engage independent surveyor for all future MegaFuel deliveries.”

PAGE 6: Fleet Alerts

Purpose:
Show multi-agent broadcast alerts.

Features:
- Fleet alert cards/list
- Alert type: SUPPLIER_FLAG, FLEET_ALERT, INFO
- Supplier name
- Trigger session
- Trigger reason
- Pattern detected
- Estimated total loss
- Affected active sessions
- Recommendation

Example alert:
Alert Type: SUPPLIER_FLAG
Supplier: MegaFuel Pte Ltd
Supplier Reputation: 38
Trigger Session: Session #16 — MV Crimson Tide
Trigger Reason: Quantity short delivery 3.76% / 18.8 MT
Pattern: 3 of 6 sessions in 5 days show >1% short delivery
Affected Sessions: #19, #20
Recommendation: Engage independent surveyor

Include visual:
- simple network map / node diagram
- supplier node in red
- active session nodes connected
- affected sessions highlighted

PAGE 7: Blockchain

Purpose:
Show signed bundles and immutable records.

Features:
- Signed bundle list
- Session ID
- BDN Hash
- MFM Hash
- Validation Hash
- Tx Hash
- Risk Score
- Mismatch Flags
- QR code
- Timestamp

Signed Bundle detail:
- Raw hash fields
- QR code
- On-chain status
- Copy hash buttons
- View Explorer button

PAGE 8: Settings

Simple settings:
- Data source mode: Mock / Supabase
- Refresh interval
- Risk threshold settings
- Theme toggle
- Export options

Supabase preparation:
Create a lib/supabase.ts file.
Prepare service files:
- sessionsService.ts
- anomalyService.ts
- evidenceService.ts
- reputationService.ts
- blockchainService.ts

Use mock data now, but structure the code so later it can be replaced with Supabase queries.

Mock data files:
- mockSessions.ts
- mockBdnRecords.ts
- mockMfmStream.ts
- mockAnomalies.ts
- mockRiskScores.ts
- mockEvidenceReports.ts
- mockSupplierReputation.ts
- mockBlockchainRecords.ts
- mockFleetAlerts.ts

Components:
- AppLayout
- Sidebar
- TopBar
- StatusPill
- KpiStrip
- KpiMetric
- SectionPanel
- BdnMfmComparisonChart
- RiskGauge
- AiCopilotPanel
- AnomalyTable
- MfmMiniChartGrid
- QuickActions
- BlockchainVerificationPanel
- SessionTable
- SessionDetailTabs
- EvidenceReportViewer
- LopDraftPanel
- SupplierProfile
- ReputationTrendChart
- HistoricalTransactionsTable
- FleetAlertMap
- SignedBundleTable

Interactions:
- Sidebar navigation works
- Search input filters table where relevant
- Filters and sorting work on Sessions page
- Clicking session opens details
- Quick action buttons show modal/toast
- Generate Report opens Evidence Report page
- Generate LoP opens LoP draft
- View Blockchain opens Blockchain detail
- Alert Fleet opens Fleet Alert page
- Acknowledge anomaly changes UI state
- Mark resolved changes UI state

Important UX rules:
- Use left alignment for dashboard content.
- Only use center alignment for empty states or big status indicators.
- Avoid too many nested cards.
- Use spacing, dividers, headings, and layout grouping instead of wrapping everything in cards.
- Make Risk Score, Mismatch, and AI Recommendation the strongest visual focus.
- Blockchain should be secondary, not the main focus.
- UI must look polished, realistic, and demo-ready.