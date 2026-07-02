import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

// ---- Lenis smooth scroll ----
// Inertia-based smooth scrolling that everything else rides on. Driven by a
// single GSAP ticker loop and wired to ScrollTrigger so the hero video-scrub
// (and any scroll-linked motion) stays perfectly in sync. Disabled for
// reduced-motion so those users get plain, instant native scrolling.
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

let lenis = null;
if (!prefersReducedMotion) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic — the site's motion curve
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

// ---- Mobile hamburger menu ----
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav__toggle");

toggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});

// Scroll to the target section (via Lenis when active), and close the mobile
// menu after tapping.
nav?.querySelectorAll(".nav__menu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#") && href.length > 1) {
      const target = document.getElementById(href.slice(1));
      if (target) {
        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(target, { offset: 0 });
        } else {
          // lenis is only null under reduced motion → jump, don't animate.
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }
    }
    nav.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  });
});

// ---- Placeholder & home links ----
// Bare "#" links (wordmarks, CTAs with no destination yet) must not jump the
// page to the top via the default hash navigation. The wordmarks scroll home
// smoothly instead; the placeholder CTAs simply do nothing.
document.querySelectorAll('a[href="#"]').forEach((a) => {
  const isWordmark =
    a.classList.contains("nav__wordmark") ||
    a.classList.contains("footer__wordmark");
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isWordmark) return;
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: "auto" });
  });
});

const video = document.getElementById("hero");

// Make sure the video never plays on its own.
video.pause();
video.removeAttribute("autoplay");

// iOS/Safari won't paint frames from currentTime seeking on a video that has
// never played — it stays black. A brief muted play "primes" the decoder so the
// scrub renders; the poster covers the page until then. Only touch devices need
// this (desktop seeks natively), so it's gated to avoid a playback flicker there.
if (window.matchMedia("(hover: none), (pointer: coarse)").matches) {
  const primeVideo = () => {
    const p = video.play();
    if (p && typeof p.then === "function") {
      p.then(() => video.pause()).catch(() => {});
    } else {
      try {
        video.pause();
      } catch (e) {}
    }
  };
  video.addEventListener("canplay", primeVideo, { once: true });
  ["touchstart", "pointerdown"].forEach((ev) =>
    window.addEventListener(ev, primeVideo, { once: true, passive: true })
  );
}

// We need the metadata (duration) before we can map scroll -> currentTime.
function setupScrub() {
  const duration = video.duration;

  // Proxy object we tween; ScrollTrigger drives `frame`, the onUpdate
  // writes it onto the actual video element.
  const state = { frame: 0 };

  gsap.to(state, {
    frame: duration,
    ease: "none",
    onUpdate: () => {
      // Guard against seeking while a previous seek is still in flight.
      if (video.readyState >= 2) {
        video.currentTime = state.frame;
      }
    },
    scrollTrigger: {
      trigger: "#scrub",
      start: "top top",
      end: "bottom bottom",
      scrub: true, // ties progress directly to scroll position
    },
  });
}

if (video.readyState >= 1 && !Number.isNaN(video.duration)) {
  setupScrub();
} else {
  video.addEventListener("loadedmetadata", setupScrub, { once: true });
}

// ---- Entrance animation convention ----
// One curve (easeOutCubic) and rhythm shared by every entrance. Three flavours:
// fades for copy, line-masks for the big headings, clip reveals for images.
const REVEAL = {
  duration: 0.8,
  ease: "power2.out", // easeOutCubic — same curve as the CSS --ease token
  y: 24,
  stagger: 0.1,
  threshold: 0.15,
};

const noIO = !("IntersectionObserver" in window);

// (1) Generic fades — eyebrows, body copy, stats, buttons. Headings and the big
// images get their own (mask / clip) reveals below, so they're excluded here.
const revealGroups = [
  { root: ".cabin__inner", items: ".cabin__eyebrow, .cabin__lede, .cabin__cols" },
  { root: ".interior__head", items: ".cabin__eyebrow" },
  { root: ".row", items: ".row__text" },
  { root: ".why__intro", items: ".why__title, .why__text" },
  { root: ".why__stats", items: ".why__stat" },
  { root: ".interior__cta", items: ".cta" },
  { root: ".location__inner", items: ".cabin__eyebrow, .location__lede, .location__stats" },
  { root: ".loc-feature__data", items: ".loc-data" },
  { root: ".book__inner", items: ".cabin__eyebrow, .book__lede, .book__btn, .book__direct" },
];

function initReveals() {
  const arm = (root, itemSel) => {
    const found = root.querySelectorAll(itemSel);
    const targets = found.length ? found : [root];

    if (prefersReducedMotion || noIO) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(targets, { opacity: 0, y: REVEAL.y });
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          gsap.to(targets, {
            opacity: 1,
            y: 0,
            duration: REVEAL.duration,
            ease: REVEAL.ease,
            stagger: REVEAL.stagger,
            overwrite: true,
          });
          obs.disconnect();
        });
      },
      { threshold: REVEAL.threshold }
    );
    io.observe(root);
  };

  revealGroups.forEach(({ root, items }) => {
    document.querySelectorAll(root).forEach((el) => arm(el, items));
  });
}

// (2) Heading line masks — section titles reveal line-by-line from behind a
// clip, the signature typographic move. SplitText's autoSplit waits for fonts
// and re-splits on resize. (The hero title is handled in the load intro.)
function initHeadingMasks() {
  gsap.utils.toArray(".cabin__title").forEach((title) => {
    if (prefersReducedMotion) {
      gsap.set(title, { opacity: 1 });
      return;
    }
    SplitText.create(title, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) => {
        gsap.set(title, { opacity: 1 }); // undo the .js anti-flash hide
        return gsap.from(self.lines, {
          yPercent: 170, // starts below the extended clip box (no peek)
          duration: 0.9,
          ease: REVEAL.ease,
          stagger: 0.12,
          scrollTrigger: { trigger: title, start: "top 85%", once: true },
        });
      },
    });
  });
}

// (3) Image clip reveals — images uncover from the bottom up with a subtle
// scale-down. The clip-path + transition live in CSS (native clip-path
// interpolation is reliable cross-browser, unlike animating it via JS); here we
// just add .is-revealed when each image's frame scrolls in.
function initImageReveals() {
  if (prefersReducedMotion) return; // CSS media query shows them, no motion

  const frames = gsap.utils.toArray(".row__media");

  if (noIO) {
    frames.forEach((f) => f.querySelector("img")?.classList.add("is-revealed"));
    return;
  }

  frames.forEach((frame) => {
    const img = frame.querySelector("img");
    if (!img) return;
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          img.classList.add("is-revealed");
          obs.disconnect();
        });
      },
      { threshold: REVEAL.threshold }
    );
    io.observe(frame);
  });
}

initReveals();
initHeadingMasks();
initImageReveals();

// ---- Hero: on-load intro ----
// Plays once on load: nav drops in, the headline rises line-by-line from behind
// a mask, then the lede fades up. The .js anti-flash class keeps these hidden
// until this runs (and shows everything instantly for reduced-motion).
function setupHero() {
  const navEl = document.querySelector(".nav");
  const title = document.querySelector(".hero__title");
  const lede = document.querySelector(".hero__lede");
  if (!title) return;

  if (prefersReducedMotion) {
    gsap.set([navEl, title], { opacity: 1, y: 0 });
    gsap.set(lede, { opacity: 0.92, y: 0 });
    return;
  }

  const heroSplit = SplitText.create(title, { type: "lines", mask: "lines" });
  gsap.set(title, { opacity: 1 }); // undo anti-flash; lines stay hidden below
  gsap.set(heroSplit.lines, { yPercent: 170 });
  gsap.set(navEl, { opacity: 0, y: -12 });
  gsap.set(lede, { opacity: 0, y: 20 });

  gsap
    .timeline({ defaults: { ease: REVEAL.ease } })
    .to(navEl, { opacity: 1, y: 0, duration: 0.7 }, 0.15)
    .to(heroSplit.lines, { yPercent: 0, duration: 0.9, stagger: 0.12 }, 0.3)
    // lede's resting opacity is 0.92 by design — animate to that, not 1.
    .to(lede, { opacity: 0.92, y: 0, duration: 0.8 }, 0.55);
}

// (Hero intro is kicked off by the preloader sequence below, not here.)

// ---- Hero: scroll parallax ----
// As you scroll the sticky video section, the hero copy drifts up and fades —
// a subtle parallax against the (scrubbing) video behind it. The .hero element
// has no other persistent transform, so this won't fight the load intro.
function setupHeroParallax() {
  if (prefersReducedMotion) return;
  const hero = document.querySelector(".hero");
  if (!hero) return;

  gsap
    .timeline({
      scrollTrigger: {
        trigger: "#scrub",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
      defaults: { ease: "none" },
    })
    // Gentle drift — just a subtle lift, not a big slide.
    .fromTo(hero, { y: 0 }, { y: -30 }, 0)
    .to(hero, { opacity: 0 }, 0.75); // fade out only over the final stretch
}

setupHeroParallax();

// ---- Custom cursor ----
// A small dot that trails the pointer, grows into a ring over links, and opens
// into a labelled "Book" disc over the images. Mouse devices only; the native
// cursor is hidden once it's live.
function setupCursor() {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "cursor__label";
  cursor.appendChild(label);
  document.body.appendChild(cursor);

  gsap.set(cursor, { xPercent: -50, yPercent: -50 });
  // Reduced motion → snap to the pointer; otherwise trail smoothly.
  const dur = prefersReducedMotion ? 0 : 0.35;
  const xTo = gsap.quickTo(cursor, "x", { duration: dur, ease: "power3.out" });
  const yTo = gsap.quickTo(cursor, "y", { duration: dur, ease: "power3.out" });

  let live = false;
  window.addEventListener("pointermove", (e) => {
    if (!live) {
      gsap.set(cursor, { x: e.clientX, y: e.clientY });
      gsap.to(cursor, { opacity: 1, duration: 0.3 });
      document.documentElement.classList.add("has-cursor");
      live = true;
    }
    xTo(e.clientX);
    yTo(e.clientY);
  });

  // Tag the elements that get a labelled cursor — the images route to booking,
  // so they read "Book". (The CTA button keeps the plain dot, no label/ring.)
  document
    .querySelectorAll(".row__media, .hgal__item")
    .forEach((el) => (el.dataset.cursor = "Book"));

  // Labelled targets (the images).
  document.querySelectorAll("[data-cursor]").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      label.textContent = el.dataset.cursor;
      cursor.classList.add("has-label");
    });
    el.addEventListener("mouseleave", () =>
      cursor.classList.remove("has-label")
    );
  });

  // Plain links / buttons → ring. The CTA button is excluded so it keeps the
  // plain dot (no ring, no label).
  document.querySelectorAll("a, button").forEach((el) => {
    if (
      el.hasAttribute("data-cursor") ||
      el.classList.contains("book__btn") ||
      el.classList.contains("cta")
    ) {
      return;
    }
    el.addEventListener("mouseenter", () =>
      cursor.classList.add("is-interactive")
    );
    el.addEventListener("mouseleave", () =>
      cursor.classList.remove("is-interactive")
    );
  });

  // Hide the dot when the pointer leaves the window.
  document.addEventListener("mouseleave", () =>
    gsap.to(cursor, { opacity: 0, duration: 0.2 })
  );
  document.addEventListener("mouseenter", () =>
    gsap.to(cursor, { opacity: 1, duration: 0.2 })
  );
}

setupCursor();

// ---- Images → scroll to booking ----
// Clicking any image scrolls down to the Book section. Works on every device
// (independent of the custom cursor).
function setupImageBooking() {
  const target = document.getElementById("book");
  if (!target) return;
  const goToBook = () => {
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    // lenis is only null under reduced motion → jump, don't animate.
    else target.scrollIntoView({ behavior: "auto", block: "start" });
  };
  document
    .querySelectorAll(".row__media, .hgal__item")
    .forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", goToBook);
    });
}

setupImageBooking();

// ---- Smart navigation ----
// Hides on scroll down / shows on scroll up, inverts its colour to suit the
// section beneath it, and marks the active section's link.
function setupSmartNav() {
  const navEl = document.querySelector(".nav");
  if (!navEl) return;
  const links = navEl.querySelectorAll(".nav__menu a");

  // (a) Per-section theme + active link, decided by a trip line just under the nav.
  const sections = [
    { sel: "#scrub", theme: "dark", href: null },
    { sel: ".cabin", theme: "light", href: "#cabin" },
    { sel: ".interior", theme: "light", href: "#interior" },
    { sel: ".expand", theme: "dark", href: null },
    { sel: ".location", theme: "dark", href: "#location" },
    { sel: ".book", theme: "dark", href: "#book" },
  ];
  const setState = (theme, href) => {
    navEl.classList.toggle("nav--on-light", theme === "light");
    links.forEach((a) =>
      a.classList.toggle("is-active", !!href && a.getAttribute("href") === href)
    );
  };
  setState("dark", null); // hero default

  sections.forEach(({ sel, theme, href }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: "top top+=60",
      end: "bottom top+=60",
      onToggle: (self) => self.isActive && setState(theme, href),
    });
  });

  // (b) Hide on scroll down, show on scroll up (always shown near the top, and
  //     never hidden while the mobile menu is open). Skipped for reduced motion.
  if (prefersReducedMotion) return;

  let hidden = false;
  const showHide = (h) => {
    if (h === hidden) return;
    hidden = h;
    gsap.to(navEl, { yPercent: h ? -100 : 0, duration: 0.4, ease: "power3.out" });
  };
  const onScroll = (scroll, direction) => {
    if (scroll < 80 || navEl.classList.contains("is-open")) showHide(false);
    else showHide(direction === 1);
  };

  if (lenis) {
    lenis.on("scroll", (e) => onScroll(e.scroll, e.direction));
  } else {
    let last = 0;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      onScroll(y, y > last ? 1 : -1);
      last = y;
    });
  }
}

setupSmartNav();

// ---- Background colour transitions ----
// Smoothly blend the page colour at each light↔dark boundary instead of a hard
// jump: a section entering from a differently-lit neighbour scrubs its own
// background from the neighbour's colour to its own as it scrolls in. The morph
// finishes before the section's content reveals, so text never sits on the
// wrong colour. Sections stay opaque (no-JS still gets the final colours).
function setupBgTransitions() {
  if (prefersReducedMotion) return;
  const dark =
    getComputedStyle(document.documentElement).getPropertyValue("--dark").trim() ||
    "#0d1218";
  const light = "#f5f3ef";

  const morph = (sel, from, to) => {
    const el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(
      el,
      { backgroundColor: from },
      {
        backgroundColor: to,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "top 70%",
          scrub: true,
        },
      }
    );
  };

  morph(".cabin", dark, light); // hero (dark) → The Cabin (light)
  // (No morph into Location: the expand image hands off to the dark section
  //  directly, and scrubbing Location's background caused a visible flash.)
}

setupBgTransitions();

// ---- The Cabin: horizontal-scroll gallery ----
// The strip pins full-screen mid-scroll and pans sideways through all five
// images, then releases back into normal vertical scroll. The section's height
// is stretched to exactly the horizontal travel so scroll maps 1:1 to the pan.
// Mobile / reduced motion keep the CSS native-swipe fallback (no pin).
function setupHGallery() {
  const hgal = document.querySelector(".hgal");
  if (!hgal) return;
  const track = hgal.querySelector(".hgal__track");
  if (!track) return;

  // gsap.matchMedia builds the pin above the breakpoint and, when you resize
  // below it (or into reduced motion), tears it down and reverts the pan to 0 —
  // so crossing the breakpoint live swaps cleanly between pinned pan and the
  // CSS native-swipe fallback, no reload needed.
  const mm = gsap.matchMedia();
  mm.add(
    "(min-width: 861px) and (prefers-reduced-motion: no-preference)",
    () => {
      hgal.classList.add("hgal--pinned");

      const amount = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const setHeight = () => {
        hgal.style.height = window.innerHeight + amount() + "px";
      };
      setHeight();
      // Keep the section height and pan distance in sync on every refresh/resize.
      ScrollTrigger.addEventListener("refreshInit", setHeight);

      gsap.to(track, {
        x: () => -amount(),
        ease: "none",
        scrollTrigger: {
          trigger: hgal,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      // Cleanup when the query stops matching. matchMedia auto-reverts the tween
      // and its ScrollTrigger (resetting the pan); we undo the non-gsap bits.
      return () => {
        ScrollTrigger.removeEventListener("refreshInit", setHeight);
        hgal.classList.remove("hgal--pinned");
        hgal.style.height = "";
      };
    }
  );
}

setupHGallery();

// ---- Location feature: outline drawing drifts in from the right ----
// The house drawing sits flush to the right edge and drifts gently leftward
// (from just off the edge toward centre) as the block scrolls through. Desktop
// only; matchMedia reverts the drift below the breakpoint / for reduced motion.
function setupLocationFeature() {
  const media = document.querySelector(".loc-feature__media");
  if (!media) return;
  gsap.matchMedia().add(
    "(min-width: 861px) and (prefers-reduced-motion: no-preference)",
    () => {
      gsap.fromTo(
        media,
        { xPercent: 4 },
        {
          xPercent: -1,
          ease: "none",
          scrollTrigger: {
            trigger: ".loc-feature",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }
  );
}

setupLocationFeature();

// ---- Expand: fjord image grows to full-bleed ----
// The fjord photo starts constrained (like a normal section image), then — as
// its tall section scrolls through a pinned viewport — scales out to full-bleed
// (100vw × 100vh) while a caption fades in over it, before handing off to the
// dark Location section below. Reduced motion skips the pin/scale and just shows
// the full-bleed end state.
function setupExpand() {
  const section = document.querySelector(".expand");
  if (!section) return;
  const frame = section.querySelector(".expand__frame");
  const veil = section.querySelector(".expand__veil");
  const title = section.querySelector(".expand__title");
  if (!frame) return;

  if (prefersReducedMotion) {
    gsap.set(frame, { width: "100vw", height: "100vh" });
    gsap.set(title, { opacity: 1 });
    section.style.height = "100vh"; // collapse the scroll track — no scrub
    return;
  }

  // Grow to full-bleed over the first ~60% of the track, then hold full-screen
  // for the remainder (the trailing empty tween keeps the timeline mapped 0→1).
  gsap
    .timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true, // recompute the 100vw/100vh targets on resize
      },
      defaults: { ease: "none" },
    })
    // Grow to full-bleed early (~45%), then hold the clean photo for a long
    // stretch before the veil starts — a deliberate pause on the fjord.
    .to(frame, { width: "100vw", height: "100vh", duration: 0.45 }, 0)
    .to(frame, { duration: 0.55 }, 0.45)
    // Dissolve into darkness: the veil only starts late (80%) and ramps to full
    // by the end, so the photo melts seamlessly into the dark Location below.
    .fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.8);

  // Title uses the same line-mask move as the other headings — with autoSplit
  // so a resize re-splits the lines correctly (matching initHeadingMasks). The
  // paused reveal tween is rebuilt on every (re)split, seeded with the current
  // state, and toggled by scroll position so it plays in when the photo is
  // full-bleed and reverses back out when you scroll up past it.
  let reveal = null;
  let shown = false;
  SplitText.create(title, {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    onSplit: (self) => {
      gsap.set(title, { opacity: 1 }); // undo the .js anti-flash hide
      gsap.set(self.lines, { yPercent: 170 }); // parked below the clip
      reveal = gsap.to(self.lines, {
        yPercent: 0,
        duration: 0.9,
        ease: REVEAL.ease,
        stagger: 0.12,
        paused: true,
      });
      if (shown) reveal.progress(1); // keep the revealed state across re-splits
      return reveal; // returned → SplitText reverts it before re-splitting
    },
  });
  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      shown = self.progress >= 0.45;
      if (!reveal) return;
      if (shown) reveal.play();
      else reveal.reverse();
    },
  });
}

setupExpand();

// ---- Intro preloader ----
// Counts up while the page settles, then lifts away and hands off to the hero
// intro. Scroll is locked underneath it. Skipped for reduced motion (and when
// JS-disabled the panel is never shown in the first place).
function setupPreloader() {
  const pre = document.querySelector(".preloader");

  // Both guarded so they run exactly once, whichever path gets there first.
  let heroStarted = false;
  const startHero = () => {
    if (heroStarted) return;
    heroStarted = true;
    setupHero();
  };
  let finished = false;
  const finalize = () => {
    if (finished) return;
    finished = true;
    pre?.remove();
    if (lenis) lenis.start();
    startHero();
  };

  if (!pre || prefersReducedMotion) {
    finalize();
    return;
  }

  if (lenis) lenis.stop();

  const word = pre.querySelector(".preloader__word");
  const count = pre.querySelector(".preloader__count");
  const bar = pre.querySelector(".preloader__bar");
  const counter = { v: 0 };

  gsap
    .timeline()
    .to(word, { opacity: 1, duration: 0.7, ease: REVEAL.ease }, 0.1)
    .to(
      counter,
      {
        v: 100,
        duration: 1.8,
        ease: "power1.inOut",
        onUpdate: () => (count.textContent = Math.round(counter.v)),
      },
      0
    )
    .to(bar, { scaleX: 1, duration: 1.8, ease: "power1.inOut" }, 0)
    .to([word, count], { opacity: 0, duration: 0.4, ease: REVEAL.ease }, 1.95)
    .to(
      pre,
      {
        yPercent: -100,
        duration: 0.9,
        ease: "power3.inOut",
        onStart: startHero, // reveal the hero as the panel lifts
      },
      2.05
    )
    .eventCallback("onComplete", finalize);

  // Hard failsafe (native timer, independent of rAF): never leave the page
  // covered or scroll-locked if the intro animation can't run.
  setTimeout(finalize, 6000);
}

setupPreloader();

// Keep the hero video-scrub ScrollTrigger's positions correct after any late
// layout shift or viewport change — fonts loading, media settling, and
// entering/leaving fullscreen — so the scrub stays in sync with scroll.
const refreshTriggers = () => ScrollTrigger.refresh();
window.addEventListener("load", refreshTriggers);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(refreshTriggers);
}
document.addEventListener("fullscreenchange", refreshTriggers);
