// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const FRAME_COUNT     = 452;   // V1: 151 frames + V2: 301 frames
const FRAME_SPEED     = 1.8;   // video ends at 1/1.8 = 55.6% scroll
const IMAGE_SCALE     = 0.88;  // padded cover sweet spot
const SCROLL_HEIGHT_VH = 1050;
const STATS_ENTER     = 0.43;
const STATS_LEAVE     = 0.56;

// ─── ELEMENT REFS ────────────────────────────────────────────────────────────
const pageLoaderBar  = document.getElementById('page-loader-bar');
const heroSection    = document.querySelector('.hero-standalone');
const canvasWrap     = document.getElementById('canvas-wrap');
const canvas         = document.getElementById('canvas');
const ctx            = canvas.getContext('2d');
const scrollContainer = document.getElementById('scroll-container');
const darkOverlay    = document.getElementById('dark-overlay');
const marqueeWrap    = document.getElementById('marquee-main');

// ─── STATE ───────────────────────────────────────────────────────────────────
const frames = new Array(FRAME_COUNT);
let currentFrame = 0;
let bgColor = '#ffffff';
let lenis;

// ─── LENIS SMOOTH SCROLL ─────────────────────────────────────────────────────
function initLenis() {
  lenis = new Lenis({
    duration: 1.4,
    easing: (t) => 1 - Math.pow(1 - t, 4), // quartic ease-out — silkier than expo
    smoothWheel: true,
    wheelMultiplier: 0.9,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ─── CANVAS SETUP ────────────────────────────────────────────────────────────
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawFrame(currentFrame);
  }

  resize();
  window.addEventListener('resize', resize);
}

// ─── BACKGROUND COLOR SAMPLER ────────────────────────────────────────────────
function sampleBgColor(img) {
  try {
    const off = document.createElement('canvas');
    off.width = off.height = 10;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(img, 0, 0, 10, 10);
    const corners = [
      offCtx.getImageData(0, 0, 1, 1).data,
      offCtx.getImageData(9, 0, 1, 1).data,
      offCtx.getImageData(0, 9, 1, 1).data,
      offCtx.getImageData(9, 9, 1, 1).data,
    ];
    const avg = corners
      .reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
      .map(v => Math.round(v / 4));
    return `rgb(${avg[0]},${avg[1]},${avg[2]})`;
  } catch (_) {
    return '#0a0a0a';
  }
}

// ─── FRAME RENDERER ──────────────────────────────────────────────────────────
function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.complete) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ─── FRAME PRELOADER ─────────────────────────────────────────────────────────
function preloadFrames() {
  return new Promise((resolve) => {
    let loaded = 0;
    const FIRST_BATCH = 10;

    function buildPath(i) {
      return `frames/frame_${String(i + 1).padStart(4, '0')}.webp`;
    }

    function onLoad(i, img) {
      frames[i] = img;
      loaded++;
      if (i % 10 === 0) bgColor = sampleBgColor(img);
      const pct = Math.round((loaded / FRAME_COUNT) * 100);
      if (pageLoaderBar) pageLoaderBar.style.width = pct + '%';
      if (loaded === FRAME_COUNT) {
        if (pageLoaderBar) pageLoaderBar.classList.add('done');
        resolve();
      }
    }

    // Phase 1: first 10 frames — fast first paint
    for (let i = 0; i < FIRST_BATCH; i++) {
      const img = new Image();
      img.onload = () => {
        onLoad(i, img);
        if (i === 0) drawFrame(0);
      };
      img.onerror = () => onLoad(i, img); // avoid stall on missing frames
      img.src = buildPath(i);
    }

    // Phase 2: remaining frames
    for (let i = FIRST_BATCH; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = () => onLoad(i, img);
      img.onerror = () => onLoad(i, img);
      img.src = buildPath(i);
    }
  });
}

// ─── SECTION POSITIONING ─────────────────────────────────────────────────────
// CSS uses different scroll heights on mobile (620vh) vs desktop (1050vh).
// JS must use the same value to place sections at the correct pixel position.
function getScrollVH() {
  return window.innerWidth <= 768 ? 620 : SCROLL_HEIGHT_VH;
}

function positionSections() {
  const totalPx = window.innerHeight * (getScrollVH() / 100);
  document.querySelectorAll('.scroll-section').forEach(section => {
    if (section.classList.contains('section-cta')) return; // anchored via CSS bottom:0
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const mid   = (enter + leave) / 2;
    section.style.top       = `${mid * totalPx}px`;
    section.style.transform = 'translateY(-50%)';
  });
}

// Re-position on orientation change / resize
window.addEventListener('resize', () => {
  positionSections();
  ScrollTrigger.refresh();
});

// ─── HERO WORD REVEAL (clip-path slide-up) ────────────────────────────────────
function initHeroWordReveal() {
  const words   = heroSection.querySelectorAll('.word-wrap .word');
  const label   = heroSection.querySelector('.hero-label');
  const tagline = heroSection.querySelector('.hero-tagline');
  const actions = heroSection.querySelector('.hero-actions');
  const hint    = heroSection.querySelector('.hero-scroll-hint');

  gsap.set(words,   { yPercent: 115 });
  gsap.set([label, tagline, actions, hint], { opacity: 0, y: 18 });

  const tl = gsap.timeline({ delay: 0.1 });
  tl.to(label,   { opacity: 1,   y: 0,       duration: 0.5,  ease: 'power3.out' })
    .to(words,   { yPercent: 0, stagger: 0.1, duration: 0.9,  ease: 'power4.out' }, '-=0.2')
    .to(tagline, { opacity: 1,   y: 0,        duration: 0.55, ease: 'power3.out' }, '-=0.35')
    .to(actions, { opacity: 1,   y: 0,        duration: 0.5,  ease: 'power3.out' }, '-=0.3')
    .to(hint,    { opacity: 0.5, y: 0,        duration: 0.4,  ease: 'power2.out' }, '-=0.2');
}

// ─── HERO TRANSITION + CIRCLE WIPE ───────────────────────────────────────────
// Canvas reveals as the HERO scrolls away (hero-based trigger) so there's no
// white gap between the headline and the video.
function initHeroTransition() {
  const setHeroOpacity    = gsap.quickSetter(heroSection, 'opacity');
  const setMarqueeOpacity = gsap.quickSetter(marqueeWrap, 'opacity');

  // Tie canvas clip-path + hero fade to hero section scroll
  ScrollTrigger.create({
    trigger: heroSection,
    start: 'top top',
    end: 'bottom top',   // completes when hero fully scrolled off
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      // Hero fades as it scrolls away
      setHeroOpacity(Math.max(0, 1 - p * 1.6));
      heroSection.style.pointerEvents = p > 0.12 ? 'none' : 'auto';
      // Canvas circle-wipe: fully open by 65% of hero scroll
      const radius = Math.min(82, (p / 0.65) * 82);
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    },
  });

  // Marquee tied to scroll container (unchanged)
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const mIn  = Math.min(1, Math.max(0, (p - 0.12) / 0.06));
      const mOut = Math.min(1, Math.max(0, (0.90 - p)  / 0.04));
      setMarqueeOpacity(Math.min(mIn, mOut));
    },
  });
}

// ─── FRAME-TO-SCROLL BINDING ──────────────────────────────────────────────────
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
      if (index !== currentFrame) {
        currentFrame = index;
        drawFrame(currentFrame);
      }
    },
  });
}

// ─── DARK OVERLAY ─────────────────────────────────────────────────────────────
function initDarkOverlay() {
  const fadeRange = 0.04;
  const setOverlayOpacity = gsap.quickSetter(darkOverlay, 'opacity');

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= STATS_ENTER - fadeRange && p < STATS_ENTER) {
        opacity = (p - (STATS_ENTER - fadeRange)) / fadeRange;
      } else if (p >= STATS_ENTER && p <= STATS_LEAVE) {
        opacity = 0.9;
      } else if (p > STATS_LEAVE && p <= STATS_LEAVE + fadeRange) {
        opacity = 0.9 * (1 - (p - STATS_LEAVE) / fadeRange);
      }
      setOverlayOpacity(opacity);
    },
  });
}

// ─── SECTION ANIMATION SYSTEM ────────────────────────────────────────────────
// Trigger-based (not scrubbed) — entrance animation plays at real speed
// so it looks identical regardless of how early/late the section appears.
function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;
  const FADE_OUT = 0.25; // last 25% of range: fade section out

  const children = Array.from(section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, .cta-button'
  ));
  const statEls = Array.from(section.querySelectorAll('.stat'));
  const targets = statEls.length ? statEls : children;

  // Reset: section invisible, children at their "from" position
  const resetTargets = () => {
    gsap.set(section, { opacity: 0, y: 14 });
    switch (type) {
      case 'slide-left':  gsap.set(targets, { x: -65, opacity: 0 }); break;
      case 'slide-right': gsap.set(targets, { x:  65, opacity: 0 }); break;
      case 'stagger-up':  gsap.set(targets, { y:  50, opacity: 0 }); break;
      case 'scale-up':    gsap.set(targets, { scale: 0.88, opacity: 0 }); break;
      case 'clip-reveal': gsap.set(targets, { clipPath: 'inset(100% 0 0 0)', opacity: 0 }); break;
      default:            gsap.set(targets, { y: 45, opacity: 0 });
    }
  };
  resetTargets();

  // Entrance: card slides up while children animate in — no instant "pop"
  const playEntrance = () => {
    gsap.to(section, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
    switch (type) {
      case 'slide-left':
      case 'slide-right':
        gsap.to(targets, { x: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: 'power3.out', delay: 0.08 });
        break;
      case 'stagger-up':
        gsap.to(targets, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: 'power3.out', delay: 0.08 });
        break;
      case 'scale-up':
        gsap.to(targets, { scale: 1, opacity: 1, stagger: 0.1, duration: 0.9, ease: 'power2.out', delay: 0.08 });
        break;
      case 'clip-reveal':
        gsap.to(targets, { clipPath: 'inset(0% 0 0 0)', opacity: 1, stagger: 0.12, duration: 1.1, ease: 'power4.inOut', delay: 0.1,
          onComplete: () => gsap.set(targets, { clipPath: 'none' }) });
        break;
      default:
        gsap.to(targets, { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: 'power3.out', delay: 0.08 });
    }
  };

  let visible = false;
  const setOpacity = gsap.quickSetter(section, 'opacity');

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;
      const fadeOutStart = leave - (leave - enter) * FADE_OUT;

      if (p >= enter && !visible) {
        visible = true;
        playEntrance();
      }

      if (visible && !persist) {
        if (p > fadeOutStart && p <= leave) {
          setOpacity(1 - (p - fadeOutStart) / ((leave - enter) * FADE_OUT));
        } else if (p > leave) {
          setOpacity(0);
        } else if (p < enter) {
          visible = false;
          resetTargets();
        }
      }
    },
  });
}

function initSectionAnimations() {
  document.querySelectorAll('.scroll-section').forEach(setupSectionAnimation);
}

// ─── COUNTER ANIMATIONS ───────────────────────────────────────────────────────
// Uses scroll progress instead of element position — sections are position:absolute
// so standard ScrollTrigger positional triggers don't fire reliably.
function initCounters() {
  let triggered = false;

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;

      if (!triggered && p >= STATS_ENTER - 0.02) {
        triggered = true;
        document.querySelectorAll('.stat-number').forEach(el => {
          const target   = parseFloat(el.dataset.value);
          const decimals = parseInt(el.dataset.decimals || '0');
          const counter  = { n: 0 };
          gsap.to(counter, {
            n: target,
            duration: 2.4,
            ease: 'power2.out',
            onUpdate() {
              el.textContent = decimals === 0
                ? Math.round(counter.n).toString()
                : counter.n.toFixed(decimals);
            },
          });
        });
      }

      // Reset when scrolling back above the stats section
      if (triggered && p < STATS_ENTER - 0.06) {
        triggered = false;
        document.querySelectorAll('.stat-number').forEach(el => {
          el.textContent = '0';
        });
      }
    },
  });
}

// ─── HORIZONTAL TEXT MARQUEE ──────────────────────────────────────────────────
function initMarquee() {
  const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -28;
  gsap.to(marqueeWrap.querySelector('.marquee-text'), {
    xPercent: speed,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollContainer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  });
}

// ─── CUSTOM CURSOR ────────────────────────────────────────────────────────────
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  const isTouch = window.matchMedia('(hover: none)').matches
               || window.matchMedia('(pointer: coarse)').matches
               || 'ontouchstart' in window;
  if (!dot || !ring || isTouch) return;

  // Use GSAP transform (GPU, no layout reflow)
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
  const setDotX  = gsap.quickSetter(dot,  'x', 'px');
  const setDotY  = gsap.quickSetter(dot,  'y', 'px');
  const setRingX = gsap.quickSetter(ring, 'x', 'px');
  const setRingY = gsap.quickSetter(ring, 'y', 'px');

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    setDotX(mx);
    setDotY(my);
  });

  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.11;
    ry += (my - ry) * 0.11;
    setRingX(rx);
    setRingY(ry);
  });

  // Expand on interactive elements
  document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, .cta-button, .hero-cta, .nav-cta, .sticky-btn')) {
      document.body.classList.add('cursor-hover');
    } else {
      document.body.classList.remove('cursor-hover');
    }
  });

  const setDotOpacity  = gsap.quickSetter(dot,  'opacity');
  const setRingOpacity = gsap.quickSetter(ring, 'opacity');
  document.addEventListener('mouseleave', () => { setDotOpacity(0); setRingOpacity(0); });
  document.addEventListener('mouseenter', () => { setDotOpacity(1); setRingOpacity(1); });
}

// ─── STICKY BUY BAR ───────────────────────────────────────────────────────────
function initStickyBar() {
  const bar = document.getElementById('sticky-bar');
  if (!bar) return;
  const setVisible = gsap.quickSetter(bar, 'className');
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      const p = self.progress;
      bar.classList.toggle('visible', p > 0.01 && p < 0.72);
    },
  });
}

// ─── MAIN INIT (non-blocking) ────────────────────────────────────────────────
function init() {
  gsap.registerPlugin(ScrollTrigger);
  setupCanvas();
  initLenis();
  positionSections();

  // Hero visible immediately — no await
  initHeroWordReveal();
  initHeroTransition();
  initFrameScroll();
  initDarkOverlay();
  initSectionAnimations();
  initCounters();
  initMarquee();
  initStickyBar();
  initCursor();

  // Frames load in background — progress bar updates as they arrive
  preloadFrames();
}

document.addEventListener('DOMContentLoaded', init);
