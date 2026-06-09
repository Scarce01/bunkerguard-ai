# BunkerGuard UI Refinement — Detailed UI/UX Implementation Prompt

IMPORTANT:

Do NOT redesign the system from scratch.

Keep the current page structure and premium maritime intelligence aesthetic.

Goal:
Improve realism, technical credibility, explainability, and judge clarity WITHOUT overcrowding the UI.

The system should feel like:

**A real maritime fraud intelligence platform used by port authorities and bunker officers.**

NOT:

* generic AI dashboard
* cyberpunk UI
* game interface
* chatbot-first product

Keep the current visual style, but make the platform feel smarter and more operational.

---

# 1. LIVE SESSION — Add Fleet Tactical View

## Current problem

The Live Session page only shows one vessel.

This makes the platform feel less realistic and less scalable.

Judges may think:

> “Does this system only monitor one ship?”

## UI solution

### Add a new compact top section:

**Fleet Tactical View**

Placement:

At the very top of Live Session.

Above telemetry and vessel details.

Layout:

```txt
------------------------------------------------
Fleet Tactical View
------------------------------------------------

   🚢 #16 (Critical)
   🚢 #15 (Monitoring)
   🚢 #14 (Normal)

      Semi-3D Anchorage Map
------------------------------------------------
```

Visual direction:

NOT realistic Google Maps.

Instead:

A **dark tactical anchorage map**.

Think:

* maritime command center
* radar map
* military operations map
* Palantir maritime view

### Vessel presentation

Show multiple vessels.

Each ship represented by:

* simple semi-3D ship silhouette
* subtle glow
* risk color ring

Color hierarchy:

Critical:
Muted crimson pulse

Monitoring:
Muted amber

Normal:
Steel blue

Completed:
Gray-blue

### Hover interaction

Hover ship:

Show mini tooltip card.

Example:

```txt
MV Pacific Harmony

Supplier:
MegaFuel

Risk:
78 / Critical

Deviation:
3.76%
```

### Click interaction

Click vessel:

Switches the detailed live session below.

Example:

User clicks Session #16.

Below tactical view:

Current Selected Session:
MV Pacific Harmony

All telemetry updates.

Purpose:

Users understand:

> the system monitors many vessels simultaneously, but officers investigate one deeply.

---

# 2. LIVE SESSION — Add Rule Trigger Timeline

## Current problem

Your anomaly engine is technically strong but visually invisible.

Judge cannot see:

> “What exactly triggered the AI?”

## UI solution

Placement:

Right-side panel.

Below AI recommendation.

New card:

### Live Rule Engine

Layout:

Scrollable vertical timeline.

Example:

```txt
Live Rule Trigger Feed

14:22
A01
Quantity trajectory deviation

+10.2% projected shortage

-------------------

14:31
A07
Meter stress anomaly

Drive gain exceeded threshold

-------------------

14:42
A02
CRITICAL
Quantity mismatch

18.8 MT short
```

UI style:

Looks like:

SIEM / cybersecurity event log.

Each item contains:

* rule ID
* timestamp
* short explanation
* severity badge

Color system:

Critical:
Muted red

High:
Amber

Medium:
Steel blue

Low:
Muted teal

DO NOT use neon.

Purpose:

Shows technical intelligence depth.

Makes the AI feel trustworthy.

---

# 3. RISK SCORE EXPLAINABILITY

## Current problem

AI gives score 78.

But users do not know WHY.

Feels slightly black-box.

## UI solution

Placement:

Top Risk Session card

OR

AI Recommendation panel.

Add expandable section:

### Risk Breakdown

Example:

```txt
Risk Score: 78/100

Contribution

Quantity mismatch
██████████ +40

Supplier history
██████ +18

Real-time deviation
████ +12

Document issue
██ +8
```

Visual direction:

Compact stacked bar chart.

Not too large.

Use:

Muted blue bars.

Critical factor:

slightly muted red.

At bottom:

```txt
Recommendation threshold exceeded.
```

Purpose:

Judge instantly understands:

> “Ah, this is explainable AI.”

---

# 4. AI RECOMMENDATION CARD — More Trustworthy

## Current problem

Verdict exists.

But WHY users should trust AI is unclear.

Feels slightly generic.

## UI solution

Placement:

Keep existing recommendation card.

Refine content hierarchy.

Example:

```txt
REFUSE TO SIGN BDN

Confidence
94%

Why this recommendation:

✓ Quantity shortfall:
18.8 MT (3.76%)

✓ Supplier history:
3 of last 6 sessions flagged

✓ MFM evidence verified

✓ MPA threshold exceeded

Recommended Action:
Issue protest letter.
```

Layout:

Large verdict at top.

Middle:

Why section.

Bottom:

CTA buttons.

Primary CTA:
Generate Protest Letter

Secondary:
View Evidence

Purpose:

Trustworthy recommendation.

Not chatbot-like.

Feels enterprise-grade.

---

# 5. DASHBOARD — Add Fleet Intelligence Broadcast

## Current problem

Dashboard still slightly feels like isolated cards.

Missing system-wide intelligence.

## UI solution

Placement:

Directly below page title.

Above KPI cards.

Thin horizontal strip.

Height:

~56px

Example:

```txt
Fleet Intelligence Alert

MegaFuel supplier pattern detected.

2 vessels moved to enhanced monitoring.

Session #19
Session #20

View Intelligence →
```

UI style:

Very compact.

Dark navy.

Muted amber accent.

Minimal animation:

soft pulse only.

Purpose:

Makes system feel proactive.

Shows fleet-wide intelligence.

---

# 6. DASHBOARD — Add Technical Story Visibility

## Current problem

Judges may not understand:

> how BunkerGuard works.

## UI solution

DO NOT add giant card.

Placement:

Small collapsible section.

Below KPI row.

Label:

### How BunkerGuard Works

Collapsed state:

```txt
MFM + BDN + AIS
→ AI Detection
→ Evidence
→ Blockchain
```

Expandable state:

```txt
1. Data Ingestion
MFM + BDN + AIS

↓

2. Rule Engine
Anomaly Detection

↓

3. Risk Scoring

↓

4. AI Copilot

↓

5. Evidence Report

↓

6. Blockchain Verification

↓

7. Supplier Reputation Update
```

Visual:

Horizontal animated flow.

Minimal.

Professional.

NOT infographic style.

Purpose:

Judge immediately understands:

> “this is technically sophisticated.”

---

# 7. SUPPLIER INTELLIGENCE — Add Pattern Detection

## Current problem

Supplier page currently feels slightly shallow.

## UI solution

Upgrade supplier card.

Example:

```txt
MegaFuel Pte Ltd

Risk Score:
38

Pattern Detected

3 of last 6 sessions flagged

Average discrepancy:
1.5%

Estimated fleet loss:
USD 23,166

Trend:
Worsening

Recommendation:
Independent surveyor required
```

Add:

Mini trend sparkline.

Purpose:

Feels predictive.

Shows intelligence layer.

---

# 8. EVIDENCE TRUST / CHAIN OF CUSTODY

## Current problem

Blockchain exists.

But trust chain not obvious.

Judge may ask:

> “How do we know data not manipulated?”

## UI solution

Placement:

Evidence Center.

New card:

### Evidence Provenance

Vertical trust flow.

Example:

```txt
MFM Sensor
✓ Verified

AIS Position
✓ Verified

Rule Engine
✓ Triggered

AI Analysis
✓ Generated

Evidence Package
✓ Signed

Blockchain
✓ Immutable
```

Visual:

Timeline style.

Connected nodes.

Subtle verified glow.

Purpose:

Makes evidence legally trustworthy.

Feels forensic.

---

IMPORTANT FINAL RULE:

Do NOT overcrowd dashboard.

Keep dashboard:

overview-first.

Deep technical details belong in:

* Live Session
* Intelligence
* Evidence Center

Dashboard only answers:

What is happening?
How risky is it?
What should I do next?
