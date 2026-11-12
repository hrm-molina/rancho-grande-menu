(() => {
  const PIN_KEY = 'rancho_grande_admin_pin';

  const loginCard = document.getElementById('login-card');
  const loginForm = document.getElementById('login-form');
  const pinInput = document.getElementById('pin-input');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const workspace = document.getElementById('admin-workspace');

  const photoInput = document.getElementById('photo-input');
  const uploadZone = document.getElementById('upload-zone');
  const autoOptimizeCheck = document.getElementById('auto-optimize-check');
  const currentMenuPreview = document.getElementById('current-menu-preview');
  const currentMenuInfo = document.getElementById('current-menu-info');
  const newPreviewBox = document.getElementById('new-preview-box');
  const newMenuPreview = document.getElementById('new-menu-preview');
  const newMenuBadges = document.getElementById('new-menu-badges');
  const publishBtn = document.getElementById('publish-btn');
  const uploadStatus = document.getElementById('upload-status');
  const menuUploadForm = document.getElementById('menu-upload-form');

  const qrUrlInput = document.getElementById('qr-url-input');
  const qrPreviewImg = document.getElementById('qr-preview-img');
  const updateQrBtn = document.getElementById('update-qr-btn');
  const downloadQrBtn = document.getElementById('download-qr-btn');
  const printQrBtn = document.getElementById('print-qr-btn');

  const settingsForm = document.getElementById('settings-form');
  const titleInput = document.getElementById('title-input');
  const subtitleInput = document.getElementById('subtitle-input');
  const newPinInput = document.getElementById('new-pin-input');
  const settingsStatus = document.getElementById('settings-status');

  let activePin = sessionStorage.getItem(PIN_KEY) || '';
  let selectedOriginalFile = null;
  let selectedDims = { width: 0, height: 0 };

  function showStatus(el, msg, isError = false) {
    el.textContent = msg;
    el.className = `status-msg ${isError ? 'err' : 'ok'}`;
    el.classList.remove('hidden');
  }

  function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function populateConfig(cfg) {
    currentMenuPreview.src = `${cfg.menuImage}?t=${Date.now()}`;
    if (cfg.hasCustomMenu && cfg.menuMeta) {
      const m = cfg.menuMeta;
      const dims = m.width && m.height ? `${m.width} × ${m.height} px (${m.megapixels} MP)` : '';
      const when = m.updatedAt ? new Date(m.updatedAt).toLocaleString('es-CL') : '';
      currentMenuInfo.textContent = [dims, formatBytes(m.sizeBytes), when].filter(Boolean).join(' • ');
    } else {
      currentMenuInfo.textContent = 'Imagen de ejemplo inicial';
    }

    titleInput.value = cfg.title || 'Bienvenidos a Rancho Grande';
    subtitleInput.value = cfg.subtitle || 'Comida Casera con Sabor de Campo';
  }

  async function verifyPin(pin) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (!res.ok) return null;
    return res.json();
  }

  function enterAdmin(cfg) {
    loginCard.classList.add('hidden');
    workspace.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    populateConfig(cfg);
    refreshQr(window.location.origin + '/');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const pin = pinInput.value.trim();
    const data = await verifyPin(pin);
    if (!data || !data.ok) {
      showStatus(loginError, 'PIN incorrecto. Intenta nuevamente.', true);
      return;
    }
    activePin = pin;
    sessionStorage.setItem(PIN_KEY, pin);
    enterAdmin(data.config);
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(PIN_KEY);
    activePin = '';
    workspace.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    loginCard.classList.remove('hidden');
    pinInput.value = '';
  });

  // Read image dimensions and preview
  function handleSelectedFile(file) {
    if (!file) return;
    selectedOriginalFile = file;
    uploadStatus.classList.add('hidden');

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      selectedDims = { width: img.naturalWidth, height: img.naturalHeight };
      const mp = ((img.naturalWidth * img.naturalHeight) / 1_000_000).toFixed(2);
      const isTooSmall = img.naturalWidth < 700 || img.naturalHeight < 700;
      const qualityClass = isTooSmall ? 'warn' : 'ok';
      const qualityLabel = isTooSmall
        ? '⚠️ Resolución baja (puede verse borrosa)'
        : img.naturalWidth > 1600
        ? '✅ Alta resolución (se optimizará para QR)'
        : '✅ Resolución ideal';

      newMenuPreview.src = objectUrl;
      newMenuBadges.innerHTML = `
        <span class="badge">${img.naturalWidth} × ${img.naturalHeight} px</span>
        <span class="badge">${mp} MP</span>
        <span class="badge">${formatBytes(file.size)}</span>
        <span class="badge ${qualityClass}">${qualityLabel}</span>
      `;
      newPreviewBox.classList.remove('hidden');
      publishBtn.disabled = false;
    };
    img.onerror = () => {
      showStatus(uploadStatus, 'No se pudo leer la imagen seleccionada.', true);
    };
    img.src = objectUrl;
  }

  photoInput.addEventListener('change', (e) => {
    handleSelectedFile(e.target.files[0]);
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  async function optimizeImageIfNeeded(file) {
    if (!autoOptimizeCheck.checked) {
      return { blob: file, width: selectedDims.width, height: selectedDims.height, name: file.name };
    }

    const MAX_WIDTH = 1440;
    const MAX_HEIGHT = 2560;
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(file);
    });

    let targetW = img.naturalWidth;
    let targetH = img.naturalHeight;

    if (targetW <= MAX_WIDTH && targetH <= MAX_HEIGHT && file.size <= 1.2 * 1024 * 1024) {
      URL.revokeObjectURL(img.src);
      return { blob: file, width: targetW, height: targetH, name: file.name };
    }

    const scale = Math.min(MAX_WIDTH / targetW, MAX_HEIGHT / targetH, 1);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetW, targetH);
    URL.revokeObjectURL(img.src);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return { blob, width: targetW, height: targetH, name: 'menu-hoy.jpg' };
  }

  menuUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedOriginalFile) return;

    publishBtn.disabled = true;
    publishBtn.textContent = '⏳ Subiendo menú...';
    uploadStatus.classList.add('hidden');

    try {
      const prepared = await optimizeImageIfNeeded(selectedOriginalFile);
      const fd = new FormData();
      fd.append('photo', prepared.blob, prepared.name);
      fd.append('width', String(prepared.width));
      fd.append('height', String(prepared.height));

      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'x-admin-pin': activePin },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar.');

      populateConfig(data.config);
      showStatus(
        uploadStatus,
        `✅ ¡Listo! El menú de hoy (${prepared.width}×${prepared.height} px) ya está visible para todos los clientes.`
      );
      selectedOriginalFile = null;
      photoInput.value = '';
      newPreviewBox.classList.add('hidden');
    } catch (err) {
      showStatus(uploadStatus, err.message, true);
      publishBtn.disabled = false;
    } finally {
      publishBtn.textContent = '🚀 Publicar Menú de Hoy';
    }
  });

  // QR Controls
  function refreshQr(url) {
    const cleanUrl = (url || qrUrlInput.value || window.location.origin + '/').trim();
    qrUrlInput.value = cleanUrl;
    const encoded = encodeURIComponent(cleanUrl);
    qrPreviewImg.src = `/api/qr?url=${encoded}&t=${Date.now()}`;
    downloadQrBtn.href = `/api/qr?url=${encoded}&download=1`;
  }

  updateQrBtn.addEventListener('click', () => refreshQr(qrUrlInput.value));
  printQrBtn.addEventListener('click', () => window.print());

  // Text & PIN Settings
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: titleInput.value.trim(),
        subtitle: subtitleInput.value.trim(),
        newPin: newPinInput.value.trim()
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': activePin
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar.');
      if (payload.newPin && payload.newPin.length >= 4) {
        activePin = payload.newPin;
        sessionStorage.setItem(PIN_KEY, activePin);
        newPinInput.value = '';
      }
      populateConfig(data.config);
      showStatus(settingsStatus, '✅ Configuración guardada correctamente.');
    } catch (err) {
      showStatus(settingsStatus, err.message, true);
    }
  });

  // Auto-login if session PIN still valid
  (async () => {
    if (activePin) {
      const data = await verifyPin(activePin);
      if (data && data.ok) {
        enterAdmin(data.config);
      } else {
        sessionStorage.removeItem(PIN_KEY);
        activePin = '';
      }
    }
  })();
})();

