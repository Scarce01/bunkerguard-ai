Redesign the BunkerGuard dashboard into a premium maritime “Mission Control” overview page with significantly less scrolling and stronger information hierarchy. The current dashboard feels too vertically stacked and requires too much scrolling. Redesign it into a compact, high-density operational command center where a BDN officer can understand the current system state within 3–5 seconds.

Core Goal

Transform the dashboard from a long scrolling SaaS page into a one-screen operational overview dashboard.

Users should instantly understand:

What is happening now?
What is the highest risk?
What action should be taken?

The first screen should contain almost everything important without scrolling.

LAYOUT STRUCTURE

Reorganize the dashboard into a multi-column mission-control layout.

Use a layout similar to enterprise operational centers / maritime intelligence dashboards.

Structure:

┌───────────────────────────────────┬──────────────────────┐
│ Compact KPI Grid                  │ AI Verdict Panel     │
├───────────────────────────────────┼──────────────────────┤
│ Fleet Risk Tactical Map           │ Top Risk Session     │
├───────────────────────────────────┼──────────────────────┤
│ Critical Event Feed               │ Supplier Signals     │
└───────────────────────────────────┴──────────────────────┘

Left side:
Main operational overview.

Right side:
Sticky intelligence panel.

Goal:
Everything important visible within one screen.

1. REDESIGN KPI SECTION (MORE COMPACT)

Current KPI cards are too large and underutilized.

Replace large metric cards with a compact KPI grid.

Instead of large empty cards, use denser information.

Example:

1 Active Session
1 Critical Alert
2 Supplier Flags
$21K Loss Prevented

Requirements:

2×2 KPI grid
Smaller card height
Better spacing
Small trend indicators
More information density
Premium enterprise feel

Visual:
Subtle glow, brighter blue card headers, soft shadows.

2. REDUCE FLEET RISK MAP HEIGHT

Current map dominates too much vertical space.

Refine:

Reduce map height by 35–45%
Make it feel like a tactical overview map
Keep hover/click interaction
Preserve vessel risk markers
Keep severity color coding
Show hover tooltip

Tooltip example:

#16 Critical Session
MV Pacific Harmony
Risk: 78
Mismatch: 3.76%
Shortage: 18.8 MT

[Open Session]

The map should support overview, not dominate the screen.

3. MOVE AI VERDICT INTO A RIGHT-SIDE COMMAND PANEL

Current AI verdict banner is too wide and consumes too much vertical space.

Move it into a compact right-side intelligence card.

Example:

AI Verdict
⚠ REFUSE TO SIGN BDN

92% confidence

Signals:
• Quantity mismatch
• MFM drift detected
• Supplier historical pattern

[Open Critical Session]
[View Evidence Chain]

Requirements:

Compact
High readability
Minimal words
Strong visual hierarchy
Sticky panel
Enterprise intelligence system feel
Not chatbot-looking
Looks like a real operational recommendation engine
4. REBUILD “TOP RISK SESSION” CARD

Current card is too tall.

Refine into compact tactical intelligence card.

Content:

Top Risk Session
Session #16

MV Pacific Harmony
Supplier: MegaFuel Pte Ltd

Risk Score: 78 / 100
Critical

18.8 MT shortage
3.76% deviation

92% confidence

[Open Critical Session]

Requirements:

More compact
Better spacing
Scan-friendly
High visual hierarchy
Strong red emphasis only where necessary
5. CONVERT RECENT CRITICAL EVENTS INTO COMPACT ACTIVITY FEED

Current event cards are too tall.

Refine into a compact operational feed.

Example:

🔴 CRITICAL
Quantity mismatch
Session #16
12m ago →

🟠 HIGH
Supplier flagged
MegaFuel Pte Ltd
34m ago →

🔴 CRITICAL
MFM drift anomaly
1h ago →

Requirements:

Reduce height by ~50%
More scannable
More compact
Faster decision-making
Keep severity colors
6. ADD “SUPPLIER SIGNALS” PANEL

Add a compact intelligence card on the right side.

Example:

Supplier Signals

MegaFuel
38 Risk Score
3/6 sessions flagged

OceanFuel
58 Risk Score
Watchlist

Small but useful.

Purpose:
Surface risk patterns immediately.

VISUAL REFINEMENTS

Refine visual design to feel less generic and more premium.

Background
Darker maritime navy background
Slight vignette
More contrast
Subtle radial blue lighting
Cards
Slightly brighter blue than background
Soft glass feel
Premium enterprise SaaS quality
Better depth
Header

(search, time, officer profile)

Make slightly darker than content area for separation.

Typography
Reduce oversized text
Better spacing
More hierarchy
More scannable
Interactions

Add subtle premium animations:

Live pulse
Risk glow
Hover elevation
Smooth transitions

Avoid flashy cyberpunk effects.

IMPORTANT DESIGN PRINCIPLE

Dashboard = overview only

Do NOT overload with details.

Details belong in:

Live Session
Intelligence
Evidence Center

Dashboard should prioritize:

overview → prioritization → action

A BDN officer should immediately know:

“What’s wrong, how risky is it, and where should I click next?” within 5 seconds.

Make it feel like a real maritime fraud command center used in a port authority, not a generic AI dashboard.