Refine the entire BunkerGuard AI dashboard UI to feel like a professional maritime intelligence platform used by PSA / port authorities, instead of an AI-generated cyber dashboard.

Main goal:
Create a premium, deployable, enterprise-grade UX with strong information hierarchy, cleaner spacing, less visual clutter, and more realistic control-room aesthetics.

The UI should feel like:
Bloomberg Terminal × Maritime Control Center × Enterprise SaaS

NOT:
cheap AI-generated cyberpunk dashboard, gaming UI, glowing sci-fi interface, excessive floating cards, random spacing, or generic hackathon prototype.

---

1. INFORMATION ARCHITECTURE REFACTOR

---

The current dashboard contains too much information and feels overwhelming. Reduce cognitive load.

Split content into categorized pages.

New page structure:

1. Dashboard (Macro Overview)
   Purpose:
   Quick situational awareness in under 30 seconds.

Keep only:

* Session summary
* Risk overview
* Financial impact
* Supplier summary
* AI recommendation
* Compact live port snapshot
* Top anomaly alerts

Remove from dashboard:

* Long investigation workflow
* Detailed timeline
* Huge anomaly tables
* Deep evidence breakdown
* Long AI explanations
* Repetitive telemetry metrics

Dashboard layout:

Top KPI summary strip
↓
Compact live bunkering snapshot
↓
AI verdict + risk summary
↓
Critical alerts queue
↓
Mini evidence preview

Dashboard should fit within roughly 1–2 screen heights maximum.

Avoid long scrolling.

2. Live Session Page
   Purpose:
   Real-time bunkering monitoring.

Move detailed tactical view here.

Layout:

LEFT PANEL:
Compact telemetry panel:

* GPS position
* Temperature
* Density
* Flow rate
* Pressure

CENTER:
Main tactical visualization:
Receiving Vessel → Transfer Route → Supply Barge

Center should be the visual hero.

Only highlight:

* Quantity mismatch
* Transfer anomaly
* Current session state

RIGHT PANEL:
AI Copilot Panel:

* Risk score
* Confidence
* Recommendation
* Investigation action buttons

BOTTOM STATUS BAR:
Compact operational strip:

* Transfer progress
* ETA
* Current alert count
* Recommendation
* Session status

Make this compact, not oversized.

3. Alerts & Response Page
   Purpose:
   Incident handling.

Show:

* Critical alerts
* Escalation queue
* Alert severity
* AI recommendations
* Investigation status
* Resolution flow

4. Evidence & Investigation Page
   Purpose:
   Prove fraud and generate evidence.

Show:

* BDN vs MFM comparison chart
* Blockchain verification
* Timeline of anomalies
* AI confidence
* Evidence export
* Supplier history

5. Supplier Intelligence Page
   Purpose:
   Supplier risk analysis.

Show:

* Reputation score
* Historical anomalies
* Fraud trend
* Session history
* High-risk flags
* Reliability metrics

---

2. FIX PORT MAP / TACTICAL VIEW

---

Current issue:
The port map feels visually chaotic, empty, and randomly arranged.

Problems:

* Too many floating cards
* Poor hierarchy
* Unclear focus
* Too much empty space
* Center lacks strong narrative

Refactor layout.

LEFT SIDE:
Dock telemetry cards vertically.
Fixed width.
No floating random cards.

Cards:

* GPS
* Temperature
* Density
* Flow rate
* Pressure

Small compact cards.

CENTER:
Main visual hero.

Only focus on:
Receiving Vessel
↓
Transfer line
↓
Supply Barge

Make the anomaly line visually clear and meaningful.

Center should prioritize:
“Quantity mismatch detected”

Only one primary alert card in center.

Remove unnecessary floating mini containers.

RIGHT SIDE:
Dock a fixed AI Copilot panel.

Include:

* AI verdict
* Risk score
* Confidence breakdown
* Recommendation
* Investigation button
* Generate protest letter

BOTTOM:
Compact operational bar.

Not oversized.

Show:

* Transfer progress
* ETA
* Alert status
* AI recommendation
* Session completion %

---

3. REMOVE AI-GENERATED LOOK

---

Current UI feels too AI-generated.

Remove:

* Excessive glow effects
* Overly neon cyber styling
* Too many borders
* Random floating pills
* Overuse of glassmorphism
* Cheap futuristic effects
* Too many outlined cards

Design should feel:
professional
realistic
high-trust
enterprise-grade

More subtle visual depth.

Use:

* soft shadows
* subtle contrast
* layered panels
* clean dividers

Reduce visual noise significantly.

---

4. TYPOGRAPHY SYSTEM

---

Current issue:
Typography hierarchy is weak.
Everything feels same size.

Create a clear font hierarchy.

Page title:
32–36px
Bold

Section title:
22–24px
Semibold

Card title:
16–18px
Medium

Large metrics:
48–64px
Bold

Examples:
18.8 MT
78/100
$11K

Supporting text:
12–14px
Muted opacity

Use no more than 4 font sizes per screen.

Improve readability and scanning.

---

5. COLOR SYSTEM REFINEMENT

---

Current issue:
Colors feel noisy and inconsistent.

Reduce color palette.

Primary base:
Deep navy / dark maritime blue.

Accent:
Electric blue.

Semantic colors only:
Green = verified / healthy
Amber = warning
Red = critical issue

Remove:
random teal glows
oversaturated cyan
too many accent colors

Red should only appear:
for critical issues.

Not everywhere.

Create stronger visual hierarchy using restraint.

---

6. SPACING SYSTEM

---

Current spacing feels random.

Create a consistent spacing system.

Use:
Section spacing = 24px
Card spacing = 16px
Internal padding = 24px
Small gaps = 8px

Reduce oversized empty spaces between sections.

Avoid giant blank areas.

Create stronger alignment and grid consistency.

Everything should feel structured.

---

7. COMPONENT REDUCTION

---

Reduce excessive containers.

Current issue:
Container inside container inside container.

Simplify.

Replace many borders with:

* subtle dividers
* tonal separation
* background elevation

Fewer rounded cards.

Cleaner enterprise UI.

---

8. CHART IMPROVEMENTS

---

Current charts feel generic and default.

Improve evidence chart.

Add:

* threshold line
* anomaly region highlight
* anomaly point indicators
* subtle annotations
* meaningful legends

Chart should tell a story.

Not look like a default analytics template.

---

9. ANOMALY FEED REDESIGN

---

Current anomaly table feels too spreadsheet-like.

Redesign into:
compact alert cards or lightweight enterprise table.

Each anomaly should show:

Severity
Rule ID
Issue
Time
Quick actions

Actions:

* Evidence
* Investigate

Improve readability.

Reduce text density.

---

10. DESIGN DIRECTION

---

Final aesthetic target:

Professional maritime operations platform.

Feels like:
PSA control room
real port intelligence system
enterprise maritime SaaS

Keywords:
minimal
high trust
clean
intelligent
operational
premium
deployable
less flashy
less AI-generated
more realistic

The interface should feel like something an actual maritime authority or port operator would use daily.
