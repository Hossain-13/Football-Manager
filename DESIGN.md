# Design

> Target visual system for the TURF redesign (not a capture of the current build). Synthesized
> from the confirmed references: FotMob / SofaScore (live cards, standings), a Dribbble-style
> tactics board (formation), Splitwise (fee split), Linear + Strava (shell, type confidence,
> dark-theme restraint). One system, applied identically across all 13 screens.

## Theme

Dark-first, broadcast-grade. **Neutral charcoal chrome** (Linear/FotMob night) so the brand
green, team colors, and live states carry all the energy. Football soul stays as a deliberate
"on the field" motif — real-grass pitch gradients on the Formation board, the Live hero, and the
session-card texture — never as the app's surface color. The scene: a friend on the touchline,
phone in one hand, daylight glare, wanting the score and clock readable at a glance.

## Color

OKLCH-authored, listed as hex for the token file. **AA verified** (body >=4.5:1, large >=3:1).

### Surfaces (neutral, faint cool tint)
- `--bg`        `#0A0C10`  app background (near-black, slight cool)
- `--surface-1` `#14171D`  cards / panels
- `--surface-2` `#1B1F27`  raised: inputs, inner rows, hover targets
- `--surface-3` `#232A35`  active/hover, dropdowns
- `--line`      `rgba(255,255,255,.10)`   `--line-soft` `rgba(255,255,255,.055)`

### Pitch family (football motif ONLY — pitch, timer hero, formation, card texture)
- `--pitch-deep` `#0A2A1F`   `--pitch` `#0E3D2C`   grass gradient stops + chalk lines `rgba(245,247,250,.5)`

### Ink
- `--ink`      `#F5F7FA`   primary text
- `--ink-dim`  `#C2CAD4`   secondary (AA on all surfaces)
- `--ink-mute` `#929BA8`   tertiary/labels (AA on surface-1/2 — replaces the old faint .40 which failed)

### Roles (color = meaning)
- `--live` / brand  `#13E08A`  live state, brand mark, primary CTA (electric pitch green)
- `--info`          `#4C9DFF`  organizer / informational
- `--warn`          `#FFC53A`  locked / due
- `--danger`        `#FF5C5C`  out / destructive
- `--paid` = `--live`; `--in` = `--live`; `--out` = `--danger`

### Team jersey colors (vivid on dark; never hue-alone)
`--t-red #F0565B  --t-blue #4C86FF  --t-amber #F5A623  --t-violet #A982FF  --t-teal #21C9AC`
Colorblind rule: a team color is **always** paired with its name or jersey initial (dot + label,
bead + number). Hue never carries meaning by itself.

## Typography

Pair on a contrast axis (condensed display + humanist body); never two similar sans.
- **Display** `Oswald` — headings, scores, clock, points, team names. Broadcast condensed.
- **Body** `Hanken Grotesk` — UI text, paragraphs, labels.
- **Mono** `JetBrains Mono` — codes, timestamps, stat eyebrows, fixture times.
- **Numbers** `font-variant-numeric: tabular-nums` everywhere numbers move (scores, clock, table,
  money, countdowns). Numbers are the loudest type in the app.
- Scale (display clamp ceilings): score `clamp(56px,13vw,104px)`, clock `clamp(72px,16vw,128px)`,
  page H1 28-32px, section 13px tracked. `text-wrap: balance` on H1-H3. Body line-length <=72ch.
- Display letter-spacing floor `-0.02em`; no tighter.

## Spacing & Shape

- 4px base scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48. Vary spacing for rhythm; tighten data
  rows (FotMob/SofaScore density), breathe around heroes.
- Radius: `--r-pill 999` · cards `14` · controls/inputs `10` · chips `7`. Slightly tighter than now.
- Elevation: full 1px borders + soft shadow `0 6px 18px rgba(0,0,0,.35)`; reserve the green `--glow`
  exclusively for the live timer/score. No glow as decoration.

## Components (maps to existing class names — restyle, don't rename)

- **Shell** (`.sidebar` / `.topbar` / `.tabbar`): Linear-quiet. Neutral charcoal, hairline dividers,
  active nav = subtle green tint + green icon. Bottom tab bar is the matchday primary on mobile.
- **Live hero** (`.timer`, `.scoreboard`, `.scorebox`): the FotMob big-score moment — pitch-tinted
  card, giant tabular score, pulsing live dot, minute clock, team color bars. The app's signature.
- **Standings** (`.standings`): SofaScore table — sticky header, qualify-zone band + green edge,
  tabular nums, GD pos/neg color, dense rows.
- **Fixtures** (`.fixture`): timeline rows, live row gets the green inset edge + tint.
- **Formation** (`.pitch`, `.token`): real-grass gradient, chalk lines, jersey-number beads with
  name tags, captain armband, clear drag affordance.
- **Expenses** (`.kv`, `.pay-row`, pills): Splitwise clarity — owed/paid/settle states, a collected
  progress bar, per-head split obvious at a glance.
- **Cards/pills/buttons/inputs** (`.card`/`.pill`/`.btn`/`.input`/`.seg`): neutral surfaces, AA text,
  one green primary action per view; avoid identical card grids — use lists/tables where denser.

## Motion

- Easing: ease-out-expo (`cubic-bezier(.16,1,.3,1)`); no bounce/elastic.
- Signature motions: live dot pulse, score tick (scale-pop on change), timer bar fill, nav/tab
  active slide, list stagger on first paint (subtle).
- **Reduced motion is mandatory** (chosen A11y bar): every animation has a
  `@media (prefers-reduced-motion: reduce)` crossfade/instant fallback. Pulses become static.
- z-index scale (named, no 999): dropdown 100 · sticky 200 · backdrop 300 · modal 400 · toast 500 ·
  tooltip 600.

## Accessibility

WCAG AA contrast on every text/control; reduced-motion fallbacks everywhere; colorblind-safe team
coding (color + label always); matchday touch targets >=44px (score steppers, clock, av-toggles).
