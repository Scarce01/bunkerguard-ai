Refine the **BunkerGuard AI – Evidence Center** page into a **high-priority maritime investigation control center**.

Current issue:
The layout feels visually messy, unfocused, overly long, and lacks clear hierarchy. Typography hierarchy is weak, cards compete for attention, and the page feels like documentation instead of a real investigation dashboard.

Goal:

Transform the page into a:

**high-stakes bunker fraud investigation workspace**

used by:

* BDN officers
* maritime compliance teams
* bunker dispute investigators

The UI should instantly answer:

**“Should this BDN be accepted or refused?”**

The page must feel:

* focused
* operational
* decision-driven
* high urgency
* enterprise-grade

NOT:
a long report page.

NOT:
a random collection of cards.

NOT:
a static presentation UI.

---

# 1. COMPLETE LAYOUT RESTRUCTURE (MOST IMPORTANT)

Current issue:

Everything feels horizontally stretched and lacks visual priority.

Refactor page into a **clear 3-level hierarchy**.

---

## LEVEL 1 — INVESTIGATION SUMMARY BAR (TOP PRIORITY)

Compress current “Currently Investigating” section.

Current height is too large.

Reduce height by **40–50%**.

Convert into a compact intelligence strip.

Layout:

---

Session #19 — MV Harbor Crest [HIGH]
MegaFuel Pte Ltd • Singapore Anchorage

Risk Score: 72
Deviation: 3.76%
Shortage: 18.8 MT
Status: Evidence Collecting

## [ Open Live Session ]

Make:

### Session ID huge

Example:

**#19**

large and dominant.

### Vessel name secondary

MV Harbor Crest

smaller than session id.

### Risk score color coded

Critical = red

High = amber

Moderate = blue

Low = green

Most important visual emphasis:

* Session number
* Risk score
* Recommended action

---

## ADD DECISION STATUS PANEL (VERY IMPORTANT)

Right side of top strip:

Large priority box.

Example:

---

RECOMMENDED ACTION

❌ REFUSE BDN

Confidence: 92%

Reason:
MFM suppression pattern
Quantity mismatch
Supplier anomaly detected
-------------------------

Make this highly visible.

This becomes the page hero.

Officer must instantly understand the recommendation.

---

# 2. FIX TYPOGRAPHY HIERARCHY

Current issue:

Everything looks same importance.

Typography lacks contrast.

Refactor font scale.

Use hierarchy:

### Level 1

Page title

Evidence Center

48–56px

bold

---

### Level 2

Session title

Session #19

34–40px

bold

---

### Level 3

Major evidence events

AI Anomaly Detected

Supplier Pattern Matched

Blockchain Committed

24–28px

semibold

---

### Level 4

Descriptions and metadata

14–16px

muted

---

### Level 5

technical hashes / IDs

12–13px

monospace

low emphasis

Current UI overuses same font sizing.

Increase visual contrast significantly.

---

# 3. TIMELINE MUST BECOME COMPACT + SMARTER

Current problem:

Timeline dominates too much space.

Feels exhausting.

Too tall.

Too much dead space.

### Refactor timeline cards

Reduce height by **35–45%**

Make evidence cards denser.

Current:

huge empty boxes

New:

compact investigation feed.

Example:

---

AI Anomaly Detected

3.76% deviation detected

Evidence:
MFM mismatch

Confidence:
92%

Triggered:
A02 • A07

## [ Expand Evidence ]

Collapsed by default.

Only expand when clicked.

Use accordion behavior.

Officer should not scroll endlessly.

---

### Timeline visual priority

Only highlight:

critical events.

Example:

🔴 AI anomaly detected

🟠 Supplier pattern matched

🟢 Blockchain committed

Low priority events:
minimized.

---

# 4. REMOVE “WHY FLAGGED” EMPTY BOXES

Current UI issue:

These giant empty boxes look broken.

Feels unfinished.

Replace with:

### Expandable evidence drawer

Default:

Show 1-line reason.

Example:

Reason:
3.76% discrepancy exceeds threshold

[ View full evidence → ]

When clicked:

expand:

sensor logs

AIS records

MFM comparison

rule triggers

hash verification

This reduces clutter massively.

---

# 5. RIGHT SIDEBAR NEEDS PRIORITY REORDERING

Current sidebar feels random.

Reorganize by importance.

### Order:

1. Decision Summary (MOST IMPORTANT)

Hero card.

Large.

Shows:

Accept / Refuse BDN

confidence

reasoning

---

2. Quantity Comparison

Compact visual.

Keep progress bars.

Make shorter.

---

3. AI Investigation Summary

Convert into:

“Key Findings”

short bullets only.

Example:

Key Findings

• Quantity mismatch exceeds threshold

• Supplier flagged in 3 of 6 sessions

• MFM drift signature matched Rule A07

• Evidence chain verified

No long paragraphs.

---

4. Evidence Provenance

Keep compact.

Timeline style.

---

5. Fuel Samples Retained

Move lower.

Least priority.

---

# 6. PROTEST TAB NEEDS COMPLETE REWORK

Current issue:

Looks like a giant text document.

No visual focus.

Feels boring and overwhelming.

This should feel like:

**“AI-generated legal action center”**

---

### New layout:

LEFT (70%)

AI-generated protest letter

RIGHT (30%)

Action center

---

### Protest letter redesign

Put inside professional legal viewer.

Looks like document preview.

Readable.

Not giant monospace block.

Add sections:

Summary

Evidence Basis

Regulatory Basis

Actions Taken

Formal Letter

Typography:

clean

legal-document feel

not developer terminal feel.

---

### Add AI Summary ABOVE LETTER

Example:

AI Protest Summary

Reason:
3.76% shortage detected

Confidence:
92%

Regulations triggered:
MPA §14.2
MARPOL Annex VI

Recommendation:
Issue protest letter within 4 hours

This gives immediate understanding.

---

# 7. ADD “KEY EVIDENCE SNAPSHOT”

Very important.

Before timeline.

Add compact evidence row.

Example:

---

KEY EVIDENCE

MFM:
481.2 MT

Declared:
500.0 MT

Deviation:
3.76%

Supplier Risk:
38/100

Previous Cases:
3 flagged sessions

Blockchain:
Verified
--------

This becomes quick-glance evidence.

No scrolling needed.

---

# 8. REDUCE SCROLLING

First screen should show:

* session summary
* recommendation
* key evidence snapshot
* top critical timeline events

Officer should understand case in:

**under 5 seconds**

without scrolling.

---

# 9. BETTER VISUAL FOCUS

Current page:
too flat.

Need stronger emphasis.

Use:

brightest contrast only for:

* risk level
* recommendation
* deviation %
* shortage amount
* critical alerts

Everything else muted.

Current UI over-highlights too many things.

Create stronger visual hierarchy.

Target feel:

**Palantir Gotham × Bloomberg Terminal × Maritime SOC dashboard**

NOT:
documentation website

NOT:
random enterprise admin panel

NOT:
UI showcase

The page should feel like:

**“A real bunker dispute investigation workspace handling millions in maritime fuel fraud risk.”**
