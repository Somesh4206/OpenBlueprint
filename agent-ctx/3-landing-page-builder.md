# Task 3 — landing-page-builder

## What I built

The OpenBlueprint landing page (Task 3) plus minimal stubs for the four sibling views so the dev server compiles end-to-end.

## Files created

### Landing page (`src/components/openblueprint/landing/`)
- **`landing.tsx`** — main entry. Default + named `Landing` export. Renders 9 sections in this order:
  1. `Header` — sticky, blurred (`bg-background/80 backdrop-blur-md`); Brand on left, desktop nav (Home / How It Works / Features / Templates / Pricing / About) center, "Sign In" ghost + "Create Blueprint" primary on right. Mobile collapses nav into a radix `Sheet` drawer.
  2. `Hero` — eyebrow badge with pulsing dot, H1 "From Measurements to Intelligent Blueprints." using `var(--font-display)`, subtext, primary CTA → `setView({name:'wizard'})` and secondary "Explore Demo" → `setView({name:'dashboard'})`. Then a **split-screen workspace card** with a `2D Plan | 3D View` tab toggle. The 2D side uses `<MiniPlan layout={demoLayout} />` with `bp-grid` background, floating measurement labels (`30 × 40 ft`, `1,200 sq.ft`, `12′ × 14′`), and a `Compass`-based north arrow. The 3D side uses the new `IsometricHouse` SVG. Width transitions between 65% / 35% with CSS transitions. Below the card: a 4-cell trust-stats strip (4 strategies / 13 templates / Live validation / ₹ estimate). A full-width `bp-draw` separator line at the bottom of the hero.
  3. `HowItWorks` (#how) — 4 numbered steps (Ruler / LayoutGrid / Sparkles / PencilRuler) in a horizontal grid with an animated `bp-draw` connector line on desktop. Numbers use `tech-num`.
  4. `Features` (#features) — 8-card grid (1/2/4 cols responsive): AI-Assisted Planning, Smart Blueprint Generation, Interactive Editor, 3D Visualization, Cost Estimation, AI Design Assistant, RAG Knowledge Assistant, Export & Share. Hover lift + border-cyan tint.
  5. `Templates` (#templates) — filter tabs (All / Residential / Commercial / Other) backed by `useState`. Renders all 13 `TEMPLATES` with `<MiniPlan rooms={t.preview} className="w-full h-32" />` preview, category badge, dimensions in `tech-num`, and "Use template" button that calls `useApp.getState().loadTemplate(t.id); setView({name:'wizard'})`.
  6. `Pricing` (#pricing) — 3 tiers (Starter Free, Pro ₹1,499/mo highlighted "Most Popular", Studio ₹4,999/mo). All CTAs → `setView({name:'wizard'})`. Includes "Preliminary pricing — features may change" footnote.
  7. `About` (#about) — two-column. Left: 3-paragraph mission + 4-pill design-philosophy checklist. Right: a 5-stage vertical process panel ("Understanding → Planning → Validating → Visualizing → Optimizing") with a connecting line and a 13/4/6 stat strip.
  8. `Disclaimer` — amber-tinted (`border-amber-soft/40 bg-amber-soft/10`) box with `ShieldAlert` icon and the full regulatory disclaimer copy.
  9. `Footer` — `mt-auto` so it sticks to viewport bottom on short pages. Brand + tagline + "Create Blueprint" CTA, then 4 link columns (Product / Company / Resources / Legal), then a bottom bar with `© 2024 OpenBlueprint` tagline and Twitter/GitHub/LinkedIn social icons.

  Layout is `min-h-screen flex flex-col` so the footer sticks naturally. Spacing uses `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` per the design language. Subtle `framer-motion` `whileInView` fade-up animations via a shared `FadeIn` helper. Sticky-header offset handled via `scroll-mt-20` on each `<section>`.

- **`isometric-house.tsx`** — pure SVG isometric house illustration used in the hero "3D View" tab. 30° isometric projection helpers (`IsoRect`, `IsoBox`, `IsoWindow`, `IsoDoor`, `IsoTree`), navy stroke + cyan-tinted windows + parapet + side parking slab + tree + embedded measurement label + compass. No Three.js / no raster images.
- **`demo-layout.ts`** — inline `LayoutData` for the hero 2D preview: 30×40 ft plot, 6 rooms (Master Bedroom 14×14, Bedroom 2 15×12, Bathroom 8×8, Kitchen 15×12, Living Room 20×14, Parking 10×20), with realistic door + window markers. Floor 0, strategy `modern-open`.
- **`a11y.tsx`** — small `VisuallyHidden` wrapper (used to satisfy radix `Sheet`'s required `SheetTitle` for screen-reader accessibility without showing it).

### Stub views (so the dev server compiles)
The pre-existing `src/app/page.tsx` imports all five views (`Landing`, `Dashboard`, `Wizard`, `DesignOptions`, `Workspace`); only `Landing` was in scope for Task 3. To keep the dev server green, I created minimal placeholder components for the four other views that just show a "coming soon" message + "Back to Home" button. **Subsequent task agents (Tasks 4–7) should OVERWRITE these stubs with the real implementations.**
- `src/components/openblueprint/dashboard/dashboard.tsx`
- `src/components/openblueprint/wizard/wizard.tsx`
- `src/components/openblueprint/design-options/design-options.tsx` (props: `{config, designs}`)
- `src/components/openblueprint/workspace/workspace.tsx` (props: `{config, design, projectId}`)

## Key decisions
- **Palette adherence**: only navy (`text-primary` / `bg-primary`), cyan accent (`text-cyan`), warm white (`bg-background`), white panels (`bg-card`), charcoal (`text-foreground`). Zero indigo/purple. Amber reserved for the disclaimer only.
- **No window references inside framer-motion `animate`**: refactored the hero split-screen from `motion.div` width animation to CSS `transition-all duration-500` + conditional Tailwind `lg:w-[65%]` / `lg:w-[35%]` classes — cleaner and SSR-safe.
- **Icon rename**: `lucide-react@0.525` doesn't export `MessageSquareCog`; replaced with `MessageSquareCode` for the "AI Design Assistant" card. All other specified icons verified present.
- **Function naming**: named the template-loader `applyTemplate` (not `useTemplate`) so eslint's `react-hooks/rules-of-hooks` doesn't flag it.
- **Template loading**: uses `useApp.getState().loadTemplate(...)` directly inside the click handler to avoid stale closures from selector subscription.
- **Mobile nav**: radix `Sheet` (side="right") with `SheetClose asChild` wrapping each link so the drawer auto-closes on navigation.
- **Animations**: kept subtle — `FadeIn` wrapper does `opacity 0→1, y 20→0` with `viewport={{ once: true, margin: '-80px' }}`. No parallax, no scale-on-hover on cards (just `hover:-translate-y-1`).

## Verification
- `bunx tsc --noEmit` → zero errors in any `landing/`, `dashboard/`, `wizard/`, `design-options/`, `workspace/` file.
- `bun run lint` → clean (0 problems).
- `curl http://localhost:3000/` → HTTP 200, 147 KB SSR HTML containing all 9 section headings, "Most Popular" badge, ₹1,499 / ₹4,999 prices, 13 "Use template" buttons, "30 × 40 ft" measurement labels, and the disclaimer copy.

## What the next agents should know
- View routing is in `src/app/page.tsx` and is gated by `useApp((s) => s.view).name`. The default view is `landing`. Navigation calls: `setView({ name: 'wizard' | 'dashboard' | 'design-options' | 'workspace' })`. The latter two require additional props (`config`/`designs`/`design`/`projectId`).
- The Zustand store (`src/lib/store.ts`) exposes: `wizardConfig`, `loadTemplate(id)`, `setDesigns`, `enterWorkspace(d)`, and a wide range of workspace state setters. Read it before building wizard/workspace.
- The shared design tokens (`bp-grid`, `tech-num`, `bp-draw`, `bp-pulse`, `text-cyan`, `text-amber-soft`, `var(--font-display)`, `var(--font-mono)`) are defined in `src/app/globals.css` — reuse them for visual consistency.
- The shared `MiniPlan` component accepts either a full `LayoutData` (recommended for hero / real previews) or a simple `{type, w, l}[]` (good enough for template thumbnails).
- 13 templates live in `src/lib/templates.ts` and include a `.preview` array sized for `MiniPlan`'s 100×80 packed canvas.
