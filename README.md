# Nordic Cabin

A scroll-driven landing page for a minimalist, off-grid cabin above a quiet Norwegian fjord. Built as a single static page with a scroll-scrubbed hero video and a series of scroll-linked reveals and transitions.

## Tech stack

- **[Vite](https://vitejs.dev/)** — dev server & build (vanilla JS, no framework)
- **[GSAP](https://gsap.com/)** + ScrollTrigger + SplitText — scroll-linked animation and heading line-masks
- **[Lenis](https://lenis.darkroom.engineering/)** — inertia smooth scrolling, driven by the GSAP ticker and wired to ScrollTrigger

No build step beyond Vite; all animation is progressive-enhancement over semantic HTML.

## Getting started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
```

## Build & preview

```bash
npm run build        # → dist/  (base "/", for a root deploy or local preview)
npm run build:pages  # → dist/  (base "/nordic-cabin/", for GitHub Pages)
npm run preview      # serve the last build locally
```

## Deployment

The site is a static bundle. `npm run build:pages` produces `dist/` with the
`/nordic-cabin/` base path expected by the GitHub Pages project site
(`dreamyard-io/nordic-cabin`). Publish the contents of `dist/` to GitHub Pages.

## Structure

```
index.html      # markup + <head> (fonts, anti-flash JS, favicon)
src/main.js      # all behaviour: Lenis, scroll effects, reveals, nav, cursor
src/style.css    # design tokens (:root) + all styles, mobile-last responsive
public/          # images, hero video, poster
```

### How it works (highlights)

- **Hero** — a muted `<video>` whose `currentTime` is scrubbed by scroll
  position (ScrollTrigger). A poster + touch-gated priming keeps it painting on
  iOS.
- **Reveals** — copy fades in via IntersectionObserver; section headings reveal
  line-by-line from behind a clip (SplitText `mask: "lines"`); row images
  uncover with a CSS clip-path transition.
- **The Cabin gallery** — pins full-screen and pans sideways through the images
  (horizontal scroll), falling back to native swipe on mobile / reduced motion.
- **Fjord "expand"** — a constrained photo grows to full-bleed on scroll, then
  dissolves into the dark section below via a gradient veil.
- **Smart nav** — hides on scroll-down, inverts colour per section, marks the
  active link.
- **Anti-flash** — an inline `<head>` script adds `.js` before paint so animated
  elements can be pre-hidden; without JS the page stays fully visible.

Responsive behaviour and the pin/pan gallery are wired through `gsap.matchMedia`,
so resizing across the breakpoint swaps modes live. Everything honours
`prefers-reduced-motion`.
