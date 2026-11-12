const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { put, list, del } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const IS_VERCEL = Boolean(process.env.VERCEL);
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const BLOB_CONFIG_KEY = 'rancho-grande/config.json';

if (!USE_BLOB && !IS_VERCEL) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DEFAULT_CONFIG = {
  title: 'Bienvenidos a Rancho Grande',
  subtitle: 'Comida Casera con Sabor de Campo',
  dailyTitle: '',
  menuImage: '/assets/sample-menu.jpg',
  hasCustomMenu: false,
  menuMeta: {
    width: 1080,
    height: 1920,
    megapixels: 2.07,
    sizeBytes: 0,
    updatedAt: null,
    originalName: 'sample-menu.jpg'
  },
  introVideo: '/assets/rancho-bull-intro.mp4',
  adminPin: process.env.ADMIN_PIN || '1234'
};

async function readConfig() {
  if (USE_BLOB) {
    try {
      const { blobs } = await list({ prefix: BLOB_CONFIG_KEY, limit: 1 });
      const match = blobs.find((b) => b.pathname === BLOB_CONFIG_KEY) || blobs[0];
      if (!match) {
        return { ...DEFAULT_CONFIG };
      }
      const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        return { ...DEFAULT_CONFIG };
      }
      const parsed = await res.json();
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (err) {
      console.error('Error reading config from Vercel Blob:', err);
      return { ...DEFAULT_CONFIG };
    }
  }

  if (IS_VERCEL) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      return { ...DEFAULT_CONFIG };
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Error reading local config:', err);
    return { ...DEFAULT_CONFIG };
  }
}

async function writeConfig(nextConfig) {
  if (USE_BLOB) {
    await put(BLOB_CONFIG_KEY, JSON.stringify(nextConfig, null, 2), {
      access: 'public',
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      contentType: 'application/json'
    });
    return;
  }

  if (IS_VERCEL) {
    throw new Error(
      'Falta conectar Vercel Blob (BLOB_READ_WRITE_TOKEN) en tu proyecto de Vercel para guardar el menú.'
    );
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(nextConfig, null, 2), 'utf8');
}

function sanitizePublicConfig(cfg) {
  return {
    title: cfg.title,
    subtitle: cfg.subtitle,
    dailyTitle: cfg.dailyTitle,
    menuImage: cfg.menuImage,
    hasCustomMenu: Boolean(cfg.hasCustomMenu),
    menuMeta: cfg.menuMeta,
    introVideo: cfg.introVideo || ''
  };
}

async function requireAdmin(req, res, next) {
  try {
    const cfg = await readConfig();
    const pin = req.headers['x-admin-pin'];
    if (!pin || String(pin) !== String(cfg.adminPin)) {
      return res.status(401).json({ error: 'PIN incorrecto o no autorizado.' });
    }
    req.currentConfig = cfg;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function removeFilesByPrefix(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(prefix)) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch (e) {
        console.warn('Could not delete old upload:', file, e.message);
      }
    }
  }
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes JPG, PNG o WEBP.'), ok);
  }
});

app.use(express.json());

if (!USE_BLOB && !IS_VERCEL) {
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '5m' }));
}
app.use(express.static(PUBLIC_DIR));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/api/menu', async (_req, res) => {
  const cfg = await readConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.json(sanitizePublicConfig(cfg));
});

app.post('/api/auth', async (req, res) => {
  const cfg = await readConfig();
  const { pin } = req.body || {};
  if (!pin || String(pin) !== String(cfg.adminPin)) {
    return res.status(401).json({ ok: false, error: 'PIN incorrecto.' });
  }
  res.json({ ok: true, config: sanitizePublicConfig(cfg) });
});

app.post('/api/menu', requireAdmin, (req, res) => {
  imageUpload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error al subir la imagen.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar una foto del menú.' });
    }

    try {
      const cfg = req.currentConfig || (await readConfig());
      const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      const filename = `menu-current-${Date.now()}${safeExt}`;

      if (USE_BLOB) {
        if (cfg.menuImage && cfg.menuImage.includes('blob.vercel-storage.com')) {
          await del(cfg.menuImage).catch(() => {});
        }
        const blob = await put(`rancho-grande/${filename}`, req.file.buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: req.file.mimetype
        });
        cfg.menuImage = blob.url;
      } else if (IS_VERCEL) {
        return res.status(503).json({
          error:
            'Falta conectar Vercel Blob en Vercel Dashboard (Storage → Create → Blob) para guardar fotos en la nube.'
        });
      } else {
        removeFilesByPrefix(UPLOADS_DIR, 'menu-current-');
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        cfg.menuImage = `/uploads/${filename}`;
      }

      const width = Number(req.body.width) || null;
      const height = Number(req.body.height) || null;
      const megapixels =
        width && height ? Number(((width * height) / 1_000_000).toFixed(2)) : null;

      cfg.hasCustomMenu = true;
      cfg.menuMeta = {
        width,
        height,
        megapixels,
        sizeBytes: req.file.size,
        updatedAt: new Date().toISOString(),
        originalName: req.file.originalname
      };

      if (typeof req.body.dailyTitle === 'string') {
        cfg.dailyTitle = req.body.dailyTitle.trim();
      }

      await writeConfig(cfg);
      res.json({ ok: true, config: sanitizePublicConfig(cfg) });
    } catch (saveErr) {
      console.error('Error saving menu photo:', saveErr);
      res.status(500).json({ error: saveErr.message || 'No se pudo guardar el menú.' });
    }
  });
});

app.post('/api/settings', requireAdmin, async (req, res) => {
  try {
    const cfg = req.currentConfig || (await readConfig());
    const { title, subtitle, dailyTitle, newPin } = req.body || {};

    if (typeof title === 'string' && title.trim()) {
      cfg.title = title.trim();
    }
    if (typeof subtitle === 'string' && subtitle.trim()) {
      cfg.subtitle = subtitle.trim();
    }
    if (typeof dailyTitle === 'string') {
      cfg.dailyTitle = dailyTitle.trim();
    }
    if (typeof newPin === 'string' && newPin.trim().length >= 4) {
      cfg.adminPin = newPin.trim();
    }

    await writeConfig(cfg);
    res.json({ ok: true, config: sanitizePublicConfig(cfg) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudo guardar la configuración.' });
  }
});

app.get('/api/qr', async (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const isLocal = /^localhost(?::|$)|^127\.0\.0\.1(?::|$)/i.test(host);
    const defaultUrl =
      process.env.PUBLIC_URL ||
      (isLocal || !host ? 'https://rancho-grande-menu-f4n6.vercel.app' : `${proto}://${host}`);
    const targetUrl = (req.query.url || defaultUrl).toString().trim();
    const format = req.query.format === 'svg' ? 'svg' : 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        width: 512,
        color: { dark: '#2b1608', light: '#fff9ee' }
      });
      res.type('image/svg+xml').send(svg);
      return;
    }

    const buffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      margin: 2,
      width: 800,
      color: { dark: '#2b1608', light: '#fff9ee' }
    });
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', 'attachment; filename="qr-rancho-grande.png"');
    }
    res.type('image/png').send(buffer);
  } catch (err) {
    console.error('QR generation failed:', err);
    res.status(500).json({ error: 'No se pudo generar el código QR.' });
  }
});

if (require.main === module) {
  readConfig().catch(() => {});
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rancho Grande QR Menu server running at http://localhost:${PORT}`);
    console.log(`Admin panel available at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
