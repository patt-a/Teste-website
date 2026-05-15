// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const FRAME_COUNT     = 452;   // V1: 151 frames + V2: 301 frames
const FRAME_SPEED     = 1.8;   // video ends at 1/1.8 = 55.6% scroll
const IMAGE_SCALE     = 0.88;  // padded cover sweet spot
const SCROLL_HEIGHT_VH = 1050;
const STATS_ENTER     = 0.56;
const STATS_LEAVE     = 0.69;

// ─── ELEMENT REFS ────────────────────────────────────────────────────────────
const loader         = document.getElementById('loader');
const loaderBar      = document.getElementById('loader-bar');
const loaderPercent  = document.getElementById('loader-percent');
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
      loaderBar.style.width = pct + '%';
      loaderPercent.textContent = pct + '%';
      if (loaded === FRAME_COUNT) resolve();
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
function positionSections() {
  const totalPx = window.innerHeight * (SCROLL_HEIGHT_VH / 100);
  document.querySelectorAll('.scroll-section').forEach(section => {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const mid   = (enter + leave) / 2;
    section.style.top       = `${mid * totalPx}px`;
    section.style.transform = 'translateY(-50%)';
  });
}

// ─── HERO WORD REVEAL ─────────────────────────────────────────────────────────
function initHeroWordReveal() {
  const words   = heroSection.querySelectorAll('.hero-heading .word');
  const label   = heroSection.querySelector('.section-label');
  const tagline = heroSection.querySelector('.hero-tagline');
  const hint    = heroSection.querySelector('.hero-scroll-hint');

  gsap.set([words, label, tagline, hint], { opacity: 0, y: 28 });

  const tl = gsap.timeline({ delay: 0.2 });
  tl.to(label,   { opacity: 1,   y: 0, duration: 0.6, ease: 'power3.out' })
    .to(words,   { opacity: 1,   y: 0, stagger: 0.13, duration: 0.85, ease: 'power3.out' }, '-=0.25')
    .to(tagline, { opacity: 0.55, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.2')
    .to(hint,    { opacity: 0.45, y: 0, duration: 0.5,  ease: 'power2.out' }, '-=0.1');
}

// ─── HERO TRANSITION + CIRCLE WIPE ───────────────────────────────────────────
function initHeroTransition() {
  // quickSetter caches the property write path — much faster than style.* per frame
  const setHeroOpacity    = gsap.quickSetter(heroSection,  'opacity');
  const setMarqueeOpacity = gsap.quickSetter(marqueeWrap,  'opacity');

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;

      setHeroOpacity(Math.max(0, 1 - p * 14));
      heroSection.style.pointerEvents = p > 0.08 ? 'none' : 'auto';

      const wipeProgress = Math.min(1, Math.max(0, (p - 0.01) / 0.06));
      canvasWrap.style.clipPath = `circle(${wipeProgress * 80}% at 50% 50%)`;

      const mIn  = Math.min(1, Math.max(0, (p - 0.18) / 0.05));
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
function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;
  const range   = leave - enter;

  const children = Array.from(section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, .cta-button'
  ));
  const statEls = Array.from(section.querySelectorAll('.stat'));
  const targets = statEls.length ? statEls : children;

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'slide-left':
      tl.from(targets, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(targets, { x: 80,  opacity: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'stagger-up':
      tl.from(targets, { y: 60,  opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(targets, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'clip-reveal':
      tl.from(targets, {
        clipPath: 'inset(100% 0 0 0)',
        opacity: 0,
        stagger: 0.15,
        duration: 1.2,
        ease: 'power4.inOut',
      });
      break;
    default:
      tl.from(targets, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
  }

  const FADE_IN_FRAC  = 0.25; // first 25% of range: animate in
  const FADE_OUT_FRAC = 0.25; // last 25% of range: animate out

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;

      if (p < enter) {
        gsap.set(section, { opacity: 0 });
        tl.progress(0);
        return;
      }

      if (p >= enter && p <= enter + range * FADE_IN_FRAC) {
        gsap.set(section, { opacity: 1 });
        tl.progress((p - enter) / (range * FADE_IN_FRAC));
        return;
      }

      const fadeOutStart = leave - range * FADE_OUT_FRAC;

      if (p > enter + range * FADE_IN_FRAC && p <= (persist ? Infinity : fadeOutStart)) {
        gsap.set(section, { opacity: 1 });
        tl.progress(1);
        return;
      }

      if (!persist && p > fadeOutStart && p <= leave) {
        const outProg = (p - fadeOutStart) / (range * FADE_OUT_FRAC);
        gsap.set(section, { opacity: 1 - outProg });
        tl.progress(1);
        return;
      }

      if (!persist && p > leave) {
        gsap.set(section, { opacity: 0 });
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

// ─── MAIN INIT ────────────────────────────────────────────────────────────────
async function init() {
  gsap.registerPlugin(ScrollTrigger);
  setupCanvas();
  initLenis();

  await preloadFrames();

  loader.classList.add('hidden');

  positionSections();

  initHeroWordReveal();
  initHeroTransition();
  initFrameScroll();
  initDarkOverlay();
  initSectionAnimations();
  initCounters();
  initMarquee();

  drawFrame(0);
}

document.addEventListener('DOMContentLoaded', init);
