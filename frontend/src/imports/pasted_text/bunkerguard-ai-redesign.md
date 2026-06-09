Redesign and refine the BunkerGuard AI UI/UX into a cleaner, more premium, more scalable maritime intelligence platform with strong information hierarchy, enterprise-grade usability, and maximum clarity for hackathon judging.

The current UI has feature overlap, excessive cognitive load, duplicated AI interfaces, and too many deep pages. Refine the product architecture, simplify navigation, improve visual hierarchy, and maximize UX while keeping the premium “Palantir + maritime operations center + modern AI copilot” aesthetic.

GOAL:
The UI should feel:
- premium
- operational
- high-stakes
- maritime-industrial
- intelligent but not cluttered
- impressive for hackathon judges
- realistic for real-world deployment

Main Design Direction:
Think:
Palantir Foundry × Datadog × Tesla operations dashboard × maritime control center

VISUAL STYLE:
- Premium dark maritime theme
- Deep navy + dark slate + subtle steel gray
- Stronger contrast than current version
- Rich gradients (dark navy to deep blue)
- Slight glassmorphism only for secondary cards
- High visual hierarchy
- Cleaner spacing
- Less clutter
- Strong typography hierarchy
- Premium enterprise feeling

Color Direction:
Background:
#07111F
#0B1D33
#102845

Accent:
Deep ocean blue
Cyan highlights for active data
Amber for warnings
Red for critical anomalies

Avoid:
- washed-out colors
- low contrast
- excessive frosted glass
- overuse of gradients
- dashboard overcrowding

DESIGN PRINCIPLES:
1. Reduce cognitive load
2. Clear page responsibility
3. No duplicate functionality
4. Fewer but stronger UI sections
5. Strong visual hierarchy
6. Optimize for fast decision making
7. Prioritize operational clarity
8. Showcase AI naturally without forcing AI everywhere
9. Make judges immediately understand the product value

SIDEBAR NAVIGATION (REFINED)
Only 6 main pages:

1. Dashboard
2. Live Session
3. Sessions
4. Intelligence
5. Evidence Center
6. Settings (collapsed/minimized)

Sidebar:
- elegant active-state animation
- subtle glow for active page
- ship/radar inspired iconography
- live system health badge at top
- compact, premium spacing

------------------------------------
PAGE 1 — DASHBOARD
(Role: Executive Overview / Fleet Monitoring)

Purpose:
High-level overview of all active bunkering operations.

DO NOT make this page overly detailed.

Layout:
12-column grid.

Top Row:
4 premium KPI cards:
- Active Sessions
- Critical Alerts
- Estimated Loss Prevented
- Supplier Risk Warnings

Middle Left:
Fleet Activity Map
- interactive maritime port visualization
- live vessel nodes
- pulsing risk signals
- connection lines
- hover state

Middle Right:
AI Intelligence Summary Card
NOT a chatbot.

Display:
- current highest-risk session
- top anomaly
- recommendation
- confidence score
- one CTA:
"Open Live Session"

Below:
Live Anomaly Feed
Compact table:
Severity | Session | Finding | Time

Bottom:
High-Risk Suppliers panel
Small reputation trend visualization

Goal:
Clean.
Quick understanding.
Executive summary feel.

------------------------------------
PAGE 2 — LIVE SESSION
(Role: Operational War Room)

MOST IMPORTANT PAGE.

This is the WOW factor page.

Layout:
3-column immersive operational layout.

LEFT PANEL (Telemetry)
Compact vertical cards:
- Flow Rate
- Pressure
- Temperature
- Density
- MFM Delivered
- BDN Target
- Shortage Amount

Large:
Transfer progress bar
ETA countdown

CENTER PANEL (Hero Area)
Large immersive visualization.

Toggle:
1. Tactical View
2. Port Map View

Tactical View:
Highly polished animated bunkering visualization:
vessel ↔ bunker barge
animated fuel transfer pipes
live flow animation
anomaly pulse effects
warning highlights

Port Map View:
high-end maritime intelligence map
AIS vessel positions
risk heat overlay

BOTTOM STATUS BAR:
5 clean blocks:
- Progress
- ETA
- Active Alerts
- Session Status
- Recommended Action

RIGHT PANEL — AI COPILOT
ONLY MAIN CHAT INTERFACE IN ENTIRE SYSTEM.

Modern premium copilot UI.

Features:
- live confidence %
- fraud probability
- recommendation card
- suggested quick prompts

Suggested prompts:
- Explain quantity mismatch
- Why is supplier flagged?
- Show evidence chain
- Compare historical sessions
- What should officer do next?

Conversation UI:
clean spacing
minimal bubbles
professional tone

Quick Actions:
- Generate Protest Letter
- Investigate Session
- Escalate Alert

Goal:
This page should feel:
“mission control center”.

------------------------------------
PAGE 3 — SESSIONS
(Role: Historical Operations)

Purpose:
Browse and review past bunkering sessions.

Top:
Search + Filters:
- vessel
- supplier
- risk level
- verdict
- date

Main:
Clean premium data table.

Columns:
Session #
Vessel
Supplier
Port
Fuel Grade
BDN Qty
MFM Qty
Mismatch %
Risk Score
Verdict
Status

Right-side drawer opens on click:
Quick summary preview
without full navigation.

Goal:
Fast audit workflow.

------------------------------------
PAGE 4 — INTELLIGENCE
(Role: Fleet Intelligence + Supplier Risk)

ONLY 2 TABS.

TAB 1 — Supplier Intelligence

Top KPIs:
- Reputation Score
- Avg Discrepancy
- Flagged Sessions
- Risk Trend

Main:
Supplier profile card

Reputation trend chart

Risk Factors breakdown:
weighted bars

Pattern Detection banner:
“3 of 6 sessions show short delivery”

Historical sessions table

Goal:
Strong predictive intelligence feel.

TAB 2 — Fleet Intelligence

Fleet alert cards:
- supplier issue
- trigger session
- risk reason
- affected vessels

Interactive network visualization:
supplier ↔ vessel relationships

Highlight suspicious patterns.

Goal:
Strong AI multi-agent intelligence feel.

------------------------------------
PAGE 5 — EVIDENCE CENTER
(Role: Investigation & Action)

ONLY 2 TABS.

TAB 1 — Investigation

Top:
Session summary cards

Center:
Evidence timeline
showing:
BDN
MFM
AIS
Anomalies
Risk escalation

Comparison module:
BDN qty vs MFM qty vs invoice qty

Blockchain verification card
clean and minimal

AI-generated investigation summary
(NO chatbot)

Goal:
Clear evidence story.

TAB 2 — Protest & Report

Hero banner:
“Letter of Protest Required”

Full generated protest letter

Editable fields

Export:
PDF
Report
Blockchain reference

Checklist:
required compliance steps

Goal:
Fast action taking.

------------------------------------
PAGE 6 — SETTINGS
Minimal.
Secondary priority.
Keep hidden/collapsed.

------------------------------------
UX IMPROVEMENTS REQUIRED

1. Remove duplicated AI chat interfaces.
Only one copilot in Live Session.

2. Remove feature duplication across pages.

3. Reduce tabs dramatically.

4. Strong visual hierarchy.

5. More whitespace.

6. Better spacing system.

7. Cleaner cards.

8. Bigger typography hierarchy.

9. Improve readability.

10. Higher contrast.

11. Better animation polish.

12. Premium loading skeletons.

13. Add subtle motion:
- pulsing risk signals
- live data shimmer
- animated status indicators

14. Make interactions feel expensive and polished.

15. Every page must have one clear responsibility.

16. Optimize for a 5-minute hackathon demo flow.

DEMO FLOW MUST FEEL:
Dashboard
→ Live Session
→ AI detects anomaly
→ Evidence Center
→ Protest Letter
→ Intelligence Learning

Outcome:
The UI should feel world-class, realistic, premium, and significantly cleaner while maximizing usability and judge comprehension.