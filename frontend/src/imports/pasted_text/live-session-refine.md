# Figma Make Prompt — Refine Live Session Page (Fix Overlap, Improve Layout, Realism & UX)

Refine ONLY the **Live Session page** of BunkerGuard AI.

DO NOT redesign from scratch.

Keep the existing premium dark maritime intelligence aesthetic, typography, spacing style, and color system.

Goal:

Fix:

* UI overlap
* broken hierarchy
* duplicated visualization
* poor scrolling experience
* unrealistic single-vessel perception

Make the page feel like:

**A real maritime command center used by bunker officers for live fraud investigation.**

The layout should feel:

* operational
* structured
* premium
* enterprise-grade
* technically credible

NOT:

* cluttered dashboard
* cyberpunk UI
* game interface
* generic AI dashboard

---

# CORE LAYOUT STRUCTURE

Redesign the page hierarchy into this structure:

```txt
Header

Fleet Tactical View (compact)

Main Investigation Layout
| Left telemetry |
| Center investigation |
| Right AI panel |

Bottom expandable details
```

The page MUST vertically scroll.

No overlapping containers.

No clipped content.

All sections should remain fully accessible.

---

# 1. HEADER SECTION

Keep current top header.

Structure:

```txt
LIVE SESSION

#16 · MV PACIFIC HARMONY

MegaFuel Pte Ltd · Singapore Eastern Anchorage
```

Top-right:

Keep:

* live badge
* timestamp
* notification icon
* officer profile

Keep current style.

No redesign needed.

---

# 2. FLEET TACTICAL VIEW (MAJOR REFINEMENT)

## Current issue

Current tactical section overlaps.

Feels visually broken.

Map area is too large.

Duplicate visualizations exist.

## New layout

Place Tactical View directly below header.

Maximum height:

**220–260px only**

DO NOT make it tall.

Layout:

```txt
------------------------------------------------
Fleet Tactical View
------------------------------------------------

LEFT (30%)
Active Vessel List

CENTER (70%)
Anchorage Tactical Map

------------------------------------------------
```

NO overlap allowed.

---

## LEFT SIDE — ACTIVE VESSEL LIST

Fixed width:

280–320px.

Independent internal scroll.

Example:

```txt
Current Active Sessions

#16 MV Pacific Harmony
CRITICAL
MegaFuel
Risk: 78

#15 Quantum Star
MONITORING
OceanFuel
Risk: 62

#14 Atlantic Pride
NORMAL
PrimeBunker
Risk: 38
```

Visual:

Card list.

Each vessel card contains:

* session ID
* vessel name
* supplier
* risk score
* status badge

Selected session (#16):

Highlighted with stronger border glow.

Critical:

subtle muted red outline.

Normal:

cool blue.

Hover:

soft elevation.

Click:

updates detailed live investigation below.

DO NOT create a second page.

---

## CENTER — ANCHORAGE TACTICAL MAP

This is overview only.

NOT detailed vessel analysis.

Remove duplicated visualization.

DO NOT show same investigation visuals again.

Design:

Minimal semi-3D tactical maritime map.

Dark navy radar-style anchorage.

Think:

* military maritime operations map
* NATO vessel monitoring
* maritime intelligence center

Show:

multiple vessels positioned in anchorage.

Visual hierarchy:

Critical vessel:

soft muted crimson pulse.

Monitoring:

muted amber.

Normal:

cool steel blue.

Each vessel:

simple ship silhouette.

Hover tooltip:

```txt
MV Pacific Harmony

Supplier:
MegaFuel

Risk:
78

Deviation:
3.76%
```

Top-right small overlay:

```txt
Active sessions: 4
Critical: 1
Monitoring: 2
Normal: 1
```

Minimal only.

NO giant cards.

DO NOT make this feel like a game map.

Avoid:

* realistic 3D harbor
* cinematic water
* game graphics
* exaggerated animations

Use:

subtle movement only.

Very light pulse.

---

# 3. MAIN INVESTIGATION SECTION

Below Tactical View.

Main content area.

Structure:

```txt
| LEFT | CENTER | RIGHT |
```

No overlap.

Responsive layout.

Must fit within viewport.

---

## LEFT PANEL — TELEMETRY

Width:

22–25%.

Sticky position.

Scrollable only when needed.

Keep telemetry cards.

Improve spacing.

Sections:

GPS

Flow Rate

Temperature

Density

Pressure

MFM Delivered

BDN Target

Shortage

Transfer Progress

ETA

Visual:

Compact operational cards.

Less tall.

Avoid excessive spacing.

Status values:

Critical values:
muted red.

Normal:
blue-white.

Transfer progress:

thin animated line.

Do NOT make telemetry take excessive vertical space.

Goal:

Everything visible without huge scrolling.

---

## CENTER PANEL — LIVE INVESTIGATION CANVAS

Width:

50–55%.

This becomes the MAIN focus.

IMPORTANT:

REMOVE duplicated tactical visualization.

Current vessel visualization is repetitive.

Instead:

Create an investigation canvas.

Layout:

### TOP

Receiving Vessel card

Supply Vessel card

Side-by-side.

Example:

```txt
Receiving Vessel

MV Pacific Harmony
Delivered:
481.2 MT
```

```txt
Supply Vessel

MT Fuel Star 7
Declared:
500 MT
```

---

### CENTER

Primary anomaly visualization.

Large comparison panel.

Example:

```txt
Quantity Mismatch — Rule A02

MFM Delivered
481.2 MT

vs

BDN Declared
500 MT

Shortage
18.8 MT
```

Visual:

Horizontal comparison.

Animated discrepancy bar.

Subtle red gradient only.

Not overwhelming.

Small confidence badge:

92%.

---

### BELOW

Live operational status strip.

Example:

```txt
Transfer Progress: 96%

ETA Completion: 9 min

Active Alerts: 3

AI Recommendation:
Refuse BDN
```

Compact horizontal strip.

No huge cards.

Purpose:

Immediate operational clarity.

---

## RIGHT PANEL — AI INTELLIGENCE PANEL

Width:

22–25%.

Sticky panel.

Always visible while scrolling.

Do NOT make endlessly long.

Structure:

### Section 1 — AI Verdict

Large verdict.

Example:

```txt
REFUSE TO SIGN BDN

Confidence:
92%
```

Below:

### Why this recommendation

✓ Quantity shortage
18.8 MT (3.76%)

✓ Supplier history
3 of last 6 flagged

✓ MFM evidence verified

✓ MPA threshold exceeded

Primary CTA:

Generate Protest Letter

Secondary:

View Evidence

---

### Section 2 — Live Rule Trigger Feed

Limit visible cards:

Maximum 3.

Scrollable internally.

Example:

14:22
A01 Quantity trajectory deviation

14:31
A07 Meter stress anomaly

14:42
A02 Quantity mismatch detected

Design:

Looks like maritime SIEM feed.

Severity colors:

Critical:
muted red

High:
amber

Medium:
blue

Avoid neon.

Add:

"View Full Timeline →"

at bottom.

---

# 4. PAGE SCROLLING BEHAVIOR

IMPORTANT:

The ENTIRE page must vertically scroll.

No hidden content.

No clipped containers.

No overlapping sections.

Rules:

* Tactical vessel list scrolls independently
* Rule feed scrolls independently
* Whole page scrolls vertically

Bottom content MUST remain accessible.

No fixed-height clipping.

---

# 5. VISUAL CLEANUP

Fix all spacing inconsistencies.

Add breathing room between containers.

Increase padding consistency.

Reduce excessive dark empty space.

Remove duplicated visualization.

Maintain:

premium maritime intelligence aesthetic.

The final page should feel like:

**A realistic maritime live investigation center monitoring multiple bunkering operations while deeply investigating one suspicious vessel.**
