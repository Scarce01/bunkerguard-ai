# Figma Make Prompt — Refine Intelligence Page into Fleet-Wide Intelligence Center

Refine ONLY the **Intelligence Page** of BunkerGuard AI.

Do NOT redesign the whole app.

Keep the current premium dark maritime intelligence aesthetic, sidebar, top header, typography direction, and overall card style.

## Main Problem

The current Intelligence page feels like it is only focused on **one supplier**, almost like a supplier profile page.

This feels less realistic because a port authority / bunker officer should monitor **many suppliers, many vessels, and many sessions** at the fleet level.

## Main Goal

Transform the Intelligence page from:

**Single Supplier Profile**

into:

**Fleet-Wide Maritime Risk Intelligence Center**

The page should show:

1. Overall fleet risk status
2. Supplier-vessel risk network
3. AI-detected risk patterns across multiple suppliers
4. High-risk supplier ranking
5. Fleet-wide intelligence alerts
6. Supplier detail only as drill-down drawer/modal, not the main page

The user should understand:

> The system monitors the whole bunkering ecosystem first, then drills down into suspicious suppliers when needed.

---

# 1. Page Header

Keep the page title:

**Intelligence**

Subtitle:

**Fleet-wide supplier and vessel risk analysis**

Keep tabs:

* Supplier Intelligence
* Fleet Intelligence

But refine their meaning:

### Supplier Intelligence

Shows supplier ranking, supplier risk patterns, and supplier drill-down.

### Fleet Intelligence

Shows fleet-wide network, affected sessions, and broadcast alerts.

Do not make either tab look like only one supplier profile.

---

# 2. Top KPI Row

Keep the top KPI row, but make it fleet-wide.

Use 4 compact KPI cards:

```txt
Active Risk Signals
4

Flagged Suppliers
3

Affected Sessions
8

Estimated Exposure
$18K
```

Design:

* Same card style as current UI
* Strong numbers
* Small description
* Less red usage
* Use muted maritime colors

Color rules:

* Red only for critical
* Amber for warning
* Blue for neutral
* Teal for healthy

Do not make all numbers red.

---

# 3. Supplier–Vessel Risk Network

Keep the existing network graph because it is good, but make it look more realistic and scalable.

## Layout

Place this as the main hero section below KPI cards.

Full-width large card.

Title:

**Supplier–Vessel Risk Network**

Subtitle:

**AI correlates supplier behaviour across active and historical bunkering sessions**

## Graph content

Show at least:

### Suppliers

* MegaFuel
* OceanFuel
* PrimeBunker
* Global Marine
* SinoMarine

### Vessels / Sessions

* #16 Pacific Harmony
* #15 Atlantic Pride
* #14 Quantum Star
* #13 Southern Cross
* #19 Harbor Crest
* #20 Meridian Star
* #21 Ocean Pearl
* #22 Northern Tide

## Visual logic

Left side:
Supplier nodes

Right side:
Vessel/session nodes

Edges:
Show connection between suppliers and vessels.

Edge thickness:
represents risk intensity.

Edge color:

* muted crimson = critical
* muted amber = high
* steel blue = moderate
* teal = low

Add small legend top-right.

## Interaction

Hover supplier node:
Show tooltip:

```txt
MegaFuel Pte Ltd
Risk Score: 58
3 of 6 sessions flagged
Avg discrepancy: 2.16%
```

Hover vessel node:
Show tooltip:

```txt
Session #16
MV Pacific Harmony
Supplier: MegaFuel
Risk: 78
Deviation: 3.76%
```

Click supplier:
Open right-side supplier intelligence drawer.

Click vessel/session:
Navigate to Live Session or Session Detail.

---

# 4. AI-Detected Fleet Patterns Section

Add a new section below the network graph.

Title:

**AI-Detected Fleet Patterns**

Layout:
3 cards in a horizontal row.

Each card should feel like an intelligence finding, not a generic notification.

## Card 1 — Critical Supplier Pattern

```txt
Supplier Risk Escalation

MegaFuel Pte Ltd

3 of last 6 sessions show >1% short delivery

Estimated loss:
$17,620

Affected sessions:
#16, #19, #20

Recommendation:
Independent survey required

[Investigate]
```

## Card 2 — Meter Suppression Pattern

```txt
Meter Suppression Signal

Repeated MFM drift pattern detected across related deliveries

Confidence:
87%

Rules triggered:
A07, A02

[Review Evidence]
```

## Card 3 — Fleet Monitoring Upgrade

```txt
Enhanced Monitoring Activated

2 active vessels moved to enhanced monitoring

Reason:
Supplier anomaly correlation detected

Affected:
#19, #20

[View Sessions]
```

Visual style:

* Muted colors
* No neon glow
* Critical card can have subtle red left border
* High card can have amber left border
* Monitoring card can use blue

Do not make all cards red.

---

# 5. High-Risk Supplier Ranking Table

Add a sortable supplier overview table below AI patterns.

Title:

**High-Risk Supplier Ranking**

Subtitle:

**Compare suppliers by reputation, discrepancy rate, and flagged sessions**

Columns:

```txt
Supplier
Reputation Score
Flagged Sessions
Avg Discrepancy
Estimated Exposure
Risk Level
Recommended Action
```

Example rows:

```txt
MegaFuel Pte Ltd | 38 | 3/6 | 2.16% | $17,620 | Critical | Independent survey
OceanFuel Trading | 72 | 1/8 | 0.82% | $4,900 | Watchlist | Monitor
PrimeBunker | 91 | 0/12 | 0.18% | $0 | Low | Normal
Global Marine Fuels | 92 | 0/15 | 0.12% | $0 | Low | Continue
SinoMarine | 65 | 2/9 | 1.08% | $6,300 | Medium | Enhanced monitoring
```

Interactions:

* Sort by risk score
* Sort by flagged sessions
* Click supplier row opens supplier drawer
* Search supplier

Design:

* Compact enterprise table
* Clear but not too tall
* Sticky table header if scrolling
* Risk levels shown as small badges

---

# 6. Fleet Signal Feed

Add a compact intelligence feed.

Placement:
Right side column OR below supplier table.

Title:

**Live Fleet Signals**

Example feed:

```txt
16:05
MegaFuel supplier pattern detected

16:08
Session #19 moved to enhanced monitoring

16:12
MFM drift signature matched previous incidents

16:18
Independent survey recommended for future MegaFuel deliveries

16:24
Global Marine cleared after 15 low-risk deliveries
```

Design:

* Timeline style
* Compact
* Small timestamps
* Severity icon
* Not too colorful

Purpose:
Make the system feel alive and constantly monitoring.

---

# 7. Supplier Intelligence Drawer

Do NOT show a full supplier profile directly on the page.

Instead, create a slide-in drawer when user clicks a supplier.

Drawer placement:
Right side.

Width:
30–35% of screen.

Title example:

**MegaFuel Intelligence**

Content:

```txt
Reputation Score
38 / 100

Status
Flagged

Pattern Summary
3 of 6 sessions flagged

Average Discrepancy
2.16%

Estimated Exposure
$17,620

Trend
Declining

Top Risk Sessions
#16 Pacific Harmony
#19 Harbor Crest
#20 Meridian Star

Recommended Action
Independent survey required for future MegaFuel deliveries
```

Include:

* mini trend chart
* session list
* action buttons

Buttons:

* View Sessions
* View Evidence
* Require Independent Survey

Drawer should be closable.

This makes the page scalable and realistic.

---

# 8. Remove / Reduce Single-Supplier Feel

Remove the current layout where the whole page focuses on one supplier by default.

Do not show only MegaFuel profile as the main content.

MegaFuel can be highlighted as the current highest-risk supplier, but the page must still show multiple suppliers and fleet-wide intelligence.

The page should not feel like:

“MegaFuel profile page.”

It should feel like:

“Fleet-wide intelligence system that detected MegaFuel as one of several risk signals.”

---

# 9. Visual Style Rules

Keep:

* dark maritime navy background
* premium enterprise cards
* subtle blue gradients
* sharp hierarchy
* muted alert colors

Avoid:

* too much red
* excessive glow
* cyberpunk UI
* overly flashy animations
* game-like graphics

Make it feel like:

* Palantir-style intelligence system
* Bloomberg terminal
* maritime risk operations center
* port authority monitoring platform

---

# Final Outcome

After refinement, the Intelligence page should answer:

1. Which suppliers are risky?
2. Which vessels/sessions are affected?
3. What patterns did the system detect?
4. What action should officers take?
5. Can users drill down into one supplier if needed?

The page should feel scalable, realistic, and enterprise-grade.
