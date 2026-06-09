# BunkerGuard AI - Premium Enterprise Design System

## Design Philosophy

**Premium Dark • Executive • Refined • Maritime Intelligence**

BunkerGuard AI is a premium enterprise-grade maritime AI platform that feels like:
- Linear × Stripe Dashboard × Bloomberg Terminal × Modern Maritime Operations Software

**Visual Direction:**
Premium dark fintech dashboard with refined luxury feeling, operational realism, and subtle sophistication.

---

## Color System

### Background Palette - Premium Navy
```css
--background: #07111F              /* Primary background */
--background-secondary: #0D1728    /* Secondary background */
--background-elevated: #121F35     /* Elevated surfaces */
--background-hover: #172742        /* Hover state */
```

### Surfaces - Soft Matte Dark
```css
--surface: #121F35                 /* Default surface */
--surface-secondary: #172742       /* Secondary surface */
--surface-elevated: #1A2D4A        /* Elevated surface */
```

### Text Hierarchy - Strong Contrast
```css
--foreground: #F8FAFC              /* Primary text */
--foreground-secondary: #CBD5E1    /* Secondary text */
--foreground-muted: #7E8BA3        /* Muted text */
```

### Primary Accent - Premium Cyan (ONE ONLY)
```css
--primary: #49B3FF                 /* Primary accent */
--primary-foreground: #07111F      /* Text on primary */
--primary-hover: #5BBFFF           /* Hover state */
```

**Rule:** NO purple gradients. ONE primary accent only.

### Semantic Colors
```css
--success: #22C55E                 /* Success state */
--warning: #F59E0B                 /* Warning state */
--critical: #EF4444                /* Critical state */
```

### Borders - Subtle Premium
```css
--border: rgba(255, 255, 255, 0.06)        /* Default border */
--border-strong: rgba(255, 255, 255, 0.1)  /* Strong border */
--border-accent: rgba(73, 179, 255, 0.2)   /* Accent border */
```

---

## Typography System

**Font Family:** Inter (Professional, Sharp, Modern)

### Hierarchy

| Element | Size | Weight | Line Height | Use Case |
|---------|------|--------|-------------|----------|
| **H1** | 36px (2.25rem) | Semi-bold (600) | 1.3 | Page titles |
| **H2** | 20px (1.25rem) | Semi-bold (600) | 1.4 | Section titles |
| **H3** | 15px (0.9375rem) | Medium (500) | 1.5 | Card titles |
| **H4** | 14px (0.875rem) | Medium (500) | 1.5 | Subheadings |
| **Body** | 14px (0.875rem) | Normal (400) | 1.6 | Body text |
| **Meta** | 12px (0.75rem) | Normal (400) | 1.4 | Meta info |
| **Critical KPI** | 48-56px (3-3.5rem) | Bold (700) | 1.2 | Large metrics |

### Typography Rules
- Use letter-spacing: `-0.02em` for large headings
- Use letter-spacing: `-0.01em` for section titles
- Use `tracking-tight` for headlines
- Use `tracking-wide` for uppercase labels
- Line height: 1.6 for body text (readability)

---

## Spacing System

**Large breathing room. Avoid cramped layouts.**

```css
--spacing-xs: 8px
--spacing-sm: 12px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-2xl: 48px
--spacing-3xl: 64px
```

### Application
- Component padding: `p-8` (32px)
- Section gaps: `gap-8` (32px)
- Large sections: `p-10` (40px)
- Dividers: `gap-10` (40px)

---

## Border Radius - Subtle Premium Corners

```css
--radius-sm: 8px        /* Small elements */
--radius-md: 12px       /* Buttons */
--radius-lg: 20px       /* Large surfaces */
--radius-xl: 24px       /* Hero sections */
--radius-pill: 999px    /* Pills/chips */
```

### Application
- Cards: `rounded-xl` (20px)
- Buttons: `rounded-xl` (12-14px)
- Pills: `rounded-full` (999px)
- Inputs: `rounded-xl` (12px)

---

## Shadows - Soft and Diffused

**NO heavy neon glow. NO obvious floating effects.**

```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15)
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2)
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.25)
```

### Shadow Usage
- Standard cards: `shadow-md`
- Hero sections: `shadow-lg`
- Elevated overlays: `shadow-lg`

---

## Card System

**Avoid glassmorphism spam. Use soft matte dark surfaces.**

### Premium Card Style
```css
background: #121F35 (--surface)
border: rgba(255, 255, 255, 0.06) (--border)
border-radius: 20px (rounded-xl)
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2)
padding: 32px (p-8)
```

### Card Rules
- NO card-inside-card-inside-card
- Use grouped surfaces with dividers instead
- Only create standalone cards when:
  - Interactive
  - Important
  - Independently actionable

---

## Button System

### Primary Button
```css
background: #49B3FF (--primary)
color: #07111F (--primary-foreground)
padding: 12px 20px (py-3 px-5)
border-radius: 12px (rounded-xl)
font-weight: 600 (font-semibold)
transition: all 200ms ease
```

**Hover:** Slightly brighter, subtle shadow

### Secondary Button
```css
background: #0D1728 (--background-secondary)
border: 1px solid rgba(255, 255, 255, 0.06)
color: #F8FAFC (--foreground)
```

**Hover:** `bg-surface-secondary`, `shadow-sm`

### Danger Button
```css
background: #EF4444 (--critical)
color: #F8FAFC
```

---

## Table Design

**Operational table feel - Bloomberg / Notion database style**

### Table Style
```css
/* Header */
background: rgba(18, 31, 53, 0.5) (--surface/50)
border-bottom: 1px solid var(--border)
text-transform: uppercase
font-size: 11px
font-weight: 600
letter-spacing: 0.05em

/* Row */
border-bottom: 1px solid var(--border)
hover:background: rgba(23, 39, 66, 0.3)
transition: background 200ms ease

/* Cell */
padding: 12px 24px (py-3 px-6)
```

### Table Rules
- Use row separators
- Soft hover states (NOT glowing)
- Compact but readable
- Clean operational feel

---

## Chart Design

**Technical, Clear, Trustworthy**

### Chart Style
```css
/* Grid */
stroke: rgba(56, 189, 248, 0.05)
stroke-dasharray: 3 3

/* Lines */
primary-line: #49B3FF
stroke-width: 2.5px

/* Labels */
font-size: 11px
color: #94A3B8 (--foreground-muted)
```

### Chart Rules
- Thin lines
- Minimal grid (subtle)
- NO overly decorative charts
- Clean signal visibility

---

## Glow Rules

**VERY IMPORTANT: Minimal glow usage**

### Allowed Glow
1. **LIVE indicators**
```css
box-shadow: 0 0 20px rgba(73, 179, 255, 0.4)
```

2. **Critical alert state**
```css
box-shadow: 0 0 20px rgba(239, 68, 68, 0.4)
```

3. **Active transfer animation** (3D visualization)

### NOT Allowed
- ❌ Heavy neon glow everywhere
- ❌ Glowing borders on all cards
- ❌ Gradient typography glow
- ❌ Excessive glow effects

---

## Icons

**Simple. Thin. Professional. Lucide-style line icons.**

```css
stroke-width: 1.5px (default)
stroke-width: 2px (active state)
```

### Rules
- NO futuristic icons
- Use thin line icons
- Professional aesthetic
- Consistent stroke width

---

## Layout System

### Grid
- Desktop-first: 1440-1600px
- Left sidebar: Fixed 256px
- Main content: Asymmetrical
- Reading flow: Left-aligned

### Alignment Rules
- **Left-aligned:** Everything by default
- **Center-aligned:** Only for:
  - Hero status
  - Large metrics
  - Empty states

**Avoid:** Everything centered

---

## Microinteractions

**Subtle only. 200-300ms smooth transitions.**

### Transitions
```css
transition: all 200ms ease         /* Standard */
transition: all 300ms ease         /* Smooth */
```

### Hover States
- Slight elevation
- Background change
- NO flashy animations

### Status Indicators
- Small pulse (2s cubic-bezier)
- Minimal glow

---

## 3D Visualization System

**For Live Bunkering Session View**

### Scene Composition
- Calm ocean environment
- Large receiving vessel
- Smaller bunker barge
- Pipeline connection

### Animation
- **Normal:** Subtle cyan fuel pulse
- **Critical:** Restrained red pulse
- **NOT** game-like

### HUD Overlays
```css
background: rgba(18, 31, 53, 0.95) (--surface/95)
backdrop-filter: blur(12px)
border: 1px solid var(--border)
border-radius: 12px (rounded-xl)
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3)
padding: 20px 24px (py-5 px-6)
```

**Style:** Minimal, clean, technical (Apple Pro + Maritime control room)

---

## Premium Checklist

✅ **DO:**
- Large breathing room spacing
- Soft matte dark surfaces
- ONE primary accent color
- Subtle shadows
- Strong typography hierarchy
- Left-aligned content
- Operational table design
- Clean charts
- Minimal glow (LIVE/Critical only)
- Premium rounded corners (20-24px)

❌ **AVOID:**
- Card overload
- Glassmorphism spam
- Purple gradients
- Excessive glow
- Too much neon
- Centered everything
- Cramped layouts
- Decorative UI
- Futuristic for sake of futuristic
- Generic AI startup look

---

## Brand Personality

**"Premium maritime intelligence platform trusted by major ports."**

NOT: "Cool AI startup"

**Feeling:**
- Premium
- Expensive
- Trustworthy
- Realistic
- High-end enterprise
- Minimal luxury
- Modern maritime intelligence system

---

## Component Examples

### Premium Card
```tsx
<div
  className="bg-surface border border-border rounded-xl p-8"
  style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)' }}
>
  {/* Content */}
</div>
```

### Premium Button
```tsx
<button className="px-5 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold transition-all duration-200 hover:shadow-sm">
  Action
</button>
```

### LIVE Indicator
```tsx
<div
  className="flex items-center gap-2.5 px-3.5 py-2 bg-success/10 border border-success/30 rounded-xl"
  style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)' }}
>
  <div
    className="w-2 h-2 rounded-full bg-success"
    style={{ boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }}
  />
  <span className="text-xs font-bold text-success tracking-wider">LIVE</span>
</div>
```

---

## Final Goal

**The UI should feel:**
- Premium
- Expensive
- Trustworthy
- Realistic
- High-end enterprise
- Hackathon-winning
- Less AI-generated
- Minimal luxury
- Modern maritime intelligence system

**Inspiration:**
Linear × Stripe × Bloomberg Terminal × Premium Maritime Operations Software
