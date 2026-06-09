# Figma Make Prompt — Refine Evidence Center into Investigation Workspace

Refine ONLY the **Evidence Center page** of BunkerGuard AI.

Do NOT redesign the whole app.

Keep the current premium dark maritime intelligence aesthetic, sidebar, top header, card style, typography, and color system.

## Main Problem

The current Evidence Center feels like it is hardcoded for only **one session / one supplier**.

It looks like:

“Session #16 Evidence Page”

instead of:

“A scalable Evidence Management Center where officers can select and investigate different suspicious bunkering cases.”

## Main Goal

Transform Evidence Center into a realistic:

**Investigation Workspace**

The page should support:

1. Selecting different investigation cases
2. Viewing selected case evidence
3. Understanding evidence timeline
4. Checking AI investigation summary
5. Verifying chain of custody
6. Generating protest letter based on selected case

The user should understand:

> Evidence Center is case-based, but officers can switch between multiple investigations.

---

# 1. Overall Page Structure

Use this layout:

```txt
Page Header
↓
Active Investigation Banner
↓
Main Investigation Workspace
  ├── Left: Investigation Queue
  ├── Center: Evidence Timeline / Selected Evidence
  └── Right: Case Summary + Verification Panels
↓
Protest & Report tab
```

The page must be vertically scrollable.

No clipped content.

No overlapping containers.

---

# 2. Page Header

Keep current page header:

**Evidence Center**

Subtitle:

**Evidence · Compliance · Verification**

Keep top-right buttons:

* Export Report
* Generate Protest Letter

But make them context-aware based on selected investigation.

Example:
If Session #16 selected, buttons apply to Session #16 only.

---

# 3. Add Active Investigation Banner

Placement:

Directly below tabs or below page title.

Height:

70–90px.

Purpose:

Clearly show which case is currently being investigated.

Content example:

```txt
Currently Investigating

Session #16 · MV Pacific Harmony

Supplier: MegaFuel Pte Ltd
Port: Singapore Eastern Anchorage
Risk: 78 / Critical
Status: Evidence Verified
```

Right side buttons:

```txt
Switch Investigation
Open Live Session
```

Visual style:

* Dark navy card
* Thin muted red left border for critical case
* Small risk badge
* Clear session context

This fixes the issue where the page feels like only one hardcoded session exists.

---

# 4. Main Investigation Workspace Layout

Below Active Investigation Banner, use 3-column layout.

```txt
---------------------------------------------------------
| Investigation Queue | Evidence Timeline | Case Panels |
| 24%                 | 50%               | 26%         |
---------------------------------------------------------
```

Maintain good spacing.

All columns should align at the top.

---

# 5. Left Column — Investigation Queue

Add a new left-side panel:

**Investigation Queue**

Purpose:

Show multiple suspicious cases that can be selected.

This makes the Evidence Center scalable.

Content example:

```txt
Investigation Queue

#16 MV Pacific Harmony
Supplier: MegaFuel
Critical
18.8 MT shortage
Status: Evidence Verified

#19 Harbor Crest
Supplier: MegaFuel
High
6.2 MT shortage
Status: Evidence Collecting

#20 Meridian Star
Supplier: MegaFuel
High
5.8 MT shortage
Status: Pending Review

#22 Northern Tide
Supplier: SinoMarine
Medium
AIS anomaly
Status: Under Review
```

Each case card should include:

* session ID
* vessel name
* supplier
* severity badge
* short issue summary
* status

Selected case:

* stronger border
* slightly brighter background
* subtle glow
* not too red

Interaction:

Click case card → update center timeline, right summary, and protest letter content.

Add filters at top:

```txt
All Cases
Critical
Pending
Verified
```

Add small search:

```txt
Search session / vessel / supplier
```

Keep this panel scrollable independently.

---

# 6. Center Column — Evidence Timeline

Keep the existing Evidence Timeline, but make it the main center content.

Title:

**Evidence Timeline**

Subtitle:

**Chronological reconstruction of selected investigation**

Each timeline item should show:

* timestamp
* evidence type
* verification status
* source count
* confidence %
* short summary
* “Why flagged” expandable row

Example:

```txt
11:45
BDN Received
Verified · 1 Source · 100%
BDN declares 500.0 MT HFO 380 CST

Why flagged →
```

```txt
11:47
MFM Anomaly Detected
Verified · 2 Sources · 92%
MFM recorded 481.2 MT, shortage 18.8 MT

Why flagged →
```

```txt
12:33
Supplier Pattern Matched
Verified · 6 Sources · 87%
MegaFuel: 3 of 6 sessions flagged

Why flagged →
```

```txt
12:35
Blockchain Committed
Immutable · 1 Source · 100%
Evidence package sealed on blockchain
```

Interaction:

Click any timeline item.

When clicked, open a compact detail drawer or detail card inside the center column:

**Selected Evidence Detail**

Example:

```txt
Selected Evidence: MFM Anomaly Detected

Source:
Mass Flow Meter

Finding:
481.2 MT recorded vs 500 MT declared

Deviation:
3.76%

Rule Triggered:
A02 Quantity Mismatch

Confidence:
92%

Supporting Evidence:
MFM stream hash
AIS position
BDN document
```

This makes the page feel like real investigation software.

---

# 7. Right Column — Case Summary + Verification Panels

The right column should contain stacked cards.

## Card 1 — Case Summary

```txt
Case Summary

Session:
#16

Vessel:
MV Pacific Harmony

Supplier:
MegaFuel Pte Ltd

Shortage:
18.8 MT

Deviation:
3.76%

Verdict:
Under Review

Recommended Action:
Refuse BDN + Issue Protest Letter
```

## Card 2 — AI Investigation Summary

Keep current AI summary, but make it cleaner.

Example:

```txt
AI Investigation Summary

Systematic MFM suppression pattern

Reasons:
- Quantity mismatch exceeds MPA threshold
- Supplier flagged in 3 of 6 recent sessions
- MFM drift signature matched Rule A07
- Evidence chain remains intact
```

## Card 3 — Evidence Provenance

Keep the chain-of-custody idea.

Show vertical verified chain:

```txt
MFM Sensor
Verified

AIS Position
Verified

Rule Engine
Triggered

AI Analysis
Generated

Evidence Package
Signed

Blockchain
Immutable
```

## Card 4 — Fuel Samples Retained

Show sample custody:

```txt
SMP-16-A
Vessel Retain

SMP-16-B
Supplier Copy

SMP-16-C
MPA Register

SMP-16-D
Lab Analysis
```

Right column should be sticky on desktop.

If content is long, it should scroll internally but not overlap.

---

# 8. Protest & Report Tab Refinement

The Protest & Report tab should also depend on selected investigation.

Add a small header at top of the letter:

```txt
Generated for:
Session #16 · MV Pacific Harmony · MegaFuel Pte Ltd

Auto-generated from verified evidence package
Last updated: 14:32 SGT
```

Add a dropdown or case selector near the top:

```txt
Selected Investigation: #16 MV Pacific Harmony
```

If user switches case, letter content updates.

Keep current protest letter structure, but make it feel less hardcoded.

Right column should include:

### Compliance Checklist

Checklist tied to selected investigation:

```txt
BDN shortfall documented
MFM stream hash committed
Fuel samples retained
Letter of Protest issued within 4h
MPA BunkerNet notification
Independent surveyor engaged
```

### Blockchain Reference

Show:

```txt
Block
Network
Tx Hash
Confirmations
Immutable recorded
```

### Export Options

```txt
Export as PDF
Full Evidence Report
Blockchain Certificate
```

---

# 9. UX / Interaction Requirements

Important:

* Users can switch investigation cases from the queue
* Selected case updates all evidence content
* Evidence Center should not feel hardcoded to Session #16
* Evidence is case-based, but the system supports multiple cases
* Keep the selected case clearly visible at all times
* No UI overlap
* Page must scroll properly
* Right side panels should not block the timeline
* Keep visual hierarchy clean

---

# 10. Visual Style

Keep:

* enterprise maritime dark mode
* deep navy backgrounds
* subtle blue gradients
* clean cards
* muted severity colors

Avoid:

* too much red
* excessive glow
* cyberpunk effects
* game-like visuals
* AI chatbot feel

Use red only for actual critical evidence or legal urgency.

Use amber for pending review.

Use green/teal for verified evidence.

Use blue for neutral system information.

---

# Final Outcome

The Evidence Center should feel like:

A real investigation workspace where port officers can manage multiple suspicious bunkering cases, inspect evidence, verify chain of custody, and generate legal protest reports.

It should answer:

1. Which case am I investigating?
2. Can I switch to another case?
3. What evidence supports the finding?
4. Is the evidence verified?
5. Is the evidence legally defensible?
6. What action should I take next?
