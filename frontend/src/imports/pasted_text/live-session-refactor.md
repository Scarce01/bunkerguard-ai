Audit and refine the Live Session page of BunkerGuard AI to achieve the look and usability of a real-world maritime intelligence platform used by port authorities, bunker surveyors, compliance investigators, and shipping operations centers.

Do NOT redesign the workflow.

Do NOT change the core functionality.

Focus on layout architecture, information hierarchy, operational usability, and investigation efficiency.

---

1. Make the Tactical Map the Primary Focus

---

The Tactical Transfer Visualization is the most important component of the page and should become the visual anchor.

Current issue:

* Session Explorer occupies too much width.
* The map feels compressed.
* Investigation space is limited.

Refactor layout:

Left Panel:
Session Explorer
Width: 280px

Center Panel:
Tactical Transfer Visualization
Width: 60–65%

Right Panel:
Investigation & AI Analysis
Width: 25–30%

The map should visually dominate the page.

Users should immediately understand:

Which vessel is being monitored
Which supplier is involved
Where the anomaly occurred
Whether the operation is safe or suspicious

Avoid equal-width layouts.

Avoid dashboard-grid layouts.

Use clear dominant zones.

---

2. Redesign Session Explorer

---

Replace the current active session cards with a professional Session Explorer.

Include:

Search Sessions

Filters:

* Risk Level
* Status
* Supplier
* Port
* Date Range

Session List

Each row should contain:

Session ID
Vessel Name
Supplier
Risk Badge
Short anomaly summary

Example:

#16 MV Pacific Harmony
MegaFuel
Critical
18.8 MT Shortage

Support:

Sort by:

* Risk Score
* Newest
* Oldest
* Supplier

Show:

10 of 126 Sessions

Add pagination or infinite scrolling.

Make the panel collapsible.

Collapsed width:
72px

Expanded width:
280px

---

3. Compress Telemetry Widgets

---

Current telemetry cards waste excessive vertical space.

Replace:

Flow Rate Card
Temperature Card
Density Card

With:

Telemetry Summary

Flow Rate      45.2 MT/h
Temperature    22.3°C
Density        991.2 kg/m³

Use a compact operational table style.

Maximum height:
80–100px

Goal:

Free vertical space for investigation content.

---

4. Expand Activity Feed Significantly

---

Current issue:

Activity Feed is too short and cannot display meaningful investigation history.

Activity Feed should become a major component of the page.

Move Session Details into the top session header.

Display:

Status
Started Time
Last Updated
Supplier
Location

inside the header instead.

Remove the Session Details panel from the right sidebar.

Use the freed space for Activity Feed.

Activity Feed should occupy all remaining vertical space.

Minimum height:
500–700px

Include:

Timestamp
Event Type
Severity
Description

Examples:

14:12 Transfer Started

14:18 Flow Rate Spike

14:23 Density Deviation

14:27 MFM Drift Detected

14:31 Quantity Mismatch

14:42 AI Verdict Issued

Users should be able to understand the entire investigation story without opening another page.

---

5. Add Investigation Timeline

---

Below the Tactical Visualization, introduce a horizontal Investigation Timeline.

Purpose:

Show how the anomaly developed over time.

Timeline events:

Transfer Started
Flow Spike
Sensor Alert
Density Deviation
Quantity Mismatch
AI Investigation
Final Verdict

Each event should show:

Time
Status
Investigation Stage

The timeline should visually connect evidence and AI conclusions.

Goal:

Improve explainability.

Make AI decisions feel traceable.

Avoid black-box AI behavior.

---

6. Improve Tactical Visualization

---

The map still feels empty.

Introduce:

AIS Vessel Trails

Animated Fuel Transfer Flow

Transfer Direction Indicators

Sensor Locations

Alert Radius Markers

Anomaly Zones

Evidence Markers

Examples:

MFM Sensor

Flow Meter

Survey Point

Supplier Barge

Anomaly Location

Add subtle operational motion:

Flow pulse animation

Transfer direction indicators

Live status indicators

Avoid decorative animations.

Every animation must communicate operational information.

---

7. Reduce AI Verdict Panel Height

---

Current AI Verdict panel is oversized.

Compress into:

AI Verdict

REFUSE TO SIGN BDN

92% Confidence

Reasons:

• 18.8 MT shortage
• Supplier flagged
• MFM verified
• Threshold exceeded

Actions:

[Generate Protest]
[View Evidence]

Use horizontal action buttons.

Reduce vertical footprint by at least 40%.

---

8. Improve Right-Side Investigation Workspace

---

Structure:

AI Verdict

Telemetry Summary

Activity Feed

Quick Actions

Evidence Access

The Activity Feed should be the largest component in the right panel.

Not AI Verdict.

Not Session Details.

Investigators spend more time reviewing events than reading the verdict.

Design accordingly.

---

9. Add Fleet-Level Context

---

Introduce a toggle:

Fleet View
Session View

Fleet View should display:

Active Sessions
Critical Sessions
Supplier Risk Distribution
Port Activity Heatmap
Top Risk Transfers

This provides operational context beyond a single transfer.

Makes the platform feel enterprise-grade.

---

10. Final Design Goal

---

The interface should feel like:

Palantir Gotham
Bloomberg Terminal
MarineTraffic
VesselFinder
Port Operations Monitoring Systems

Avoid:

Hackathon dashboards
AI startup demos
Crypto trading interfaces
Generic SaaS templates

Prioritize:

Operational clarity
Investigation efficiency
Information hierarchy
Evidence visibility
Decision support

The page should immediately communicate:

What is happening?
Why is it suspicious?
How serious is it?
What evidence supports it?
What action should the investigator take?
