Refine the existing BunkerGuard AI Live Session page.

Do NOT redesign the workflow.

Do NOT change the information architecture significantly.

Keep the current 3-column structure:

Session Explorer
Tactical Transfer Visualization
Investigation Workspace

Focus on improving layout efficiency, spacing, hierarchy, and operational usability.

---

1. Remove Wasted Space Above Search Sessions

---

Current issue:

There is a large empty area above the "Search Sessions" field that only contains a collapse button.

This creates unnecessary vertical waste and makes the Session Explorer feel disconnected.

Refactor:

Remove the dedicated collapse-button row.

Move the collapse action into the Session Explorer header.

Example:

Session Explorer                                  ←

or

Sessions                                           ⟨

The collapse control should be integrated naturally into the section title.

Result:

* Reduce unnecessary empty space
* Increase usable vertical area
* Allow more session records to be visible

---

2. Improve Session Explorer Density

---

Increase visible sessions without making the panel crowded.

Reduce excessive vertical padding between:

Search
Filters
Sort By
Session List

Maintain breathing room but improve information density.

Goal:

Show more active sessions without scrolling.

The panel should feel like an operational monitoring queue rather than a dashboard sidebar.

---

3. Improve Metric Row Spacing

---

Current metrics:

Transfer
ETA
Shortage
Alerts

feel visually compressed.

Refactor:

Increase horizontal spacing between each metric group.

Use equal-width columns.

Minimum gap:

32px–40px

Improve label-to-value spacing.

Example:

Transfer
97%

ETA
5 min

Shortage
12.2 MT

Alerts
4

The metrics should feel balanced and readable.

Avoid the appearance of a compressed dashboard widget row.

---

4. Redesign Investigation Timeline

---

Current timeline feels disconnected from the investigation workflow.

It resembles a generic dashboard timeline.

Replace it with a more operational Investigation Journey.

Instead of:

●────●────●────●────●

Use:

Transfer Started
↓
Flow Spike
↓
Density Deviation
↓
MFM Drift
↓
Quantity Mismatch
↓
AI Verdict

Or use horizontally connected event chips.

Example:

[Transfer Started]
[Flow Spike]
[Density Alert]
[MFM Drift]
[Mismatch]
[AI Verdict]

Each stage should show:

Time
Event
Status

The active stage should stand out.

The journey should visually explain how the AI arrived at its verdict.

Goal:

Make investigation reasoning more transparent.

Make the AI decision process feel traceable.

---

5. Increase Tactical Visualization Dominance

---

The map is the primary operational component.

Increase visual importance.

Reduce unnecessary empty framing around the map.

Allow the tactical visualization to occupy more vertical space.

Target:

Map = 70% of center workspace height.

Users should immediately understand:

Which vessel is transferring fuel

Which supplier is involved

Where the anomaly occurred

What evidence triggered the alert

---

6. Enrich Tactical Visualization

---

The visualization still feels sparse.

Introduce operational elements:

AIS Vessel Trails

Fuel Transfer Direction Indicators

Animated Transfer Flow

Sensor Markers

MFM Sensor

Flow Meter

Density Sensor

Alert Radius

Evidence Marker

Anomaly Zone

Use subtle operational animations only.

Avoid decorative motion.

Everything should communicate real monitoring information.

---

7. Reduce Telemetry Footprint

---

Current telemetry section consumes valuable vertical space.

Compress into a concise operational summary.

Example:

Flow Rate        41.5 MT/h
Temperature      23.7°C
Density          992.1 kg/m³

Reduce vertical height.

Use the saved space to expand the Activity Feed.

---

8. Make Activity Feed the Largest Investigation Component

---

The Activity Feed is currently too short.

Increase height significantly.

The feed should become the primary investigation tool.

Allow investigators to review the full chain of events without excessive scrolling.

Display:

Timestamp

Severity

Event Type

Description

Examples:

14:12 Transfer Started

14:18 Flow Rate Spike

14:23 Density Deviation

14:27 MFM Drift

14:31 Quantity Mismatch

14:42 AI Verdict Issued

The feed should feel like an incident log used by a real operations center.

---

9. Improve Visual Hierarchy

---

Current hierarchy is still slightly flat.

Create stronger distinction between:

Primary Information

Tactical Visualization

AI Verdict

Active Anomaly

Secondary Information

Metrics

Telemetry

Activity Feed

Supporting Information

Metadata

Session Details

Filters

Users should immediately know where to look first.

Avoid equal visual weight across all components.

---

10. Final Design Goal

---

The interface should feel like:

Palantir Gotham

Bloomberg Terminal

MarineTraffic

Port Operations Monitoring Systems

Vessel Intelligence Platforms

Avoid:

Hackathon dashboards

Generic SaaS layouts

Crypto dashboards

AI startup demos

Prioritize:

Operational clarity

Investigation efficiency

Evidence visibility

Information hierarchy

Professional maritime intelligence workflows

The final result should feel like software used daily by bunker inspectors, compliance investigators, maritime authorities, and shipping operations centers.
