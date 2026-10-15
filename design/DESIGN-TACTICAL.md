---
name: Tactical Slate & Luminous Gold
colors:
  surface: '#0d141d'
  surface-dim: '#0d141d'
  surface-bright: '#333a44'
  surface-container-lowest: '#080f18'
  surface-container-low: '#151c26'
  surface-container: '#19202a'
  surface-container-high: '#232a35'
  surface-container-highest: '#2e3540'
  on-surface: '#dce3f1'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#dce3f1'
  inverse-on-surface: '#2a313b'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffbcb7'
  on-tertiary: '#68000a'
  tertiary-container: '#ff938c'
  on-tertiary-container: '#8d0012'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#0d141d'
  on-background: '#dce3f1'
  surface-variant: '#2e3540'
  surface-base: '#0b0f15'
  surface-canvas: '#0f141c'
  surface-card: '#161d27'
  surface-elevated: '#1e2634'
  surface-recessed: '#0a0e14'
  gold-dim: '#b45309'
  gold-bright: '#fbbf24'
  gold-glow: rgba(245, 158, 11, 0.18)
  border-tactical: '#283446'
  border-subtle: rgba(255, 255, 255, 0.06)
  status-operational: '#10b981'
  status-repair: '#f59e0b'
  status-emergency: '#ef4444'
  status-standby: '#64748b'
  sync-cyan: '#06b6d4'
  sync-cyan-glow: rgba(6, 182, 212, 0.2)
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.04em
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is engineered for mission-critical enterprise maintenance, industrial machinery tracking, and hardware telemetry. Designed as a Progressive Web Application (PWA) operating in harsh field conditions (underground mines, refinery floors, and processing mills), the interface communicates absolute resilience, tactical authority, and precision.

The aesthetic fuses **Tactical Dark Minimalism** with **Subtle Dark Neumorphism** and **Technical Glassmorphism**. UI elements are molded directly from the charcoal-slate carbon substrate. Recessed inputs evoke physical control switchboards, while subtle top-lit highlights give floating panels tactile presence. Luminous amber/gold accents provide critical visual telemetry without causing night-vision eye strain, complemented by electric cyan/blue indicators for connectivity and data sync states.

Primary audiences include reliability engineers, maintenance planners, plant operations supervisors, and field technicians requiring instant legibility, dense diagnostic dashboards, and rapid offline execution.

## Colors

The palette operates in strict dark mode, anchored by deep slate carbons. 

- **Primary (`#f59e0b` / Amber Gold)**: Applied strictly to primary interactive commitments, active tabs, critical notifications, and identity marks.
- **Secondary (`#06b6d4` / Industrial Cyan)**: Designates digital operational states, real-time wireless transmission (`Syncing with Nexus`, `Optical Scanner`), and active telemetry streams.
- **Tertiary (`#ef4444` / Crimson Alert)**: Reserved exclusively for `Emergency - Production stopped`, destructive actions, and hard lockouts.
- **Neutral Palette (`#0b0f15` to `#1e2634`)**: Forms the four-tier architectural surface model. `surface-base` anchors the background canvas, `surface-card` establishes module planes, `surface-elevated` provides modal prominence, and `surface-recessed` defines indented inputs and sensor well containers.

## Typography

Typography bridges clean ergonomic legibility with industrial instrumentation. 

- **Primary UI Text (Inter)**: Handles general interaction, navigation labels, and narrative instructions with high x-height clarity.
- **Instrumentation & Meta (JetBrains Mono)**: Handles all telemetry readouts, running hours (`HM (Running Hrs)`), priority badges (`Priority Alpha`), encryption status tags, and machine serial keys. Monospace styling reinforces technical authenticity and eliminates tabular alignment jitter during dynamic data refresh.
- Text transformed to uppercase (`label-mono-sm`, `label-mono-md`) must always include deliberate letter spacing (`0.08em` to `0.1em`) to maintain legibility on field tablets.

## Layout & Spacing

The layout is built upon an ultra-dense, 12-column adaptive fluid grid for desktop and tablet control stations, collapsing into an ergonomic single-column vertical stack with a docked thumb-zone action bar on mobile PWA viewports.

- **Rhythm**: All paddings and gutters adhere to a strict 4px/8px modular base. Compact data modules maximize vertical information density while preventing mis-taps via generous target envelopes (minimum 44px touch height).
- **Responsive Adaptations**:
  - **Mobile (< 768px)**: 16px margins, single-column workflow blocks, persistent floating bottom command dock for rapid WO creation.
  - **Tablet (768px - 1024px)**: 2-column card arrays with fixed telemetry sidebars.
  - **Desktop (> 1024px)**: 12-column matrix with multi-pane inspection inspectors and sticky diagnostic graphs.

## Elevation & Depth

Visual depth is achieved through molded slate neumorphism supported by refined specular borders:

1. **Recessed Wells (`surface-recessed`)**: Form input fields, search consoles, and photo drop-targets use inner shadows to visually sink into the chassis:
   - `box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.6), inset -1px -1px 3px rgba(255, 255, 255, 0.04)`
2. **Tactile Extrusions (`surface-card`)**: Modular panels, KPI cards, and buttons use dual directional soft shadows to push forward from the background:
   - `box-shadow: 12px 16px 28px rgba(0, 0, 0, 0.5), -4px -4px 14px rgba(255, 255, 255, 0.03)`
3. **Specular Rim Lighting**: All containers feature a 1px border with a subtle top-lit gradient (`rgba(255, 255, 255, 0.08)` to `transparent`) that mimics machined chamfered metal edges.
4. **Active Luminous Glows**: Crucial action items, online sync indicators, and high-priority alarms emit an outer blur (`0 0 16px rgba(245, 158, 11, 0.25)` or `0 0 16px rgba(6, 182, 212, 0.3)`) to command instant visual priority.

## Shapes

The shape system employs disciplined, rounded corners (`0.5rem` / `8px` default, scaling to `1rem` / `16px` on elevated cards and modals) that soften high-density data grids while preserving tactical structure. 

Form input wells and interactive pills use smooth contours that balance industrial machine aesthetics with high-grade handheld device interaction. Critical action buttons use uniform radii matching their host container's nested ratio (`card_radius - card_padding`).

## Components

### Buttons
- **Primary Action (Initialize / Commit)**: Tactile extruded surface with amber gradient rim, uppercase `label-mono-md` typography in `#fbbf24`, subtle gold glow on hover/active. Pressed state triggers an inset neumorphic depression (`box-shadow: inset 1px 1px 3px rgba(0,0,0,0.8)`).
- **Secondary / Ghost**: Dark slate pill or rounded slab with `border: 1px solid var(--border-tactical)` and light slate-gray text.
- **Destructive (`Reject WO`, `Abort`)**: Dark slate with a deep red hairline border (`#ef4444`) and crimson status dot.

### Inputs & Selectors
- **Tactile Recessed Fields**: Deep charcoal container (`#0a0e14`) with dual inner shadow. Text rendered in high-contrast crisp white, labels positioned above in uppercase monospace muted slate (`#64748b`). Focused state activates a sharp 1px amber or cyan outline with soft outer halo.

### Telemetry & Asset Cards
- **Structural Layout**: Dark slate plate (`#161d27`) with 1px top-lit chamfer border. Top header contains the Asset Node ID, machine type, and status indicator tag. Body features dual-column metrics (Running Hours vs Breakdown Risk) set in monospaced tabular numerals.

### Status Badges & Priority Chips
- Compact pill-shaped containers with high-contrast indicator dots.
  - `Priority Alpha`: `#ef4444` dot with crimson-tinted translucent background (`rgba(239, 68, 68, 0.12)`).
  - `Operational`: `#10b981` dot with emerald aura.
  - `In Sync`: `#06b6d4` pulse dot.

### System Banners (Offline / PWA Sync)
- Full-width, high-visibility tactile banner pinned directly below the global status bar. Features a high-contrast amber/yellow crosshatch or cyan sync pulse indicating `__OFFLINE - Changes will sync when online`.