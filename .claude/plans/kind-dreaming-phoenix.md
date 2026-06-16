# infoSentry — Multi-Product SaaS Suite Rebrand

> **a Harieshwar J A initiative**
>
> Turn Info-Sentry's five surfaces (iFeeds, iGitHub, iVideos, iChat, iSurprise) into a
> branded suite of standalone-but-bundleable SaaS products with marketing landings,
> per-product settings, animated violet identity, and a foundation for paywalls — all
> WCAG 2.2 AA compliant.

---

## Context

Today, Info-Sentry is a single multi-page app at `/feed`, `/chat`, `/github-feed`,
`/video-feed`, `/surprise` — five distinct product surfaces glued to one navigation
shell. There is no marketing layer, no per-product story, no paywall infrastructure,
and the visual system uses indigo (`#6366f1`) with minimal animation and baseline
accessibility.

The goal is a **product suite rebrand**: each `i*` surface becomes its own SaaS
offering with its own marketing landing page at `harieshwar.dev/sentry/iX`, its own
settings/manage surface, and (later) its own paywall — while sharing one identity:
**"infoSentry — a Harieshwar J A initiative"**.

The letter **"i"** is the brand pivot. It does **not** mean Apple — it means
**intelligence, innovation, imagination, insight, intuition, ingenuity, impact**, and
whatever else the consumer wants it to mean. An animated typographic hero rewrites
the definition in real time across pages.

Theme: **dark violet** — creativity, luxury, the balance of red's energy and blue's
trust. Minimalist, modern, breathtaking visuals via Framer Motion (2D parallax, scroll
storytelling, magnetic CTAs, aurora backgrounds) and react-three-fiber (one bespoke
3D centerpiece per product page).

User decisions captured before this plan was written:
1. **Marketing host:** same Next.js app, `/sentry/*` routes (DNS-aliased from `harieshwar.dev/sentry/*`).
2. **App routing:** rename app routes to `/iX/*` at root with 308 redirects from old paths.
3. **Pricing:** free tier = $1/month total LLM spend across all products; per-product subscriptions + bundle discounts (2/3/4 products) **deferred to a later phase** but schema must be ready.
4. **Visual scope:** ALL — `i=` cycling hero, 3D per product, scroll parallax/reveals, aurora bg + magnetic interactions, modern minimalist dark-violet design.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  harieshwar.dev/sentry/*           (public marketing, SEO)      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /sentry              Suite homepage — animated "i =..."   │  │
│  │ /sentry/iFeeds       Product landing + 3D orbit nodes     │  │
│  │ /sentry/iGitHub      Product landing + 3D repo globe      │  │
│  │ /sentry/iVideos      Product landing + 3D carousel        │  │
│  │ /sentry/iChat        Product landing + 3D chat orb        │  │
│  │ /sentry/iSurprise    Product landing + 3D serendipity     │  │
│  │ /sentry/pricing      Bundle configurator (2/3/4/all)      │  │
│  │ /sentry/manifesto    The "i" definition story             │  │
│  │ /sentry/waitlist     Paywall waitlist capture             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼ "Sign in with Google"           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /iFeeds  /iGitHub  /iVideos  /iChat  /iSurprise          │  │
│  │   each with /settings sub-route (product-scoped)          │  │
│  │ /settings  Global account, billing, admin                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Shared: Auth (HMAC cookie), Prisma User, design system,        │
│          UI primitives, entitlement middleware                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Foundations (Week 1)

**Goal:** install tooling, set up the design-token layer, and prepare a11y infrastructure
before any visible work begins.

### 0.1 Dependencies to add

In `web/package.json`:
```json
{
  "framer-motion": "^12.0.0",
  "three": "^0.169.0",
  "@react-three/fiber": "^8.17.0",
  "@react-three/drei": "^9.114.0",
  "lenis": "^1.1.0",
  "next-themes": "^0.3.0",
  "clsx": "^2.1.1"
}
```
Dev-only:
```json
{
  "@axe-core/react": "^4.10.0",
  "eslint-plugin-jsx-a11y": "^6.10.0",
  "pa11y-ci": "^3.1.0",
  "@types/three": "^0.169.0"
}
```

### 0.2 Design tokens (violet palette, WCAG-verified)

Replace tokens in `web/src/app/globals.css` (the existing file already has CSS
variables — extend the palette, do not remove existing keys until consumers are
migrated):

```css
:root {
  /* Base surfaces — violet-tinted, not pure black */
  --bg:               #0a0a14;   /* contrast vs white text = 19.1 : 1 (AAA) */
  --bg-elevated:      #11112a;
  --surface:          #161636;
  --surface-2:        #1f1f4a;
  --border:           #2a1f4a;
  --border-strong:    #3b2d6b;
  --hover:            #1e1e3f;

  /* Violet brand */
  --violet-50:        #f3eaff;
  --violet-100:       #e9d5ff;
  --violet-200:       #d8b4fe;
  --violet-300:       #c084fc;   /* primary interactive on dark */
  --violet-400:       #a78bfa;   /* accent / focus ring */
  --violet-500:       #8b5cf6;   /* primary buttons */
  --violet-600:       #7c3aed;   /* hover state */
  --violet-700:       #6d28d9;
  --violet-900:       #4c1d95;

  /* Text — all tested for contrast against --bg */
  --text-primary:     #f4f3ff;   /* 18.4 : 1 (AAA) */
  --text-secondary:   #b4adcc;   /*  9.2 : 1 (AAA) */
  --text-muted:       #8a86a8;   /*  5.7 : 1 (AA) */
  --text-on-violet:   #0a0a14;   /* for use on bright violet surfaces */

  /* Semantic */
  --positive:         #4ade80;   /*  9.4 : 1 (AAA) */
  --negative:         #f87171;   /*  6.8 : 1 (AA) */
  --warning:          #fbbf24;   /*  11  : 1 (AAA) */

  /* Focus + a11y */
  --focus-ring:       #c084fc;
  --focus-ring-bg:    rgba(192, 132, 252, 0.15);

  /* Motion */
  --ease-out-expo:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart:   cubic-bezier(0.25, 1, 0.5, 1);
  --duration-fast:    150ms;
  --duration-base:    240ms;
  --duration-slow:    480ms;
}
```

Update `web/tailwind.config.ts` `theme.extend.colors` to mirror these tokens (the
config already maps to CSS vars — just add the new violet scale).

### 0.3 Typography

Add **Sora** (display) alongside the existing **Inter** (body) and **JetBrains Mono**
(code). Edit `web/src/app/layout.tsx` `<head>` Google Fonts preconnect block:

```tsx
<link
  rel="preconnect"
  href="https://fonts.googleapis.com"
  crossOrigin="anonymous"
/>
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

Tailwind `fontFamily`:
- `font-sans` → Inter (default)
- `font-display` → Sora (hero & section titles)
- `font-mono` → JetBrains Mono

### 0.4 Accessibility infrastructure (new files)

| File | Purpose |
|------|---------|
| `web/src/components/a11y/MotionGate.tsx` | Wraps any animation. Reads `prefers-reduced-motion`; renders static fallback when reduced. Exposes `<MotionGate.Motion as={motion.div} ...>` and `<MotionGate.Static>...</MotionGate.Static>` slots. |
| `web/src/components/a11y/LiveRegion.tsx` | `role="status"` + `aria-live="polite"` announcer; used for chat streaming, toast messages, search result counts. |
| `web/src/components/a11y/SkipLink.tsx` | "Skip to main content" link, visually-hidden until focused, jumps to `#main`. Rendered first in `RootLayout`. |
| `web/src/components/ui/VisuallyHidden.tsx` | Generic sr-only helper. |
| `web/src/components/ui/FocusRing.tsx` | Wraps interactive elements to apply consistent focus-visible outline (uses `--focus-ring`). |
| `web/src/hooks/useReducedMotion.ts` | Re-export from framer-motion + SSR-safe default `true`. |
| `web/src/hooks/usePrefersHighContrast.ts` | Detects `prefers-contrast: more`, increases border opacity and text weight. |

### 0.5 Eslint + automated a11y

Update `web/.eslintrc` (or `eslint.config.mjs`):
```js
plugins: ['jsx-a11y'],
extends: ['plugin:jsx-a11y/recommended'],
rules: {
  'jsx-a11y/no-static-element-interactions': 'error',
  'jsx-a11y/click-events-have-key-events': 'error',
  'jsx-a11y/label-has-associated-control': 'error',
  'jsx-a11y/no-noninteractive-tabindex': 'error',
}
```

Add `web/.pa11yci.json` with the suite + product pages to scan on CI.

### 0.6 Folder scaffolding

Create empty directories so subsequent phases can land code without touching shape:
```
web/src/app/sentry/
web/src/app/iFeeds/
web/src/app/iGitHub/
web/src/app/iVideos/
web/src/app/iChat/
web/src/app/iSurprise/
web/src/components/brand/
web/src/components/marketing/
web/src/components/three/
web/src/components/a11y/
```

---

## Phase 1 — Brand Layer & "i" Identity (Week 1–2)

**Goal:** ship the suite homepage at `/sentry` with the animated identity, even before
product pages exist.

### 1.1 The "i =" word-cycling hero

**Component:** `web/src/components/brand/IDefinitionCycler.tsx`

Hero text reads:
```
i = [WORD]
```
where `[WORD]` cycles through (every ~2.5s, with cross-fade + slight Y-translate via
framer-motion `AnimatePresence`):

```ts
const I_WORDS = [
  'intelligence',
  'innovation',
  'imagination',
  'insight',
  'intuition',
  'ingenuity',
  'impact',
  'inspiration',
  'invention',
  'instinct',
  '__you',   // last token reveals "you" with stronger emphasis
];
```

Per-product overrides (used on each landing):
| Product | Cycled words |
|---------|--------------|
| iFeeds | informed · ingest · intel · interpret · *insight* |
| iGitHub | inspect · iterate · index · investigate · *innovate* |
| iVideos | immerse · ingest · inform · interpret · *intuit* |
| iChat | interact · interview · iterate · inquire · *intelligent* |
| iSurprise | imagine · invent · *inspire* |

A11y:
- Wrapped in `<MotionGate>`. Reduced-motion users see a static "i = intelligence."
- The cycling word is inside `<span aria-live="polite">` so screen readers announce
  each change. Throttled to one announcement per 5s to avoid flooding.
- The visible text uses `font-display` (Sora 700) at clamp(48px, 8vw, 120px).

### 1.2 Logo + brand bar refresh

Update `web/src/components/shell/InfoSentryLogo.tsx`:
- Gradient changes from indigo `#6366f1 → #8b5cf6` to violet `#a78bfa → #7c3aed`.
- Add an animated pulse using `var(--violet-300)` (replaces current logo-dot-pulse keyframe).
- New `tagline` prop renders **"a Harieshwar J A initiative"** in `--text-muted` next to
  the wordmark when used in marketing chrome.

New `web/src/components/brand/HarieshwarBadge.tsx`:
- Small pill component "by **Harieshwar J A**" with a magnetic hover micro-interaction
  (framer-motion `useMotionValue` + `useTransform` on cursor delta).

### 1.3 Aurora background

`web/src/components/marketing/AuroraBackground.tsx`:
- Pure CSS + `<canvas>` hybrid. Three blurred radial gradients in violet/purple/indigo
  drift slowly via CSS `@keyframes` (transformed in 60s loops, GPU-accelerated).
- For users without `prefers-reduced-motion`, an additional canvas layer renders a low-
  frequency simplex-noise displacement (cheap; ~1ms/frame on M1).
- Reduced-motion → static gradient only.

### 1.4 Marketing layout

`web/src/app/sentry/layout.tsx`:
- Public marketing chrome: thin sticky nav (logo + "a Harieshwar J A initiative" + links
  to each product + "Sign in"), full-bleed main, footer with sitemap + manifesto link +
  legal links.
- **No sidebar, no bottom nav.** Distinct from the app shell.
- Skip-link first; `<main id="main">` wraps children.

### 1.5 Suite homepage `/sentry/page.tsx`

Sections (top to bottom):
1. **Hero** — Aurora + `<IDefinitionCycler />` + CTA "Explore the products" (magnetic).
2. **The five products grid** — 5 violet-glass cards (one per product), each linking to
   its landing. Hover = tilt-on-mouse + spotlight (framer-motion 3D-CSS transform).
3. **Manifesto strip** — animated marquee of "i" words, autoplay paused on hover.
4. **Pricing teaser** — "Free up to $1/mo of intelligence. Bundle later for more."
5. **About** — short paragraph on Harieshwar's mission, with avatar + signature.
6. **Footer** — sitemap, social, "© infoSentry — a Harieshwar J A initiative".

### 1.6 Manifesto page `/sentry/manifesto/page.tsx`

Scroll-driven (Lenis + framer-motion `useScroll`). As the user scrolls, the page tells
the brand story — each "i" word reveals with a parallax movement and a one-line
definition. Ends with a CTA to explore products.

---

## Phase 2 — Per-Product Landing Pages (Week 2–4)

**Goal:** ship five product landings at `/sentry/iFeeds`, `/sentry/iGitHub`,
`/sentry/iVideos`, `/sentry/iChat`, `/sentry/iSurprise`.

### 2.1 Shared landing skeleton

Every product landing follows the same eight-section structure (consistency = brand):

| # | Section | Component |
|---|---------|-----------|
| 1 | **Hero** with product-specific `<IDefinitionCycler words={...}>` and a 3D centerpiece | `<ProductHero>` |
| 2 | **Tagline strip** — one-line value prop with violet underline reveal on scroll | `<TaglineStrip>` |
| 3 | **Feature grid** — 3×2 with icon, title, body, micro-animation per tile | `<FeatureGrid>` |
| 4 | **Interactive demo** — embedded screenshot/video or live mini-widget | `<DemoEmbed>` |
| 5 | **Stat counters** — 3 big numbers that count up on scroll-into-view | `<StatCounters>` |
| 6 | **Pricing card** — Free tier + "Subscribe — coming soon" + waitlist form | `<ProductPricingCard>` |
| 7 | **FAQ** — accordion (semantic `<details>`/`<summary>` for native a11y) | `<FAQ>` |
| 8 | **Cross-sell** — "Pairs well with…" — 2 other product cards | `<CrossSell>` |

### 2.2 The five 3D centerpieces

All under `web/src/components/three/`:

| Product | Component | Concept |
|---------|-----------|---------|
| **iFeeds** | `<OrbitingNodes>` | Cluster of nodes (one per topic) orbiting a central core; lines link related ones; user can scrub orbit speed by scrolling. |
| **iGitHub** | `<RepoGlobe>` | Slow-rotating wireframe globe; brighter dots = trending repos; sparkles on top-trending. |
| **iVideos** | `<VideoCarousel3D>` | Curved 3D ribbon of video thumbnails, gently parallaxes with cursor. |
| **iChat** | `<ChatOrb>` | Glowing violet orb that pulses to a synthetic "thinking" rhythm; outer ring text reveals example prompts. |
| **iSurprise** | `<SerendipityField>` | Particle field — most particles drift slowly; one streaks across at random intervals (the "surprise"). |

A11y rules for every R3F scene:
- Canvas is `aria-hidden="true"` (decorative).
- A text alternative renders behind the canvas via CSS (visible to SR, hidden visually).
- `prefers-reduced-motion` → render a single static SVG illustration instead of the canvas.
- Bundled lazily via `next/dynamic({ ssr: false })`; first-paint shows the static SVG, then the canvas hydrates.

### 2.3 Per-product copy & differentiation

| Product | Hero word cycle ends on | Tagline | Free tier limit |
|---------|------------------------|---------|-----------------|
| iFeeds | **insight** | "Read less. Understand more." | 3 topics, 5 sources |
| iGitHub | **innovate** | "The pulse of open source, ranked for you." | 20 repos watched |
| iVideos | **intuit** | "Channels you trust. Transcripts on demand." | 3 channels, summaries off |
| iChat | **intelligent** | "Your news, your code, your context — in conversation." | 20 messages/day |
| iSurprise | **inspire** | "Twelve great things you weren't looking for." | weekly digest only |

(Free tiers are aspirational — actual enforcement comes via the global $1/mo cap from Phase 5.)

### 2.4 Pricing & waitlist

Each `ProductPricingCard` shows:
- **Free** — current $1/mo combined budget, no card required.
- **Pro — coming soon** — single CTA opens `/sentry/waitlist?product=iChat` with prefilled selection.

The pricing page `/sentry/pricing/page.tsx` features a **Bundle Configurator**:
- Five toggleable product checkboxes.
- Live-updating price: 1 product = $X, 2 products = $X × 1.8, 3 products = $X × 2.4, 4 products = $X × 2.9, all 5 = $X × 3.2 (illustrative — formula tunable).
- "Notify me when paid plans launch" → waitlist with selected bundle saved.

---

## Phase 3 — App Route Migration to `/iX/*` (Week 4)

**Goal:** rename app routes from `/feed`, `/chat`, `/github-feed`, `/video-feed`,
`/surprise` to `/iFeeds`, `/iChat`, `/iGitHub`, `/iVideos`, `/iSurprise`. Preserve
all bookmarks, SEO, and internal links via 308 redirects.

### 3.1 Move/rename files

| Old path | New path |
|----------|----------|
| `web/src/app/feed/page.tsx` | `web/src/app/iFeeds/page.tsx` |
| `web/src/app/topics/page.tsx` | `web/src/app/iFeeds/topics/page.tsx` |
| `web/src/app/sources/page.tsx` | `web/src/app/iFeeds/sources/page.tsx` |
| `web/src/app/article/[id]/page.tsx` | `web/src/app/iFeeds/article/[id]/page.tsx` |
| `web/src/app/predictions/page.tsx` | `web/src/app/iFeeds/predictions/page.tsx` |
| `web/src/app/github-feed/page.tsx` | `web/src/app/iGitHub/page.tsx` |
| `web/src/app/github-feed/[id]/page.tsx` | `web/src/app/iGitHub/[id]/page.tsx` |
| `web/src/app/video-feed/page.tsx` | `web/src/app/iVideos/page.tsx` |
| `web/src/app/video-feed/[id]/page.tsx` | `web/src/app/iVideos/[id]/page.tsx` |
| `web/src/app/chat/page.tsx` | `web/src/app/iChat/page.tsx` |
| `web/src/app/surprise/page.tsx` | `web/src/app/iSurprise/page.tsx` |

### 3.2 308 redirects

Add to `web/next.config.ts` (or `next.config.js`):
```ts
async redirects() {
  return [
    { source: '/feed',           destination: '/iFeeds',    permanent: true },
    { source: '/topics',         destination: '/iFeeds/topics',     permanent: true },
    { source: '/sources',        destination: '/iFeeds/sources',    permanent: true },
    { source: '/article/:id',    destination: '/iFeeds/article/:id', permanent: true },
    { source: '/predictions',    destination: '/iFeeds/predictions', permanent: true },
    { source: '/github-feed',    destination: '/iGitHub',           permanent: true },
    { source: '/github-feed/:id', destination: '/iGitHub/:id',      permanent: true },
    { source: '/video-feed',     destination: '/iVideos',           permanent: true },
    { source: '/video-feed/:id', destination: '/iVideos/:id',       permanent: true },
    { source: '/chat',           destination: '/iChat',             permanent: true },
    { source: '/surprise',       destination: '/iSurprise',         permanent: true },
  ];
}
```

### 3.3 Update navigation hrefs

Files to update:
- `web/src/components/shell/Sidebar.tsx` — `PRIMARY_NAV` href values
- `web/src/components/shell/BottomNav.tsx` — bottom tabs href values
- Any internal `<Link>` usages — grep for the old paths:
  ```
  rg -n "/feed|/topics|/sources|/predictions|/article|/github-feed|/video-feed|/chat|/surprise" web/src
  ```
  …and update each.

### 3.4 Middleware update

`web/src/middleware.ts` — add `/sentry` to PUBLIC_PREFIXES so marketing pages stay
public:
```ts
const PUBLIC_PREFIXES = ['/login', '/api/auth', '/sentry'];
```
The root `/` already serves the existing landing — leave it alone (it can later
redirect to `/sentry` or stay as a parallel landing).

### 3.5 Logged-in default destination

`web/src/app/page.tsx` redirects authed users to `/feed` today. Change to `/iFeeds`.

---

## Phase 4 — Per-Product Settings & Manage Surfaces (Week 5)

**Goal:** split the monolithic `/settings` into product-scoped settings + a global
account page.

### 4.1 New per-product settings routes

```
/iFeeds/settings     — Topics, sources, notifications threshold, beta predictions toggle
/iGitHub/settings    — Language filter defaults, refresh interval, "unread" prefs
/iVideos/settings    — Channel management, transcript auto-fetch toggle, default summary length
/iChat/settings      — Model preference, system prompt, history retention, context inclusion
/iSurprise/settings  — Cadence (daily/weekly), exclusions, novelty weight
```

Each product's `/settings/page.tsx` is a client component with:
- A `<ProductSettingsLayout>` shared shell (breadcrumb, save bar, "Last saved" badge).
- Sections grouped under `<SettingsCard>` with `<FormInput>`/`<SegmentTabs>` from the
  existing primitives (already a11y-friendly).
- Auto-save with debounced PATCH to a new endpoint (see 4.3).
- "Reset to defaults" button.

### 4.2 Global `/settings`

Stripped to: profile, billing (placeholder), session (logout, devices), admin
(visible only when `User.isAdmin`). Move budget/agent/cron controls here too —
admin-only.

### 4.3 Settings persistence

Add a `UserSettings` model in `prisma/schema.prisma`:
```prisma
model UserSettings {
  id        String   @id @default(cuid())
  userId    String   @unique
  product   String   // "global" | "iFeeds" | "iGitHub" | "iVideos" | "iChat" | "iSurprise"
  data      Json     // free-form JSON per product
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, product])
}
```
API: `GET/PATCH /api/settings/[product]` — uses `requireUserId()`.

**Migration ownership gotcha:** The README documents a recurring "must be owner of
table…" error because `DATABASE_URL` uses `openclaw_role` but tables are owned by
`infosentry`. When running this migration:
- Either temporarily switch `DATABASE_URL` to the `infosentry` owner credentials, or
- Apply the SQL manually as `infosentry`, then run `npx prisma migrate resolve --applied
  20XXXXXX_user_settings`.

### 4.4 Migrate existing settings storage

Today:
- `Interest`, `VideoChannel`, `BudgetSettings` already exist as dedicated tables.
- Beta predictions toggle lives in localStorage.

Migration plan:
- **Keep dedicated tables** (Interest, VideoChannel) — they are first-class entities, not preferences.
- **Move localStorage beta toggle** to `UserSettings(product="iFeeds", data.betaPredictions=true)`.
- **New product prefs** (chat model, video summary length, surprise cadence) live in `UserSettings`.

---

## Phase 5 — Free Tier Enforcement (Week 5–6)

**Goal:** enforce the agreed free-tier cap — **$1/month total LLM spend across all
products combined** — using existing budget infrastructure.

### 5.1 Mechanism

Today `BudgetSettings(mode='per_user', defaultPerUserCapUsd=N)` already enforces
caps via `checkBudgetBeforeChat()`. Reuse this:

- Default `User.monthlyCapUsd = 1.00` on signup (set in the OAuth callback).
- Existing `CostLog` rows already aggregate per `userId`, so the guard works unchanged.
- Add a new guard `checkBudgetBeforeProductCall(userId, productName)` so each product's
  API route can refuse calls when the cap is hit — currently only chat is guarded.
- Show a friendly "You've used your $1 of free intelligence this month — bundle paid
  plans coming soon, join the waitlist" modal across products.

### 5.2 Cap visibility

Add a compact `<UsageMeter>` component to the suite sidebar (replaces the existing
budget meter for non-admin users):
- Reads `GET /api/budget/me` (already exists or trivial to add).
- Animates a violet bar with `useSpring` from framer-motion.
- Has `role="progressbar"` + `aria-valuenow/min/max` for SR users.

### 5.3 No Stripe yet

Stripe schema is **deferred** but the seam is reserved:
- New Prisma models `Product`, `Plan`, `Subscription`, `Entitlement` are **planned but
  not migrated** in this phase. A separate doc `docs/billing-schema.md` (new) captures
  the design so the next phase can land it fast.
- Add an empty `web/src/lib/entitlements.ts` with stub `hasEntitlement(userId, product)`
  returning `true` (everyone has access while bundle paywalls are off). Routes call
  this stub now so flipping later is a one-line change.

---

## Phase 6 — Visual & Motion Layer Across the App (Week 6–7)

**Goal:** the marketing pages get the breathtaking visuals; the app pages get a
calmer, distilled version of the same identity.

### 6.1 Component-level animations

Update existing primitives in `web/src/components/ui/` to use framer-motion via
`<MotionGate>`:
- **`Button.tsx`** — magnetic hover (cursor delta) on `primary` variant; press
  scale-down `0.97`; reduced-motion = no transform.
- **`Card.tsx`** — 3D tilt-on-mouse (subtle ±4°) on `hoverable`; spotlight gradient
  follows cursor; reduced-motion = static.
- **`LoadingState.tsx`** — replace existing CSS pulse with framer-motion `useSpring`
  on opacity + scale for smoother feel.
- **`SegmentTabs.tsx`** — animated indicator pill that slides between tabs (shared
  `layoutId`).

### 6.2 App page reveals

Wrap top-level sections in `<MotionGate><motion.div variants={fadeUp} initial="hidden"
animate="visible">...</motion.div></MotionGate>` with staggered children. Reuse the
existing fade-up CSS classes as the reduced-motion fallback.

### 6.3 Page transitions

Add a global `<PageTransition>` in `web/src/app/layout.tsx` using framer-motion
`AnimatePresence` + Next.js `usePathname`:
- Marketing pages: gentle cross-fade + 8px Y drift.
- App pages: cross-fade only (faster, less distracting during work).

### 6.4 Three.js performance budget

- Each R3F canvas: ≤ 50 draw calls, ≤ 30k tris, postprocessing off by default.
- Lazy-loaded via `next/dynamic`, `ssr: false`.
- DPR clamped to `[1, 1.5]`.
- `frameloop="demand"` where possible (e.g., orbit nodes only re-render on scroll).
- Monitored via `web/src/lib/perf/three-budget.ts` (dev-only) that logs draw counts.

---

## Phase 7 — Accessibility Hardening & QA (Week 7)

**Goal:** WCAG 2.2 Level AA across all new pages, automated and manual.

### 7.1 Checklist (every page)

- [ ] All interactive elements reachable by keyboard alone (Tab/Shift-Tab/Enter/Space/Esc).
- [ ] Visible focus ring on every focusable element (via `<FocusRing>` or `:focus-visible`).
- [ ] Skip-to-content link works.
- [ ] Heading hierarchy is strict (one `<h1>`, no skipped levels).
- [ ] Landmarks: `<header>`, `<nav>`, `<main id="main">`, `<footer>`.
- [ ] All images/icons have alt text or `aria-hidden="true"` if decorative.
- [ ] All icon buttons have `aria-label`.
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for UI components.
- [ ] No information conveyed by color alone (always pair with icon/text).
- [ ] Form inputs have associated `<label>` and `aria-describedby` for hints/errors.
- [ ] Error messages render with `role="alert"`.
- [ ] Live regions for streaming chat, search results, save status.
- [ ] `prefers-reduced-motion` honored on every animation.
- [ ] `prefers-contrast: more` honored (thicker borders, bolder text).
- [ ] Hit targets ≥ 44×44 px (WCAG 2.5.5).

### 7.2 Automated checks (CI gates)

- **eslint-plugin-jsx-a11y** — fails build on a11y rule violations.
- **pa11y-ci** — scan listed URLs (suite homepage + 5 product landings + 5 app pages).
- **axe-core** dev-mode injection in `web/src/app/layout.tsx` (development env only)
  surfaces issues in DevTools.
- **Lighthouse CI** — track Accessibility score ≥ 95 on every PR.

### 7.3 Manual QA pass per release

- Tab through every page; nothing trapped, focus order matches visual order.
- VoiceOver (macOS) + NVDA (Windows) read every page coherently.
- Zoom to 200% — no horizontal scrolling, no clipped text.
- Disable JS — marketing pages still convey content (server-rendered).
- Disable CSS — content order still makes sense.
- Toggle `prefers-reduced-motion` in DevTools — verify no motion plays.

---

## Phase 8 — Future Paywall Foundations (Deferred, but plan locked)

When Stripe lands later, the schema will be:

```prisma
model Product {
  id              String   @id @default(cuid())
  slug            String   @unique   // "iFeeds" | "iGitHub" | ...
  name            String
  monthlyPriceUsd Decimal  @db.Decimal(10, 2)
  stripeProductId String?
  stripePriceId   String?
}

model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  stripeSubscriptionId  String?  @unique
  stripeCustomerId      String?
  status                String   // "trialing" | "active" | "past_due" | "canceled"
  bundleSlug            String?  // null = a-la-carte; "all" or "feeds+chat" etc.
  currentPeriodEnd      DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  items                 SubscriptionItem[]
  user                  User     @relation(fields: [userId], references: [id])
}

model SubscriptionItem {
  id              String   @id @default(cuid())
  subscriptionId  String
  productSlug     String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  @@unique([subscriptionId, productSlug])
}
```

Bundle pricing formula (illustrative):
```
total = baseProductPrice × (1 + 0.8(n-1) - discountStep(n))
where discountStep(n) = { 1:0, 2:0.10, 3:0.18, 4:0.24, 5:0.30 }
```

Entitlement resolution in `web/src/lib/entitlements.ts`:
```ts
export async function hasEntitlement(userId: string, product: ProductSlug) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['trialing', 'active'] } },
    include: { items: true },
  });
  if (!sub) return false;
  return sub.items.some(i => i.productSlug === product);
}
```

Stripe Checkout `/api/billing/checkout` and webhook `/api/billing/webhook` will be
specced in a follow-up; the seam already exists in `web/src/lib/entitlements.ts`.

---

## Critical files to modify

### Phase 0–1 (foundations + brand)
- `web/package.json` — add framer-motion, three, @react-three/fiber, @react-three/drei, lenis, a11y dev deps
- `web/src/app/globals.css` — violet token palette (extend, don't remove yet)
- `web/tailwind.config.ts` — extend colors, add `font-display`
- `web/src/app/layout.tsx` — Sora font preconnect, `<SkipLink>`, `<LiveRegion>` mount
- `web/src/components/shell/InfoSentryLogo.tsx` — violet gradient
- `web/src/components/brand/IDefinitionCycler.tsx` — **new**
- `web/src/components/brand/HarieshwarBadge.tsx` — **new**
- `web/src/components/marketing/AuroraBackground.tsx` — **new**
- `web/src/components/a11y/{MotionGate,LiveRegion,SkipLink}.tsx` — **new**
- `web/src/components/ui/{VisuallyHidden,FocusRing}.tsx` — **new**

### Phase 2 (product landings)
- `web/src/app/sentry/layout.tsx` — **new** marketing chrome
- `web/src/app/sentry/page.tsx` — **new** suite homepage
- `web/src/app/sentry/{iFeeds,iGitHub,iVideos,iChat,iSurprise}/page.tsx` — **new** five landings
- `web/src/app/sentry/pricing/page.tsx` — **new** bundle configurator
- `web/src/app/sentry/manifesto/page.tsx` — **new** "i" story
- `web/src/app/sentry/waitlist/page.tsx` — **new** waitlist form
- `web/src/components/marketing/{Hero,ProductGrid,FeatureGrid,DemoEmbed,StatCounters,FAQ,CrossSell,PricingTable,BundleConfigurator,MagneticButton,ParallaxSection,TaglineStrip}.tsx` — **new**
- `web/src/components/three/{Scene,OrbitingNodes,RepoGlobe,VideoCarousel3D,ChatOrb,SerendipityField}.tsx` — **new**

### Phase 3 (app rename)
- Move all `web/src/app/{feed,chat,github-feed,video-feed,surprise,topics,sources,article,predictions}/...` → `web/src/app/{iFeeds,iGitHub,iVideos,iChat,iSurprise}/...`
- `web/next.config.ts` — add `redirects()`
- `web/src/middleware.ts` — add `/sentry` to PUBLIC_PREFIXES
- `web/src/components/shell/Sidebar.tsx` — update PRIMARY_NAV hrefs
- `web/src/components/shell/BottomNav.tsx` — update tab hrefs
- `web/src/app/page.tsx` — change authed redirect to `/iFeeds`

### Phase 4 (settings split)
- `prisma/schema.prisma` — add `UserSettings` model
- `web/src/app/api/settings/[product]/route.ts` — **new**
- `web/src/app/{iFeeds,iGitHub,iVideos,iChat,iSurprise}/settings/page.tsx` — **new**
- `web/src/app/settings/page.tsx` — slim to global only

### Phase 5 (free tier)
- `web/src/lib/budget.ts` — extend `checkBudgetBeforeChat` → `checkBudgetBeforeProductCall`
- `web/src/lib/entitlements.ts` — **new** stub
- `web/src/components/shell/UsageMeter.tsx` — **new**
- OAuth callback — set `User.monthlyCapUsd = 1.00` on signup

### Phase 7 (a11y)
- `web/eslint.config.mjs` (or `.eslintrc`) — `jsx-a11y` plugin
- `web/.pa11yci.json` — **new** scan config
- `.github/workflows/a11y.yml` (if CI exists) — **new**

---

## Existing utilities/components to REUSE (not re-build)

Verified during exploration:
- **Auth**: `requireUserId()` from `web/src/lib/user.ts` — every new API route uses this.
- **Session**: `getUserId()` and `is_auth` cookie handling from `web/src/lib/session.ts`.
- **Budget guard**: `checkBudgetBeforeChat()` from `web/src/lib/budget.ts` — generalize for all products.
- **Cost logging**: `CostLog` Prisma model — already per-`userId`, no schema change needed for free-tier tracking.
- **UI primitives**: `Button`, `Card`, `EmptyState`, `FormInput`, `LoadingState`, `Pagination`, `SearchInput`, `SegmentTabs` from `web/src/components/ui/` — refactor in place (keep API stable, swap colors + add motion).
- **Logo**: `InfoSentryLogo` from `web/src/components/shell/InfoSentryLogo.tsx` — palette swap, keep variants.
- **Animation classes**: existing CSS keyframes (`fade-in`, `slide-up`) become the reduced-motion fallback for new framer-motion variants.
- **Notifications system**: existing `<Notifications bell>` in Sidebar — just rewrap with `<LiveRegion>` for SR users.
- **Existing landing page**: `web/src/app/page.tsx` already has hero/features/use-cases — copy structure into the new `/sentry/page.tsx`, swap palette + add motion + add the `i=` cycler.

---

## Verification

After each phase, verify end-to-end:

### Phase 0
```bash
cd web && npm install
npm run lint    # should now run jsx-a11y rules
npm run dev     # confirm site still loads
```

### Phase 1
- Open `http://localhost:3000/sentry` → suite homepage renders with violet aurora,
  cycling `i =` text, five product cards.
- Toggle DevTools "Emulate CSS prefers-reduced-motion: reduce" → animations pause /
  static fallback shows.
- Tab through hero — focus ring visible on every CTA.
- VoiceOver "Read all" — page reads coherently, "i =" announces each new word.

### Phase 2
- Visit each of `/sentry/iFeeds`, `/sentry/iGitHub`, `/sentry/iVideos`, `/sentry/iChat`,
  `/sentry/iSurprise` — all eight sections render, 3D centerpiece appears (or static
  SVG with reduced-motion).
- Lighthouse score: Accessibility ≥ 95, Performance ≥ 80.
- `npx pa11y-ci` clean exit.

### Phase 3
- `curl -I localhost:3000/feed` → 308 to `/iFeeds`.
- Same for `/chat`, `/github-feed`, `/video-feed`, `/surprise`.
- Sidebar links go to new paths; click each and confirm the right page renders.
- Sign in flow lands on `/iFeeds`.

### Phase 4
- `npx prisma migrate dev --name user_settings` (watch ownership — see README).
- Open `/iChat/settings`, change model preference, refresh — value persisted.
- Global `/settings` shows only profile/billing/admin sections.

### Phase 5
- Set a test user's `monthlyCapUsd = 0.01`, make a chat call → 429 with friendly modal.
- `<UsageMeter>` in sidebar shows correct fraction.

### Phase 6
- All `Card` hovers have subtle tilt; reduced-motion turns them off.
- Page transitions smooth between routes; no jank.

### Phase 7
- `pa11y-ci` zero violations on all listed URLs.
- Manual VoiceOver pass on each marketing + app page.
- Lighthouse A11y ≥ 95 on every URL.

---

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Prisma migration fails with "must be owner of table" | Switch `DATABASE_URL` to `infosentry` owner credentials for migration, or apply SQL manually and `prisma migrate resolve --applied`. Documented in README. |
| 3D centerpieces blow JS bundle | Lazy-load each via `next/dynamic({ ssr: false })`; budget 50 draw calls / 30k tris; ship static SVG fallback. |
| Framer Motion bundle size | Tree-shake by importing from `framer-motion/dom`; preferred for app routes where only a subset is used. |
| Renaming app routes breaks deep links | Permanent 308 redirects via `next.config.ts`. Grep for any hardcoded internal links before deploying. |
| Violet on dark looks "edgy/gamer" not "premium" | Constrain saturation; use `var(--violet-300)` for surfaces and reserve `--violet-500/600` for actions only. Sora display font sets a premium tone. |
| A11y regressions sneak in over time | CI gate on jsx-a11y + pa11y + Lighthouse score; non-negotiable. |
| Suite homepage and landing pages diverge in style | All landings share `<ProductHero>`, `<FeatureGrid>`, etc. — same shell, different content + 3D scene. |
| Stripe schema doesn't fit when added | Locked the schema design in Phase 8 above before any code; revisit only if Stripe's data model genuinely demands it. |

---

## Out of scope (explicitly)

- Actual Stripe Checkout integration — deferred.
- Email infrastructure for waitlist (use a simple form post → DB row for now).
- Public roadmap / changelog pages — can come later.
- Multi-language support — English only for v1.
- Light mode — dark-violet only, by design.
- Mobile native apps.

---

## Open questions to revisit during implementation

1. **Bundle pricing curve** — the formula in Phase 8 is illustrative; pick actual
   numbers when Stripe lands. Will need a brief marketing/competitive review.
2. **Free-tier semantics** — $1/month *combined* makes economic sense but may feel
   constraining for users who only use iSurprise (effectively unlimited for them).
   Consider tiering free differently per product later.
3. **Sora vs Geist vs Space Grotesk** — pick the display font after a side-by-side
   mock; Sora is the default in this plan because it pairs well with Inter and reads
   geometric/modern.
4. **Suite homepage at `/` vs `/sentry`** — for now both exist; once `/sentry` is
   live, consider redirecting `/` to `/sentry` for cleaner SEO.
