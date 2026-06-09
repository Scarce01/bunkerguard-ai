Refine and redesign the entire Intelligence Module of BunkerGuard AI.

The goal is to make the page feel like an enterprise-grade AI maritime intelligence platform used by ports, regulators, bunker buyers, and compliance officers.

Current UI feels too dashboard-heavy and repetitive. Many sections display similar information in different formats. The redesign should focus on clarity, hierarchy, AI explainability, and decision-making support.

Design Direction

Maintain:

Dark navy maritime theme
Premium enterprise SaaS appearance
Bloomberg Terminal × Palantir × Datadog × SentinelOne inspiration
Clean, minimal, high-information-density layout
Blue remains primary accent color

Avoid:

Excessive tables
Repetitive cards
Generic dashboard appearance
Bright neon red
Large empty spaces
Information Architecture

The Intelligence module should answer 5 key questions:

1. What is happening?

Risk Overview

2. Why is it happening?

AI Findings

3. Who is responsible?

Supplier Intelligence

4. What is affected?

Fleet Impact Analysis

5. What evidence supports it?

Evidence Correlation

Every section must support one of these questions.

PAGE STRUCTURE
SECTION 1 — Intelligence Overview

Top KPI row.

4 cards only.

Active Risk Signals
Flagged Suppliers
Affected Sessions
Estimated Exposure

Refine cards:

softer shadows
subtle gradient background
animated counters
exposure uses muted salmon red instead of bright red

Recommended critical color:

#C86A6A

instead of bright warning red.

SECTION 2 — Supplier-Vessel Risk Network

This is the hero section.

Make it the visual centerpiece.

Increase height.

Add:

AI Generated Insights Panel

Place on top-right corner of network.

Floating glass panel.

Example:

AI detected recurring shortage behaviour across 3 MegaFuel deliveries.

Confidence: 94%

Estimated exposure:
$17,620

Affected sessions:
#16 #19 #20

Recommended action:
Independent survey required.

This section should immediately explain what the graph means.

Users should not have to interpret the network themselves.

SECTION 3 — AI Findings

Replace "AI-Detected Fleet Patterns".

Convert into an AI Findings Feed.

Each finding displayed as intelligence cards.

Example:

🚨 Supplier Risk Escalation

MegaFuel linked to repeated short delivery patterns.

Confidence: 94%

Affected sessions: #16 #19 #20

Estimated loss: $17,620

[Investigate]

⚠ MFM Drift Pattern

Repeated meter suppression signature detected.

Confidence: 87%

Evidence Rules: A07, A02

[Review Evidence]

Use severity colors:

Critical:
Muted coral red

High:
Amber

Medium:
Blue

Low:
Teal

SECTION 4 — Supplier Watchlist

Replace large supplier ranking table.

Make it cleaner.

Display only top 5 suppliers.

Columns:

Supplier
Trust Score
Risk
Exposure
Status

Use horizontal progress bars for trust score.

Use color-coded risk chips.

Keep table compact.

Reduce visual clutter.

SECTION 5 — AI Supplier Dossier

Most important drill-down section.

When clicking a supplier, expand a dossier.

Rename:

"WHY AI FLAGGED THIS SUPPLIER"

to

"AI Investigation Summary"

Display findings as investigation cards.

Example:

Pattern #1

Repeated Short Delivery

3 of last 6 deliveries flagged.

Confidence: 96%

Pattern #2

Trust Score Decline

Dropped 30 points within 6 months.

Confidence: 91%

Pattern #3

Dispute Frequency

Highest dispute rate among registered suppliers.

Confidence: 89%

Each pattern includes:

confidence score
severity indicator
evidence count

Make it feel like an AI analyst report.

SECTION 6 — Fleet Impact Analysis

Completely replace Fleet Alert and Fleet Broadcast sections.

Current design feels like notifications.

Instead show:

Affected Fleet

Affected vessels

MT Aurora

MT Neptune

MT Titan

Potential Exposure

$18,000

Risk Spread Analysis

Display vessel relationship map.

Supplier

↓

Affected Vessels

↓

Affected Deliveries

↓

Potential Future Risk

Show cascading impact.

This creates a logical transition from supplier risk to fleet consequences.

SECTION 7 — Historical Pattern Matching

Keep current Similar Historical Incidents section.

Enhance it.

Display:

Case #18
94% Match

Quantity Shortage

[View Evidence]

Case #14
88% Match

MFM Drift Pattern

[View Evidence]

Add small similarity visual indicator.

This helps explain how AI reached conclusions.

AI COPILOT

Add a floating AI Copilot button.

Placement:

Bottom-right corner.

Visible on all Intelligence pages.

Never overlap tables or content.

Button style:

Circular
64–72px
Floating
Elevated shadow
Subtle pulse animation

Icon:

3D AI analyst avatar

OR

3D robot assistant

OR

holographic maritime intelligence agent

Avoid generic chat icon.

Must feel premium and intelligent.

Clicking AI Copilot opens a side panel.

Suggested prompts:

Why is MegaFuel considered high risk?

Summarize all supplier anomalies.

Show evidence supporting this finding.

Which vessels are most affected?

Explain this network graph.

What action should I take?

Final Goal

The Intelligence module should feel less like:

"A dashboard with charts."

And more like:

"An AI maritime investigation and risk intelligence platform."

The user should immediately understand:

what happened
why AI flagged it
what evidence exists
who is affected
what action should be taken

without manually interpreting multiple charts or tables.