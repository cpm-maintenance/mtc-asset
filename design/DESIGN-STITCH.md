# Design System Document: The Industrial Monolith

## 1. Overview & Creative North Star
**Creative North Star: "The Subterranean Command"**

This design system rejects the "web-app-as-a-website" mentality. It is built as a high-performance digital tool—a piece of heavy machinery itself. We are moving away from flat, "friendly" interfaces toward **Organic Brutalism**. 

The aesthetic is inspired by the raw power of mining equipment and the high-contrast environments of subterranean shafts. We break the template look by utilizing **hard-edged geometry (0px border radius)**, intentional **asymmetry**, and **tonal layering** that feels carved out of the rock. It is unapologetic, authoritative, and built for the high-stakes environment of gold extraction where precision and visibility are non-negotiable.

---

## 2. Colors
Our palette is rooted in the earth, illuminated by the prize.

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** To section content, we rely on background color shifts. A `surface-container-low` component sitting on a `surface` background creates a clear boundary through value, not lines. This creates a more sophisticated, "machined" look.

### Surface Hierarchy & Nesting
Treat the UI as a series of tectonic plates. 
- **The Base:** Use `surface` (#131313) for the deepest background.
- **The Workhorse:** Use `surface-container-low` (#1C1B1B) for large content areas.
- **The Precision Plate:** Use `surface-container-high` (#2A2A2A) for elevated utility panels.
- **Nesting:** To highlight a specific data point within a card, use `surface-container-lowest` (#0E0E0E) to create a "recessed" well, making the data feel etched into the interface.

### The "Glass & Gradient" Rule
To prevent the dark theme from feeling stagnant, use **Glassmorphism** for floating overlays (e.g., global navigation or modals). Use `surface` at 80% opacity with a `40px` backdrop blur. 
**Signature Texture:** For primary actions, use a linear gradient transitioning from `primary_container` (#FFD700) to `primary_fixed_dim` (#E9C400) at a 45-degree angle. This mimics the luster of raw gold and provides a premium feel that flat hex codes lack.

---

## 3. Typography
We utilize a dual-font strategy to balance industrial utility with technical precision.

- **Display & Headlines (Space Grotesk):** This typeface offers a technical, wide-set architecture that feels engineered. Use `display-lg` (3.5rem) for critical equipment status or high-level gold yield metrics.
- **Body & Labels (Inter):** Chosen for its exceptional legibility at small sizes and high-contrast environments. 
- **Brand Identity through Hierarchy:** Large, bold headlines in `on_surface` contrast sharply with `label-md` in `on_surface_variant` (#D0C6AB). This hierarchy ensures that a worker glance-checking a tablet under harsh lighting can immediately distinguish between "Equipment ID" and its current "Operating Temperature."

---

## 4. Elevation & Depth
In a world without borders, depth is communicated through light and shadow, mimicking a headlamp hitting a rock face.

- **The Layering Principle:** Depth is achieved by "stacking" the surface-container tiers. Never use a shadow to separate two flat surfaces. Instead, place a `surface-container-highest` card on top of `surface-container-low`.
- **Ambient Shadows:** For floating elements (like a "Stop Engine" confirmation), use a hyper-diffused shadow: `box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5)`. To add "soul," tint the shadow with a hint of `primary_fixed_dim` at 4% opacity to simulate the glow of gold-lit indicators.
- **The "Ghost Border" Fallback:** If a boundary is visually necessary for accessibility (e.g., input fields), use a "Ghost Border": the `outline_variant` (#4D4732) at **20% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons (The "Gloved-Touch" Standard)
All interactive elements must be a minimum of **64px in height**.
- **Primary:** Gradient-filled (Gold), `0px` radius, black text (`on_primary`). High-impact.
- **Secondary:** `surface-container-highest` background with a `primary` label. No border.
- **Tertiary:** Ghost style. No background, `on_surface` text, 20% opacity `outline` only on active state.

### Input Fields
Avoid "boxes." Use a "Recessed Well" approach.
- **Style:** Background `surface-container-lowest` (#0E0E0E), with a heavy 4px bottom-accent in `outline` when focused. Labels should always be persistent `label-sm` above the field to ensure context is never lost.

### Cards & Lists
**Strict Rule: No Dividers.**
- Use `24px` of vertical whitespace to separate list items.
- Alternately, use a "Zebra" layout with alternating `surface-container-low` and `surface-container-lowest` backgrounds to define rows without "slicing" the UI with lines.

### Status Indicators (High-Contrast Industrial)
Status isn't just a color; it's a block. For "Critical Error," use the `error_container` (#93000A) as a full-bleed background for the component, not just a small icon. This ensures the operator sees the warning regardless of glare.

---

## 6. Do's and Don'ts

### Do
- **Do** use `0px` border radius on everything. Soft corners have no place in a gold mine.
- **Do** lean into extreme "Tonal Depth." Use the darkest darks (#0E0E0E) to make the gold highlights truly "shimmer."
- **Do** prioritize asymmetric layouts. Align critical data to the left and secondary meta-data to the extreme right to create a wide, cinematic focal path.

### Don't
- **Don't** use pure white (#FFFFFF). Use `primary` (#FFF6DF) or `on_surface` (#E5E2E1) to reduce eye strain in dark environments.
- **Don't** use 1px dividers. If you feel the need for a line, use a `12px` gap of "empty" `surface` background instead.
- **Don't** use thin font weights. Nothing under `Medium` weight (500) should be used for body text; visibility is the priority.