REFINE THE EVIDENCE CENTER PAGE.

IMPORTANT:
Keep the existing BunkerGuard AI design system unchanged:

* Dark maritime command-center aesthetic
* Deep navy background
* Cyan/blue accent colors
* Same typography, spacing scale, card styling, glow intensity, border radius, and visual language
* Maintain enterprise-grade cybersecurity / maritime intelligence feel

GOAL:
Reduce information overload and create a clear investigation narrative for hackathon judges.

The current page feels too dense, contains too many competing sections, and lacks a clear storytelling flow.

The page should communicate:

1. AI detected an anomaly
2. AI explains why
3. AI provides supporting evidence
4. AI recommends action

The user should understand the entire case within 5 seconds.

---

## PAGE STRUCTURE

Convert Evidence Center into a 3-tab workflow:

Tab 1:
INVESTIGATION

Tab 2:
EVIDENCE

Tab 3:
PROTEST REPORT

These tabs should be visually prominent and feel like a step-by-step investigation workflow.

==================================================
TAB 1 — INVESTIGATION
=====================

This becomes the primary demo page.

Remove:

* Investigation Queue
* Timeline
* Sensor Validation Summary
* Large Blockchain section
* Excessive verification panels
* Repetitive AI cards

Replace with a single narrative layout.

---

SECTION A
AI INVESTIGATION SUMMARY
------------------------

Hero card at top.

Large visual emphasis.

Layout:

[AI Verdict]

REFUSE BDN

AI Confidence: 92%

Risk Level: Critical

3 Key Findings:

• 18.8 MT shortage detected
• MFM and BDN mismatch confirmed
• Supplier flagged in 3 of 6 recent sessions

This card should become the visual focal point of the page.

Avoid red glowing warning-box style.

Use premium intelligence-dashboard styling instead.

Think:
Bloomberg Terminal
Palantir
Anduril
Datadog Security

NOT ChatGPT warning card.

---

SECTION B
WHY AI FLAGGED THIS
-------------------

Show only the most important evidence.

Use comparison cards.

Example:

MFM Recorded
481.2 MT

BDN Declared
500.0 MT

Discrepancy
18.8 MT
(3.76%)

Rule Triggered
A02

Supplier History
Previous disputes detected

Historical Match
94%

Make this section extremely easy to understand.

No paragraphs.

No legal text.

No clutter.

---

SECTION C
SIMILAR INCIDENTS
-----------------

Show only 3 previous incidents.

Example:

#18
Quantity Shortage
94% Match

#14
Quantity Shortage
88% Match

#21
Supplier Dispute
71% Match

Compact cards.

Allow judges to instantly understand that AI found historical precedent.

==================================================
TAB 2 — EVIDENCE
================

This page contains proof.

No AI reasoning.

No conclusions.

Only evidence.

---

SECTION A
EVIDENCE PACKAGE
----------------

Display as verification cards:

✓ MFM Data Stream

✓ BDN Document

✓ AIS Vessel Data

✓ Fuel Sample Records

---

SECTION B
CHAIN OF CUSTODY
----------------

Replace large blockchain section.

Show compact verification list:

Verified
Signed
Timestamped
Immutable
Blockchain Anchored

Use clean enterprise-style status rows.

---

SECTION C
BLOCKCHAIN VERIFICATION
-----------------------

Compact summary card only.

Polygon PoS

Block #4,892,341

128 Confirmations

Transaction Hash

No large blockchain panels.

No unnecessary details.

==================================================
TAB 3 — PROTEST REPORT
======================

Final action page.

---

## LEFT COLUMN

Generated Letter of Protest

Large readable document preview.

---

## RIGHT COLUMN

Compliance Actions

✓ Protest Issued

✓ MPA Notification

✓ Surveyor Requested

□ P&I Pending

Show progress state.

This should feel like:
"AI completed investigation and generated action."

==================================================
PORT COPILOT
============

Current floating button feels distracting.

Replace floating bottom-right widget.

Move to header.

Top-right actions:

Export Report
Generate Protest
Ask Copilot

When clicked:

Open a right-side drawer.

Microsoft Copilot style.

Width:
380-420px

The drawer should answer:

"Why was this flagged?"

"Summarize evidence"

"Show similar incidents"

"Generate executive summary"

Do NOT keep a persistent floating chat bubble.

==================================================
INFORMATION DENSITY
===================

Reduce content volume by approximately 40%.

Every section must answer one question only:

Investigation:
What happened?

Evidence:
Can we prove it?

Action:
What should we do?

If a component does not support one of these questions, remove it.

Prioritize clarity over completeness.

Design for a 5-minute hackathon demo rather than a production enterprise platform.
