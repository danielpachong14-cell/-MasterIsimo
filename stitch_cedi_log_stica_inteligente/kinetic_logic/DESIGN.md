# Design System Document: Industrial Precision

## 1. Overview & Creative North Star: "The Kinetic Architect"
This design system moves beyond the static "admin dashboard" trope. It is built for the high-velocity environment of a Hard Discount CEDI (Distribution Center), where every second is a cost and every error is a bottleneck.

**The Creative North Star: The Kinetic Architect.**
The UI should feel like a high-performance machine—precise, industrial, and authoritative. We break the "template" look by using **Intentional Asymmetry** and **Tonal Depth**. While the data is dense, the interface must breathe. We achieve this through "The Editorial Scale": using massive, high-contrast display type for key metrics (`display-lg`) juxtaposed against hyper-legible, utilitarian data strings (`body-sm`). The layout should feel like a technical blueprint: structured, yet layered with modern transparency.

---

## 2. Colors: Tonal Logic & The No-Line Rule
We utilize a sophisticated palette that balances the deep authority of `#381368` (Primary) with the industrial neutrality of the `surface` scales.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. In a CEDI environment, lines create visual noise that slows down data processing. 
*   **Boundaries** must be defined by background color shifts.
*   **Example:** A `surface-container-low` section (for secondary inputs) sitting on a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to define importance:
*   **Surface (Base):** The foundation of the application.
*   **Surface-Container-Low:** Use for grouping secondary dashboard widgets.
*   **Surface-Container-Lowest:** Reserved for the "Primary Work Surface" (e.g., the active data table or the main form card) to create a soft, natural lift.
*   **Surface-Bright:** Use for interactive elements that need to "pop" against the industrial background.

### The "Glass & Gradient" Rule
To avoid a flat, "SaaS-lite" feel, apply **Glassmorphism** to floating elements like Sidebar Navs or mobile overlays. Use semi-transparent `surface` colors with a `backdrop-blur` of 12px–20px. 
*   **Signature Textures:** Main Action Buttons or Hero Metrics should utilize a subtle linear gradient from `primary` (#381368) to `primary_container` (#4f2d7f) at a 135° angle. This adds a "weighted" feel that flat hex codes lack.

---

## 3. Typography: The Industrial Editorial
We pair **Manrope** (Display) with **Inter** (UI/Data) to create a hierarchy that feels both premium and functional.

*   **Headlines (Manrope):** Use `headline-lg` for terminal numbers or dock assignments. It provides an "Architectural" weight.
*   **Data (Inter):** Use `body-md` and `label-sm` for all table data and logistics logs. Inter’s tall x-height ensures legibility in low-light warehouse conditions or high-vibration truck cabins.
*   **Intentional Contrast:** Pair a `display-sm` metric (e.g., "98.4%") with a `label-md` descriptor (e.g., "ON-TIME SHIPMENT") in all-caps with 5% letter spacing to evoke a technical manual aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "soft" for an industrial system. We use **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-highest` element (like a critical alert) should sit on a `surface-container-low` dashboard.
*   **Ambient Shadows:** For floating Modals or Mobile Action Sheets, use a tinted shadow: `0px 20px 40px rgba(56, 19, 104, 0.08)`. The purple tint keeps the shadow from looking "dirty" or grey.
*   **The Ghost Border:** If a boundary is required for accessibility, use `outline_variant` at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use for the mobile driver interface. A semi-transparent "In-Transit" card allows the map to subtly bleed through, keeping the driver oriented in space.

---

## 5. Components: Precision Primitives

### Bento-Grid Dashboards
Dashboards must not be uniform. Use a "Bento" approach where "Power Stats" take up 2x2 grid slots using `surface-container-lowest`, while "Support Stats" use 1x1 slots. This directs the eye to the CEDI's most critical KPIs immediately.

### Data Tables (The "CEDI Grid")
*   **Forbid Dividers:** Use vertical whitespace and alternating `surface` / `surface-container-low` row tints.
*   **Status Indicators:** Instead of "tags," use a **Vertical Status Bar** (4px wide) on the far left of the row, utilizing `tertiary_fixed` (Success) or `error` (Danger).

### Step-by-Step Guided Forms
*   **Large Inputs:** Inputs should have a height of `56px` for desktop and `64px` for mobile (fat-finger friendly for drivers).
*   **Surface:** Use `surface_container_highest` for the input background with a `0.25rem` (sm) radius.
*   **Typography:** The label should move to a `label-sm` position above the value once focused.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. No border. `xl` (0.75rem) roundedness for a modern, tactile feel.
*   **Secondary:** Ghost style. No background, `outline` token at 20% opacity.
*   **Tertiary:** Text-only, using `primary` color, weight 600.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a separator. If in doubt, add more padding rather than a line.
*   **DO** use `tertiary` (Green/Success) tokens sparingly. They should represent "System Clear" or "Gate Open."
*   **DO** ensure all touch targets for the Driver Mobile App are at least 48px.

### Don't
*   **DON'T** use pure black `#000000`. Use `on_surface` (#191c1e) for deep text to maintain the industrial-tech vibe.
*   **DON'T** use 100% opaque borders. They clutter the dense logistics data.
*   **DON'T** use "Standard" Material Design shadows. They look too consumer-grade; stick to tonal shifts and ambient purp-tinted blurs.