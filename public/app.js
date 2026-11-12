(() => {
  const bullIntro = document.getElementById('bull-intro');
  const bullCanvas = document.getElementById('bull-canvas');
  const bullCustomVideo = document.getElementById('bull-custom-video');
  const bullFlash = document.getElementById('bull-flash');
  const skipBtn = document.getElementById('skip-intro-btn');
  const soundBtn = document.getElementById('sound-hint-btn');

  const ranchPage = document.getElementById('ranch-page');
  const embersCanvas = document.getElementById('embers-canvas');
  const menuStage = document.getElementById('menu-stage');
  const welcomeKicker = document.getElementById('welcome-kicker');
  const heroTitleWrap = document.getElementById('hero-title-wrap');
  const heroTitle = document.getElementById('hero-title');
  const heroFireCanvas = document.getElementById('hero-fire-canvas');
  const heroSubtitle = document.getElementById('hero-subtitle');
  const menuPhoto = document.getElementById('menu-photo');
  const menuUpdatedLabel = document.getElementById('menu-updated-label');
  const menuPhotoBtn = document.getElementById('menu-photo-btn');
  const replayBtn = document.getElementById('replay-intro-btn');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');

  const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  let animFrameId = null;
  let introFinished = false;
  let audioCtx = null;
  let soundEnabled = false;
  let customVideoUrl = '/assets/rancho-bull-intro.mp4';

  function formatUpdatedLabel(menuMeta, hasCustomMenu) {
    if (!hasCustomMenu || !menuMeta || !menuMeta.updatedAt) {
      return 'Ejemplo de menú • Sube la foto de hoy en Administrar';
    }
    const dt = new Date(menuMeta.updatedAt);
    const time = dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    return `Actualizado ${dt.getDate()} ${MONTHS_ES[dt.getMonth()]} • ${time}`;
  }

  function applyBranding(cfg) {
    const rawTitle = (cfg.title || 'Bienvenidos a Rancho Grande').trim();
    const match = rawTitle.match(/^bienvenidos\s+a\s+(.+)$/i);
    if (match) {
      welcomeKicker.textContent = 'Bienvenidos a';
      heroTitle.textContent = match[1].trim();
    } else {
      welcomeKicker.textContent = 'Bienvenidos a';
      heroTitle.textContent = rawTitle;
    }
    heroSubtitle.textContent = cfg.subtitle || 'Comida Casera con Sabor de Campo';
    if (typeof window.__refreshTitleFlames === 'function') {
      window.__refreshTitleFlames();
    }

    menuPhoto.src = cfg.menuImage || '/assets/sample-menu.jpg';
    menuUpdatedLabel.textContent = formatUpdatedLabel(cfg.menuMeta, cfg.hasCustomMenu);
    customVideoUrl = cfg.introVideo || '/assets/rancho-bull-intro.mp4';
  }

  // Subtle synthesized hoof-thump sound (only after user taps "Activar sonido")
  function playHoofThump(intensity = 0.5) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115 + intensity * 35, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.14);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28 * intensity, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } catch {
      // Audio is optional
    }
  }

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊 Sonido activo' : '🔊 Activar sonido';
    bullCustomVideo.muted = !soundEnabled;
    if (soundEnabled && bullCustomVideo.classList.contains('hidden')) {
      playHoofThump(0.7);
    }
  });

  function finishIntro() {
    if (introFinished) return;
    introFinished = true;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (!bullCustomVideo.classList.contains('hidden')) {
      bullCustomVideo.pause();
    }

    bullFlash.classList.add('active');
    setTimeout(() => {
      bullIntro.classList.add('is-hidden');
      ranchPage.classList.remove('is-waiting');
      ranchPage.classList.add('is-revealed');
      bullFlash.classList.remove('active');

      // Show welcome sign first, then reveal the daily menu smoothly
      setTimeout(() => {
        menuStage.classList.add('is-visible');
      }, 850);
    }, 240);
  }

  skipBtn.addEventListener('click', finishIntro);

  function runCanvasChargingBull() {
    bullCanvas.classList.remove('hidden');
    bullCustomVideo.classList.add('hidden');
    soundBtn.style.display = 'inline-block';

    const ctx = bullCanvas.getContext('2d');
    const bullImg = new Image();
    bullImg.src = '/assets/charging-bull.jpg';

    const particles = Array.from({ length: 44 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 0.05 + Math.random() * 0.3,
      speed: 0.35 + Math.random() * 0.9,
      size: 2 + Math.random() * 7,
      alpha: 0.25 + Math.random() * 0.55
    }));

    const DURATION_MS = 3200;
    let startTime = null;
    let lastThumpStep = -1;

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      bullCanvas.width = Math.floor(window.innerWidth * dpr);
      bullCanvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    function drawFrame(timestamp) {
      if (introFinished) {
        window.removeEventListener('resize', resizeCanvas);
        return;
      }
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / DURATION_MS, 1);

      // Exponential acceleration so the bull lunges closer at the climax
      const easeIn = Math.pow(t, 1.85);

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Hoof-impact shake (faster and stronger as the bull gets closer)
      const thumpPhase = t * 8.5;
      const currentStep = Math.floor(thumpPhase);
      if (currentStep > lastThumpStep && t < 0.95) {
        lastThumpStep = currentStep;
        playHoofThump(0.35 + t * 0.65);
      }

      const shakeAmp = (3 + easeIn * 18) * (1 - Math.max(0, t - 0.92) * 8);
      const shakeX = Math.sin(thumpPhase * Math.PI * 2) * shakeAmp * 0.7;
      const shakeY = Math.abs(Math.sin(thumpPhase * Math.PI)) * -shakeAmp;
      const tilt = Math.sin(thumpPhase * Math.PI) * 0.018 * easeIn;

      if (bullImg.complete && bullImg.naturalWidth > 0) {
        const imgAspect = bullImg.naturalWidth / bullImg.naturalHeight;
        const viewAspect = w / h;
        let baseW;
        let baseH;
        if (viewAspect > imgAspect) {
          baseW = w;
          baseH = w / imgAspect;
        } else {
          baseH = h;
          baseW = h * imgAspect;
        }

        const scale = 0.94 + easeIn * 1.18;
        ctx.save();
        ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
        ctx.rotate(tilt);
        ctx.scale(scale, scale);
        ctx.drawImage(bullImg, -baseW / 2, -baseH / 2, baseW, baseH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#240f04';
        ctx.fillRect(0, 0, w, h);
      }

      // Golden dust & speed embers flying outward from center
      ctx.save();
      ctx.translate(w / 2, h * 0.62);
      for (const p of particles) {
        const travel = (p.dist + t * p.speed * 1.5) % 1.15;
        const radius = travel * Math.max(w, h) * 0.65;
        const px = Math.cos(p.angle) * radius;
        const py = Math.sin(p.angle) * radius * 0.72;
        const size = p.size * (0.6 + travel * 2.2);
        ctx.fillStyle = `rgba(255, 198, 108, ${p.alpha * (1 - travel * 0.7)})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Subtle motion speed-lines around periphery as bull charges
      if (t > 0.25) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.strokeStyle = `rgba(255, 224, 160, ${0.14 * easeIn})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 18; i++) {
          const ang = (i / 18) * Math.PI * 2 + t * 0.4;
          const r1 = Math.min(w, h) * (0.38 - easeIn * 0.1);
          const r2 = Math.max(w, h) * 0.75;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
          ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (t >= 1) {
        window.removeEventListener('resize', resizeCanvas);
        finishIntro();
        return;
      }

      animFrameId = requestAnimationFrame(drawFrame);
    }

    animFrameId = requestAnimationFrame(drawFrame);
  }

  function startIntro() {
    introFinished = false;
    bullIntro.classList.remove('is-hidden');
    ranchPage.classList.add('is-waiting');
    ranchPage.classList.remove('is-revealed');
    menuStage.classList.remove('is-visible');

    if (customVideoUrl) {
      bullCanvas.classList.add('hidden');
      bullCustomVideo.classList.remove('hidden');
      soundBtn.style.display = 'inline-block';
      bullCustomVideo.src = customVideoUrl;
      bullCustomVideo.muted = !soundEnabled;
      bullCustomVideo.currentTime = 0;
      bullCustomVideo.onended = finishIntro;
      bullCustomVideo.onerror = runCanvasChargingBull;
      const playPromise = bullCustomVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // If unmuted autoplay is blocked, retry muted
          bullCustomVideo.muted = true;
          soundEnabled = false;
          soundBtn.textContent = '🔊 Activar sonido';
          bullCustomVideo.play().catch(() => {
            runCanvasChargingBull();
          });
        });
      }
    } else {
      runCanvasChargingBull();
    }
  }

  replayBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    startIntro();
  });

  // Fullscreen Lightbox for reading small menu text easily
  menuPhotoBtn.addEventListener('click', () => {
    lightboxImg.src = menuPhoto.src;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-img-wrap')) {
      closeLightbox();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  function startGrillEmbers() {
    if (!embersCanvas) return;
    const ctx = embersCanvas.getContext('2d');
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      embersCanvas.width = Math.floor(width * dpr);
      embersCanvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const SPARK_COUNT = 78;
    const createSpark = (randomY = false) => ({
      x: Math.random() * (width || 400),
      y: randomY ? Math.random() * (height || 800) : (height || 800) + Math.random() * 60,
      vy: 0.55 + Math.random() * 1.65,
      vx: (Math.random() - 0.5) * 0.45,
      swayAmp: 0.35 + Math.random() * 0.9,
      swayFreq: 0.012 + Math.random() * 0.025,
      phase: Math.random() * Math.PI * 2,
      radius: 1.3 + Math.random() * 2.8,
      flickerSpeed: 0.06 + Math.random() * 0.12,
      hue: 16 + Math.random() * 32, // fiery red-orange to bright gold
      life: 0
    });

    const sparks = Array.from({ length: SPARK_COUNT }, () => createSpark(true));

    function tick() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.life += 1;
        s.y -= s.vy;
        s.x += s.vx + Math.sin(s.y * s.swayFreq + s.phase) * s.swayAmp;

        const progress = 1 - Math.max(0, Math.min(1, s.y / height));
        const edgeFade = progress < 0.12 ? progress / 0.12 : progress > 0.85 ? (1 - progress) / 0.15 : 1;
        const flicker = 0.65 + 0.35 * Math.sin(s.life * s.flickerSpeed + s.phase);
        const alpha = Math.max(0, Math.min(1, edgeFade * flicker * 0.88));

        // Outer fiery ember halo
        const glowRadius = s.radius * 3.8;
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowRadius);
        grad.addColorStop(0, `hsla(${s.hue + 14}, 100%, 82%, ${alpha})`);
        grad.addColorStop(0.35, `hsla(${s.hue}, 100%, 56%, ${alpha * 0.65})`);
        grad.addColorStop(1, `hsla(${s.hue - 8}, 100%, 40%, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bright white-gold core
        ctx.fillStyle = `rgba(255, 246, 205, ${alpha * 0.95})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.52, 0, Math.PI * 2);
        ctx.fill();

        if (s.y < -25 || s.x < -30 || s.x > width + 30) {
          sparks[i] = createSpark(false);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function startTitleFlames() {
    if (!heroFireCanvas || !heroTitle || !heroTitleWrap) return;
    const ctx = heroFireCanvas.getContext('2d');
    const PAD_X = 14;
    const PAD_Y = 12;

    let wrapW = 0;
    let wrapH = 0;
    let dpr = 1;
    let fontSizePx = 48;
    let lineHeightPx = 52;
    let lines = [];

    const tongues = Array.from({ length: 34 }, (_, idx) => ({
      normX: idx / 33,
      speed: 2.2 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
      heightRatio: 0.48 + Math.random() * 0.45,
      widthScale: 0.65 + Math.random() * 0.85,
      hueShift: Math.random() * 14
    }));

    const innerSparks = Array.from({ length: 26 }, () => ({
      normX: Math.random(),
      progress: Math.random(),
      speed: 0.012 + Math.random() * 0.022,
      sway: Math.random() * Math.PI * 2,
      size: 1.5 + Math.random() * 2.5
    }));

    function measureLayout() {
      const w = heroTitleWrap.offsetWidth;
      const h = heroTitleWrap.offsetHeight;
      if (!w || !h) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      wrapW = w;
      wrapH = h;

      heroFireCanvas.width = Math.floor((wrapW + PAD_X * 2) * dpr);
      heroFireCanvas.height = Math.floor((wrapH + PAD_Y * 2) * dpr);

      const cs = window.getComputedStyle(heroTitle);
      fontSizePx = parseFloat(cs.fontSize) || 48;
      lineHeightPx = parseFloat(cs.lineHeight) || fontSizePx * 1.06;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${cs.fontWeight} ${fontSizePx}px ${cs.fontFamily}`;
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = cs.letterSpacing || '0px';
      }

      const rawText = (heroTitle.textContent || 'RANCHO GRANDE').trim().toUpperCase();
      const words = rawText.split(/\s+/);
      lines = [];
      let current = '';

      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (current && ctx.measureText(test).width > wrapW - 6) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
    }

    window.__refreshTitleFlames = () => {
      requestAnimationFrame(measureLayout);
    };

    window.addEventListener('resize', measureLayout, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureLayout();
        heroTitleWrap.classList.add('has-fire');
      });
    }

    measureLayout();
    heroTitleWrap.classList.add('has-fire');

    function renderFireTitle(now) {
      if (!wrapW || !wrapH || lines.length === 0) {
        measureLayout();
      }
      if (wrapW && wrapH && lines.length > 0) {
        const t = now * 0.001;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, wrapW + PAD_X * 2, wrapH + PAD_Y * 2);

        const cs = window.getComputedStyle(heroTitle);
        ctx.font = `${cs.fontWeight} ${fontSizePx}px ${cs.fontFamily}`;
        if ('letterSpacing' in ctx) {
          ctx.letterSpacing = cs.letterSpacing || '0px';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = PAD_X + wrapW / 2;
        const totalTextH = lines.length * lineHeightPx;
        const startY = PAD_Y + (wrapH - totalTextH) / 2 + lineHeightPx / 2;

        // 1. Crisp 3D dark espresso shadow & warm glowing cream-gold base
        ctx.save();
        ctx.shadowColor = 'rgba(22, 6, 0, 0.94)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.shadowBlur = 10;

        for (let i = 0; i < lines.length; i++) {
          const ly = startY + i * lineHeightPx;
          const baseGrad = ctx.createLinearGradient(0, ly - fontSizePx * 0.5, 0, ly + fontSizePx * 0.5);
          baseGrad.addColorStop(0, '#fff7dc');
          baseGrad.addColorStop(0.55, '#ffc83b');
          baseGrad.addColorStop(1, '#ff6a00');
          ctx.fillStyle = baseGrad;
          ctx.fillText(lines[i], centerX, ly);
        }
        ctx.restore();

        // 2. Clip living dancing flames STRICTLY inside the letter glyphs
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';

        for (let i = 0; i < lines.length; i++) {
          const ly = startY + i * lineHeightPx;
          const lineTop = ly - fontSizePx * 0.55;
          const lineBottom = ly + fontSizePx * 0.52;
          const lineW = Math.max(ctx.measureText(lines[i]).width, 120);
          const leftX = centerX - lineW / 2;

          // Undulating fiery glow wave inside lower-to-mid strokes
          const waveGrad = ctx.createLinearGradient(0, lineTop, 0, lineBottom);
          waveGrad.addColorStop(0, 'rgba(255, 224, 150, 0.12)');
          waveGrad.addColorStop(0.45, 'rgba(255, 90, 0, 0.52)');
          waveGrad.addColorStop(0.8, 'rgba(255, 175, 20, 0.86)');
          waveGrad.addColorStop(1, 'rgba(255, 250, 205, 0.95)');
          ctx.fillStyle = waveGrad;
          ctx.fillRect(leftX - 10, lineTop - 4, lineW + 20, fontSizePx * 1.15);

          // Dancing upward-licking flame tongues
          for (const fl of tongues) {
            const sway = Math.sin(t * fl.speed + fl.phase) * 9;
            const pulse = 0.78 + 0.25 * Math.sin(t * (fl.speed * 1.4) + fl.phase);
            const fx = leftX + fl.normX * lineW + sway;
            const flameH = fontSizePx * fl.heightRatio * pulse;
            const flameW = (lineW / 18) * fl.widthScale;

            const fg = ctx.createRadialGradient(
              fx,
              lineBottom - flameH * 0.15,
              flameW * 0.08,
              fx - sway * 0.35,
              lineBottom - flameH * 0.55,
              flameH
            );
            fg.addColorStop(0, 'rgba(255, 252, 215, 0.95)');
            fg.addColorStop(0.28, `hsla(${36 + fl.hueShift}, 100%, 56%, 0.85)`);
            fg.addColorStop(0.62, `hsla(${14 + fl.hueShift * 0.5}, 100%, 48%, 0.62)`);
            fg.addColorStop(1, 'rgba(180, 20, 0, 0)');

            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.ellipse(
              fx,
              lineBottom - flameH * 0.45,
              flameW,
              flameH * 0.75,
              sway * 0.015,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          // Rising glowing micro-sparks inside the letters
          for (const sp of innerSparks) {
            sp.progress += sp.speed * 0.5;
            if (sp.progress >= 1) {
              sp.progress = 0;
              sp.normX = Math.random();
            }
            const sx = leftX + sp.normX * lineW + Math.sin(t * 5 + sp.sway) * 5;
            const sy = lineBottom - sp.progress * fontSizePx * 1.05;
            const sa = Math.sin(sp.progress * Math.PI);
            ctx.fillStyle = `rgba(255, 245, 195, ${sa * 0.9})`;
            ctx.beginPath();
            ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();

        // 3. Crisp warm rim highlight so every letter edge stays razor-sharp
        ctx.save();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = 'rgba(255, 242, 200, 0.45)';
        for (let i = 0; i < lines.length; i++) {
          ctx.strokeText(lines[i], centerX, startY + i * lineHeightPx);
        }
        ctx.restore();
      }

      requestAnimationFrame(renderFireTitle);
    }

    requestAnimationFrame(renderFireTitle);
  }

  async function init() {
    startGrillEmbers();
    startTitleFlames();
    try {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (res.ok) {
        const cfg = await res.json();
        applyBranding(cfg);
      }
    } catch (err) {
      console.warn('Could not load config, using defaults:', err);
    }
    startIntro();
  }

  init();
})();

