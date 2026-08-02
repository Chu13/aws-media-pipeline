# Ember — Brand Guidelines

**Product:** the serverless AWS image-optimization pipeline currently
codenamed "Media Pipeline" / "Level 06" (live at
https://d1xrhd1t6kp6bq.cloudfront.net). This document replaces the
placeholder name with a real, independent brand — its own name, palette,
type, and voice, deliberately not inherited from jabordones.com's
oklch/arcade design system.

---

## 1. Name

### Recommendation: **Ember**

An ember is the honest visual truth of what this tool does: something goes
in hot and active, glows brightly while real work happens to it, and then —
on a real, physical, unforced timescale — burns down to nothing. That is
almost exactly the product's lifecycle: a file is uploaded, a pipeline you
can watch actually process it, and within about an hour it is gone, on
purpose, without you having to ask. Unlike a purely descriptive name like
"Media Pipeline," Ember is one word, one syllable in practice, and gives the
whole identity — color, logo, even the deletion copy — a single physical
metaphor to hang off of instead of three separate ideas competing for
attention.

**Tagline:** *Smaller images. Shorter memory.*

Reads two ways: your files get physically smaller (byte savings), and the
system itself has almost no memory of you (no accounts, no persistence, a
genuine ~60-minute lifespan). Use it as the primary tagline in headers,
`<meta name="description">`, and OG cards. A longer descriptive line for
contexts that need more explanation (e.g. an about section):

> A serverless AWS pipeline that optimizes your image in seconds — and lets
> it go within the hour, on purpose.

### Ranked shortlist (if Ember doesn't stick)

1. **Ember** *(recommended)* — glow, heat, real work, then a clean fade.
   Ties name → color → logo → copy into one metaphor.
2. **Spool** — a film spool (photographic heritage) *and* a genuine
   computing term: "spooling" is literally what a queued background job is
   called. Good technical-insider credibility, slightly cooler/more
   mechanical tone than Ember, weaker connection to the self-destruct fact.
3. **Kiln** — a contained, heat-driven, time-boxed transformation you can
   watch through a window. Strong craft/warmth read, but the fastest of the
   three to feel more decorative than literal once you know what the
   product does.

**Naming/collision notes (worth two minutes before anyone files anything):**
"Ember" is also the name of a JS framework (Ember.js, declining relevance
by 2026) and a self-heating mug brand (Ember®, housewares — different
trademark class entirely). Neither is a real legal blocker for a portfolio
project, but if this ever became a commercial product, run a proper
clearance search and check domain/social handle availability before
committing. "Spool" and "Kiln" both have minor, mostly-defunct historical
software-product uses — same advice applies.

---

## 2. Positioning & Voice

Ember talks like the engineer who built it, not like a marketing team hired
to describe it. It states real numbers instead of vague superlatives — "6
variants, 87% smaller," not "blazing-fast compression" — because the numbers
are actually true and more convincing than any adjective would be. It treats
its own honesty as the pitch: the file never touches a server anyone runs,
the pipeline is something you can watch happen in real time instead of
trusting a spinner, and the ~60-minute self-destruct is stated plainly as an
engineered guarantee, not apologized for as a limitation. Warmth comes from
directness and quiet confidence — the tone of someone who enjoys the craft
and is happy to tell you exactly what's happening and why — never from
forced cheerfulness, exclamation points, or generic "your privacy matters!"
boilerplate.

---

## 3. Color

**Theme: dark-first, effectively dark-only.** The current UI is dark-mode
only, and this identity should stay that way rather than add a light theme.
The core visual idea — a warm glow against near-black — only means anything
against dark. A light-mode version would need an entirely different visual
metaphor (there's no "glow" on white), which would dilute rather than
extend the brand. If a light mode is ever required for a specific embed
context, use the fallback stubs at the bottom of this section rather than
inventing new colors — but don't build it unless something concrete forces
the issue.

### Primary (dark) palette

| Token | Hex | Role |
|---|---|---|
| `--ember-bg` | `#120E0D` | Page background — warm near-black, not neutral gray or cool blue-black |
| `--ember-surface` | `#1D1613` | Cards, panels, the dropzone |
| `--ember-surface-raised` | `#271C17` | Hover/active surface state, raised panels |
| `--ember-border` | `#3A2C24` | Borders, dividers, dropzone dashed outline (idle state) |
| `--ember-primary` | `#FF6B35` | Primary accent — active dropzone border, primary buttons, links, focus ring, the "processing" status color |
| `--ember-primary-hover` | `#E5551F` | Hover/pressed state of primary actions |
| `--ember-glow` | `#FFB454` | Secondary accent — logo glow/highlight, badge backgrounds, subtle gradients; also the safer choice for small link text where the saturated primary is a touch too warm |
| `--ember-success` | `#45C4A0` | Savings percentages, "ready" status, checkmarks — deliberately a cooled teal-green (not a generic green) so it reads as "resolved" against the hot orange of "in progress" |
| `--ember-danger` | `#E5484D` | Rejected uploads, error status, validation messages |
| `--ember-ink` | `#F5EDE7` | Primary text — warm off-white, not pure white |
| `--ember-muted` | `#B3A399` | Secondary text, captions, hints |
| `--ember-faint` | `#7A6C63` | Disabled text, placeholder text |

**Manifest-state mapping** (the product already has exactly three states —
this gives them a fixed color each): `processing` → `--ember-primary`
(pulsing/active), `ready` → `--ember-success`, `error` → `--ember-danger`.

**Contrast, checked against `--ember-bg` (#120E0D):**

| Foreground | Ratio | Passes |
|---|---|---|
| `--ember-ink` (#F5EDE7) | ~18.7:1 | AAA, any size |
| `--ember-muted` (#B3A399) | ~7.9:1 | AAA, any size |
| `--ember-primary` (#FF6B35) | ~6.8:1 | AA normal text, AAA large text |
| `--ember-success` (#45C4A0) | ~8.8:1 | AAA, any size |
| `--ember-danger` (#E5484D) | ~4.9:1 | AA normal text (use at ≥14px, or pair with ink for body copy) |

### Light-mode fallback (not recommended — only if a real requirement forces it)

| Token | Hex | Role |
|---|---|---|
| `--ember-bg-light` | `#FAF6F2` | Warm off-white background |
| `--ember-surface-light` | `#FFFFFF` | Cards/panels |
| `--ember-border-light` | `#E4D7CB` | Borders |
| `--ember-primary-light` | `#D9491D` | Deepened ember for sufficient contrast on white |
| `--ember-success-light` | `#1F8F72` | Deepened teal-green |
| `--ember-danger-light` | `#C8323A` | Deepened red |
| `--ember-ink-light` | `#241B17` | Primary text |
| `--ember-muted-light` | `#7A6C63` | Secondary text |

---

## 4. Typography

| Role | Typeface | Weights | Notes |
|---|---|---|---|
| Display / headings | **Space Grotesk** (Google Fonts) | 500, 700 | Geometric-but-humanist sans with just enough character (the two-story `t`, the slightly squared bowls) to avoid reading as a generic dashboard template, while staying fully legible at small sizes. Used for `h1`/`h2`, the wordmark, and section labels. |
| Body / UI | **IBM Plex Sans** (Google Fonts) | 400, 500, 600 | More character than Inter/system-ui without sacrificing legibility; pairs cleanly with Space Grotesk since both come from a similarly geometric-humanist school. Used for paragraphs, buttons, labels, status text. |
| Data (recommended addition) | **IBM Plex Mono** (Google Fonts) | 400, 500 | Not part of the strict two-font pairing, but worth adopting for anything numeric — byte sizes, savings percentages, dimensions (`1920×1280`), the countdown to deletion. Monospaced numbers are a small, real signal of "this is actual infrastructure output," which is exactly the credibility this brand is going for. |

Fallback stack for all three:
`'<Font>', 'Segoe UI', system-ui, -apple-system, sans-serif` (mono:
`'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace`). Both Space
Grotesk and IBM Plex Sans/Mono are free, self-hostable Google Fonts —
no licensing friction for a low-traffic serverless tool that wants to keep
its own asset footprint (and cold-start weight) small.

---

## 5. Logo

**File:** [`logo.svg`](./logo.svg)

### Rationale

The mark is a glowing ember with two small sparks lifting off it —
literally the brand name, and literally the two facts the whole product is
built on: something is actively, visibly *working* (the glow — the pipeline
you can watch process your file in ~12–24 seconds), and it is not going to
last (a spark is definitionally brief). The icon carries all the color; the
wordmark is set in the neutral warm-ink color rather than in ember-orange,
so the lockup stays legible and doesn't fight itself when it's shrunk down
or placed on unpredictable backgrounds (an OG card, a browser tab, a
portfolio case-study page it doesn't control). This is the same division of
labor as most mark+wordmark logos that hold up at small size: the icon is
allowed to be expressive because it's simple geometry, and the wordmark
stays quiet because at 120px wide, decoration in the type just turns into
noise.

### Clearspace

Minimum clearspace on all four sides of the full lockup equals the height
of the icon's main ember shape (i.e., don't let anything — text, edges of a
container, another logo — sit closer than "one ember-height" away). Inside
a fixed-size container like the CloudFront app header or an OG card, that
usually just means: don't let the dropzone or nav crowd the top of the logo.

### Minimum legible size

- **Full lockup (icon + "ember" wordmark):** don't render narrower than
  **120px wide**. In the actual 768px-wide iframe embed, the comfortable
  working size is **140–180px wide** in the header — legible with room
  left for the tagline and dropzone underneath.
- **Icon alone** (favicon, browser tab, avatar, a cropped social thumbnail):
  don't go below **24px**. At true favicon size (16px), drop the two spark
  flecks entirely and ship just the glowing core shape — at that size the
  sparks read as noise, not detail.

### Production note

The wordmark in `logo.svg` is set as real `<text>` (Space Grotesk, with
system-font fallbacks) rather than hand-drawn letterforms, which is
completely normal for a logo file at this stage — but before this ships in
the real product, convert the text to outlined paths using the actual
Space Grotesk font file. That guarantees pixel-identical rendering
everywhere (including anywhere Space Grotesk isn't installed/loaded) and is
the point where a designer should also do a final pass on kerning and
optical baseline alignment against the icon.

---

## 6. Voice & copy examples

These are meant to be usable close to verbatim in the real UI — they
replace generic status copy with the brand's actual point of view.

**1. While the pipeline is running** (replaces a generic "Processing..."):

> Uploading straight to S3 — no server of ours in between.
>
> *(a beat later, once the manifest shows `processing`)*
>
> Sharp is generating six variants right now. Usually 12–24 seconds.

**2. On success** (replaces a generic "Done!"):

> Done — six variants, up to 87% smaller. See for yourself below.

*(Keep the actual number live — "up to N%" should reflect the best result
in that run, not a fixed marketing figure.)*

**3. The self-destruct notice** (this is the money line — the footer/legal
copy should sound proud of this, not apologetic):

> Nothing here outlives the hour. This file, and every variant we made from
> it, is deleted automatically in about 60 minutes — a real schedule, not a
> promise. No account, no download you forgot about, nothing left to find
> later.

**Bonus — a rejected upload** (validation error, same voice, still warm even
when saying no):

> That file's over 10MB. Trim it down or split it up and try again — same
> pipeline, same wait either way.

---

**Status:** ready for implementation. Everything above is scoped to this
tool's own identity — nothing here assumes or depends on jabordones.com's
existing design system.
