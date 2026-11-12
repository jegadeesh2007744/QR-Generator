'use strict';

/* ── Guard ───────────────────────────────────────────────── */
if (typeof QRCode === 'undefined') {
  document.body.innerHTML =
    '<p style="color:red;padding:2rem;font-family:sans-serif">' +
    '❌ qrcode.min.js not found — place it in the same folder.</p>';
  throw new Error('QRCode library missing');
}

/* ── DOM ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const txtArea    = $('txt');
const sizeEl     = $('size');
const eccEl      = $('ecc');
const darkEl     = $('darkC');
const lightEl    = $('lightC');
const genBtn     = $('genBtn');

const result     = $('result');
const qrBox      = $('qrBox');
const btnPng     = $('btnPng');
const btnSvg     = $('btnSvg');
const btnCopy    = $('btnCopy');
const copyStatus = $('copyStatus');

/* ── State ───────────────────────────────────────────────── */
let lastText  = '';
let lastDark  = '#000000';
let lastLight = '#ffffff';
let lastEcc   = 'M';

/* ══════════════════════════════════════════════════════════
   GENERATE
══════════════════════════════════════════════════════════ */
genBtn.addEventListener('click', generate);

txtArea.addEventListener('keydown', e => {
  // Ctrl/Cmd + Enter → generate
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
});

function generate() {
  const text = txtArea.value.trim();
  if (!text) {
    txtArea.focus();
    txtArea.style.borderColor = '#dc2626';
    setTimeout(() => txtArea.style.borderColor = '', 1200);
    return;
  }

  const size  = parseInt(sizeEl.value) || 256;
  const ecc   = eccEl.value;
  const dark  = darkEl.value;
  const light = lightEl.value;

  lastText  = text;
  lastDark  = dark;
  lastLight = light;
  lastEcc   = ecc;

  renderQR(text, size, ecc, dark, light);
}

/* ── Render QR into #qrBox ───────────────────────────────── */
function renderQR(text, size, ecc, dark, light) {
  qrBox.innerHTML = '';
  copyStatus.textContent = '';

  try {
    new QRCode(qrBox, {
      text,
      width:        size,
      height:       size,
      colorDark:    dark,
      colorLight:   light,
      correctLevel: QRCode.CorrectLevel[ecc]
    });
  } catch (err) {
    alert('Could not generate QR code:\n' + err.message);
    console.error(err);
    return;
  }

  // Show result after the library finishes rendering (~1 frame)
  setTimeout(() => {
    result.classList.remove('hidden');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 60);
}

/* ══════════════════════════════════════════════════════════
   DOWNLOAD — PNG
══════════════════════════════════════════════════════════ */
btnPng.addEventListener('click', () => {
  getCanvas().then(cv => {
    if (!cv) return;
    dlLink(cv.toDataURL('image/png'), 'qrcode.png');
  });
});

/* ══════════════════════════════════════════════════════════
   DOWNLOAD — SVG
   Builds SVG by scanning canvas pixels (preserves colors)
══════════════════════════════════════════════════════════ */
btnSvg.addEventListener('click', () => {
  if (!lastText) return;

  // Off-screen QR at fixed 256 px for pixel scan
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
  document.body.appendChild(div);

  try {
    new QRCode(div, {
      text:         lastText,
      width:        256,
      height:       256,
      colorDark:    lastDark,
      colorLight:   lastLight,
      correctLevel: QRCode.CorrectLevel[lastEcc]
    });
  } catch (e) {
    document.body.removeChild(div);
    alert('SVG export failed: ' + e.message);
    return;
  }

  setTimeout(() => {
    const cv = div.querySelector('canvas');
    document.body.removeChild(div);
    if (!cv) { alert('SVG not available.'); return; }

    const W = cv.width, H = cv.height;
    const data = cv.getContext('2d').getImageData(0, 0, W, H).data;

    let rects = '';
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const i  = (y * W + x) * 4;
        const lum = data[i] * .299 + data[i+1] * .587 + data[i+2] * .114;
        if (lum < 128) {
          let w = 0;
          while (x + w < W) {
            const j = (y * W + x + w) * 4;
            if (data[j]*.299 + data[j+1]*.587 + data[j+2]*.114 < 128) w++;
            else break;
          }
          rects += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`;
          x += w;
        } else x++;
      }
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">` +
      `<rect width="${W}" height="${H}" fill="${lastLight}"/>` +
      `<g fill="${lastDark}">${rects}</g></svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    dlLink(URL.createObjectURL(blob), 'qrcode.svg');
  }, 60);
});

/* ══════════════════════════════════════════════════════════
   COPY TO CLIPBOARD
══════════════════════════════════════════════════════════ */
btnCopy.addEventListener('click', () => {
  getCanvas().then(cv => {
    if (!cv) return;

    if (!navigator.clipboard?.write) {
      showStatus('⚠️ Clipboard API not supported — use Download PNG.', false);
      return;
    }

    cv.toBlob(blob => {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => showStatus('✓ Copied to clipboard!', true))
        .catch(() => showStatus('⚠️ Copy blocked — use Download PNG.', false));
    });
  });
});

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

/** Returns the canvas inside qrBox (creates one from <img> if needed) */
function getCanvas() {
  const cv = qrBox.querySelector('canvas');
  if (cv) return Promise.resolve(cv);

  const img = qrBox.querySelector('img');
  if (!img) return Promise.resolve(null);

  return new Promise(res => {
    const tmp = new Image();
    tmp.onload = () => {
      const c  = document.createElement('canvas');
      c.width  = tmp.naturalWidth;
      c.height = tmp.naturalHeight;
      c.getContext('2d').drawImage(tmp, 0, 0);
      res(c);
    };
    tmp.src = img.src;
  });
}

function dlLink(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function showStatus(msg, ok) {
  copyStatus.textContent = msg;
  copyStatus.style.color = ok ? 'var(--green)' : 'var(--red)';
  setTimeout(() => { copyStatus.textContent = ''; }, 3500);
}
