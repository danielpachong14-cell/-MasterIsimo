# Design System Specification: Kinetic Architect

## 1. Overview & Creative North Star
**The Creative North Star: "Precision in Motion"**

This design system transcends the typical "logistics dashboard" by adopting the persona of the **Kinetic Architect**. In a world of heavy machinery and global supply chains, the interface must feel like a high-precision instrument—industrial in its strength, yet editorial in its clarity. 

We break the "standard SaaS" look by rejecting rigid, boxed-in layouts in favor of **Bento-style modularity** and **Tonal Depth**. The goal is to move away from a "flat web page" and toward a "digital cockpit" where high-density data feels breathable, intentional, and authoritative. We prioritize high-contrast functional areas over decorative lines, using deliberate asymmetry in the sidebar and content spacing to guide the eye toward critical operational metrics.

---

## 2. Color & Surface Architecture
We move beyond hex codes into a hierarchy of functional roles. The palette is anchored by the deep, authoritative Purple (`primary`) and supported by a sophisticated range of Blue-Grey neutrals.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background creates a natural, modern boundary that is cleaner than a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tokens to create "nested" depth:
- **Base Layer:** `surface` (#f9f9ff) – The primary canvas.
- **Sectioning:** `surface-container-low` (#f0f3ff) – Use for secondary sidebars or background groupings.
- **Content Cards:** `surface-container-lowest` (#ffffff) – Reserved for the highest level of interaction, popping against the slightly tinted background.
- **Active States:** `surface-container-highest` (#d8e3fb) – To indicate selected or high-priority focus areas.

### The "Glass & Gradient" Rule
To inject "soul" into industrial tech:
- **Glassmorphism:** Use for floating notifications or mobile navigation overlays. Apply `surface` at 80% opacity with a `20px` backdrop-blur.
- **Kinetic Gradients:** Hero CTAs and primary status cards should utilize a subtle linear gradient: `primary` (#381368) to `primary_container` (#4f2d7f) at a 135-degree angle. This adds a sense of "motion" even in static elements.

---

## 3. Typography: The Editorial Scale
We use **Inter** for its mathematical precision and neutral "Industrial" tone. The hierarchy is designed to make dense logistics data readable at a glance.

- **Display (Large/Medium/Small):** Used for massive KPIs (e.g., "Total Shipments"). Set with `tight` letter-spacing (-0.02em) to mimic high-end architectural journals.
- **Headline (Large/Medium):** Use for page titles. These should feel authoritative.
- **Title (Small/Medium):** Use for card headers. 
- **Body (Medium):** The workhorse for all data tables and descriptions.
- **Label (Small):** Use for technical metadata, always in `uppercase` with +0.05em tracking for a "blueprint" aesthetic.

**Typography Pairing:** Always pair a `headline-lg` with a `label-sm` metadata tag immediately above it to create an "Editorial Stack" that guides the user's eye through the data hierarchy.

---

## 4. Elevation & Depth
In this system, depth is a functional tool, not a decoration.

- **The Layering Principle:** Achieve elevation by stacking tiers. Place a `surface-container-lowest` card on a `surface-container-low` section. The contrast in luminance creates a soft, natural lift.
- **Ambient Shadows:** Only use shadows for "Floating" elements (Modals, Tooltips). 
  - **Spec:** `0px 12px 32px rgba(17, 28, 45, 0.08)`. The shadow color is derived from `on_surface` to keep it integrated into the environment.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` (#ccc3d2) at **20% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons: The Kinetic Action
- **Primary:** Gradient fill (`primary` to `primary_container`). `0.25rem` (sm) corner radius. Use `on_primary` (#ffffff) for text.
- **Secondary:** Surface-only. No border. Use `primary` text.
- **Tertiary/Ghost:** No container. Use `primary` text with an underline appearing only on hover.

### Bento-Style Cards
- **Structure:** No borders. `0.5rem` (lg) corner radius. 
- **Internal Spacing:** Use a strict `24px` padding for all standard cards to maintain the industrial grid.
- **Content Separation:** Forbid divider lines. Use `16px` or `24px` of vertical white space to separate the header from the body content.

### Input Fields & Search
- **Default:** `surface_container_low` fill. No border.
- **Focus State:** A 2px "Ghost Border" of `primary` at 40% opacity.
- **Labels:** Always use `label-md` in `text-muted` (#64748b) positioned above the input.

### Status Indicators (Kinetic Chips)
- **Success:** `success` (#10b981) background at 15% opacity with `on_tertiary_fixed_variant` text. No borders.
- **Warning:** `warning` (#f59e0b) background at 15% opacity. 

### Custom Component: The "Kinetic Scrubber"
For logistics timelines, use a horizontal line in `outline_variant` (10% opacity) with `primary` circular nodes. Active nodes should have a subtle pulse animation to signify "precision in motion."

---

## 6. Do’s and Don’ts

### Do
- **Do** use CSS Grid for bento layouts. Vary the column spans (e.g., a 2-column wide card next to two 1-column cards) to create visual interest.
- **Do** use `surface-container` tiers to group related logistics data.
- **Do** prioritize white space over lines. If the data feels cluttered, increase the padding, don't add a border.

### Don't
- **Don't** use pure black (#000000) for shadows or text. Use the `on_surface` (#111c2d) or `on_secondary_container` (#54647a) tokens.
- **Don't** round corners beyond `0.75rem` (xl). This system is "Industrial-Tech," not "Consumer-Soft." It needs to feel sturdy.
- **Don't** use standard 1px dividers in lists. Use 8px of vertical spacing and a `surface-container-low` hover state instead.

### Accessibility Note
Ensure all text combinations maintain a 4.5:1 contrast ratio. When using `primary` as a background, only use `on_primary` (#ffffff) for the foreground.