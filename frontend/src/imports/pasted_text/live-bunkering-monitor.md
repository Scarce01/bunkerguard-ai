Design an enterprise-grade, premium maritime “Live Bunkering Monitor” dashboard for a marine fuel bunkering intelligence system.

The UI must feel highly professional, futuristic, realistic, and operational — similar to a real port command center, vessel monitoring system, Bloomberg terminal, Palantir, Tesla operations UI, or a modern maritime control room.

DO NOT make it look like a concept poster, infographic, gaming UI, or Dribbble-only design. It should feel deployable for real industrial use.

Goal:
Monitor real-time fuel transfer between bunker vessel and receiving vessel, detect quantity mismatch, anomalies, fraud risk, and operational status during bunkering operations.

-----------------------------------
LAYOUT & UX HIERARCHY
-----------------------------------

The dashboard should prioritize a realistic LIVE MAP VIEW as the center of attention.

The map should occupy around 60–70% of the screen.

The interface should have clear visual hierarchy:

1. Primary focus:
Live transfer visualization on map

2. Secondary focus:
Critical alerts / anomaly detection

3. Supporting information:
Operational KPIs, vessel metadata, GPS, environmental data, timestamps

Avoid too many separated containers/cards.
Reduce excessive spacing.
Create a more immersive and connected visual system.

The layout should feel fluid and spatially connected rather than many floating dashboard boxes.

-----------------------------------
VISUAL STYLE
-----------------------------------

Theme:
Premium maritime intelligence dashboard

Mood:
Professional, futuristic, dark luxury, industrial-tech

NOT:
cyberpunk neon overload
game HUD
cheap glowing UI
overly sci-fi

Use subtle depth, premium gradients, atmospheric glow.

Color palette:

Primary:
Deep navy (#061B35)
Ocean blue (#0A2A52)
Dark marine blue (#0F335C)

Accent:
Electric blue (#3EA8FF)
Cyan glow (#69D4FF)

Alert:
Soft premium red (#FF5D5D)
Warning amber (#FFB347)

Glassmorphism:
Very subtle only.
No heavy frosted glass.

Cards:
Semi-transparent dark surfaces with soft border glow.

Shadows:
Soft ambient shadow.

Rounded corners:
16–28px modern radius.

-----------------------------------
CENTERPIECE — LIVE MAP
-----------------------------------

The center MUST use a realistic satellite/nautical map.

Use:
Mapbox / deck.gl / Cesium style map

Location:
Singapore Port / bunkering zone

Map should include:

- realistic ocean texture
- port area
- anchorage zone
- vessel movement path
- geospatial depth

NO flat fake illustration map.

Map layers:

1. Vessel markers
Receiving vessel:
MV Pacific Harmony

Supply vessel:
MT Fuel Star 7

2. Live route path
Animated transfer line connecting vessels

3. Dynamic bunkering zone
Soft animated circular radius

4. Heat/risk overlay
Suspicious transfer zones

5. Real GPS coordinates

6. Wind/current overlay (optional subtle)

-----------------------------------
ANIMATED LIVE TRANSFER
-----------------------------------

Add realistic micro animations:

Fuel transfer animation:
Animated particles flowing through transfer line between vessels.

Connection line:
Soft pulse animation.

Live signal:
Moving dots showing active data transmission.

Radar pulse:
Subtle expanding ring around active vessels.

Alert state:
When anomaly occurs:
soft red pulse
NOT aggressive blinking

Map camera:
Very subtle floating/parallax effect.

Numbers:
Smooth counting animation.

Status:
Animated LIVE indicator.

Data refresh:
Tiny transition motion.

Loading states:
Skeleton shimmer.

-----------------------------------
TOP BAR
-----------------------------------

Modern compact top navigation.

Contains:

Left:
Title:
Live Bunkering Monitor

Subtitle:
Real-time maritime fuel transfer intelligence

Center:
Search vessel / voyage

Right:
Current operation status:
● LIVE

Timestamp:
Last synced: 10 sec ago

Theme toggle

User profile:
BDN Officer

-----------------------------------
REAL-TIME KPI STRIP
-----------------------------------

Compact horizontal KPI strip.

Not oversized cards.

Include:

Flow Rate
120.9 MT/hr

Delivered
481.2 MT

Target
500 MT

ETA Remaining
00:13:42

Fuel Type
VLSFO

Transfer Pressure
12.4 PSI

Tank Temperature
44°C

Environmental Risk
Low

Cards should feel premium and integrated.

-----------------------------------
ALERT EXPERIENCE
-----------------------------------

When anomaly detected:

DO NOT use giant red warning box.

Instead:
Create premium alert center.

Small but highly noticeable.

Example:

⚠ Quantity Mismatch Detected

Expected:
500 MT

Measured:
481.2 MT

Variance:
-18.8 MT

Confidence:
93%

Severity:
High

Potential causes:
meter discrepancy
leakage
intentional fraud

Action buttons:
Investigate
Generate Report
Escalate

Animation:
soft red breathing glow.

-----------------------------------
VESSEL PANELS
-----------------------------------

On both sides of map.

Receiving vessel panel:
MV Pacific Harmony

Supply vessel panel:
MT Fuel Star 7

Each panel includes:

- vessel icon or silhouette
- IMO number
- fuel transfer status
- GPS
- speed
- heading
- fuel source tank
- operational status

Use compact premium cards.

-----------------------------------
RIGHT SIDEBAR
-----------------------------------

Collapsible intelligence sidebar.

Sections:

Anomaly Detection

Fuel Variance Timeline

Sensor Health

Historical Transfer Pattern

AI Fraud Risk Score

Compliance Status

Recent Events Timeline

-----------------------------------
CHARTS
-----------------------------------

Minimal but premium.

Use:

- area charts
- thin line charts
- animated trend lines

Avoid:
too many pie charts
overdecorated charts

Charts needed:

Flow Rate Over Time

Fuel Delivered Trend

Pressure Stability

Sensor Confidence Score

-----------------------------------
UX DETAILS
-----------------------------------

The interface must feel:

calm
trustworthy
high-end
efficient
minimal cognitive load

Avoid clutter.

Avoid giant empty spaces.

Avoid “dashboard full of boxes”.

Everything should feel aligned and connected through visual rhythm.

The map should dominate the interface.

Animations should feel subtle and premium.

Think:
Bloomberg + Tesla + Maritime Control Center + Palantir.

Build this as a polished, production-ready responsive dashboard UI.