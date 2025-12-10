/* ----------/* ---------- Utility ---------- */
function qs(name, url = location.search) {
  const params = new URLSearchParams(url);
  return params.get(name);
}
function safeText(str) {
  if (str === null || str === undefined) return '';
  return String(str);
}
function excerpt(text, n = 420) {
  if (!text) return '';
  if (text.length <= n) return text;
  const cut = text.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : n) + '…';
}
function isUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch(e){ return false; }
}

/* ---------- Config ---------- */
const API_BASE = 'https://api.limenovel.my.id/api';
const STATIC_BASE = 'https://api.limenovel.my.id';

/* ---------- Auth ---------- */
function getToken() {
  return localStorage.getItem('LN_TOKEN') || null;
}
function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

/* ---------- Load DOCX with mammoth ---------- */
async function loadDocxContent(url) {
  try {
    const response = await fetch(url, { 
      headers: { ...authHeaders() },
      mode: 'cors'
    });
    if (!response.ok) throw new Error('Failed to fetch DOCX');
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Use mammoth to convert DOCX to HTML
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    return result.value; // HTML content
  } catch (err) {
    console.error('Error loading DOCX:', err);
    return '[Gagal memuat file DOCX: ' + err.message + ']';
  }
}

/* ---------- Load TXT content ---------- */
async function loadTextContent(url) {
  try {
    const response = await fetch(url, { 
      headers: { ...authHeaders() },
      mode: 'cors'
    });
    if (!response.ok) throw new Error('Failed to fetch text file');
    return await response.text();
  } catch (err) {
    console.error('Error loading text:', err);
    return '[Gagal memuat file: ' + err.message + ']';
  }
}

/* ---------- DOM refs for controls ---------- */
const fontSelect = document.getElementById('fontSelect');
const sizeSlider = document.getElementById('sizeSlider');
const decBtn = document.getElementById('decBtn');
const incBtn = document.getElementById('incBtn');
const presetBtns = document.querySelectorAll('.preset-btn');

/* ---------- Apply & persist font ---------- */
function applyFont(value) {
  document.documentElement.style.setProperty('--font-sans', value);
  document.body.style.fontFamily = value;
  localStorage.setItem('preferredFont', value);
}
const savedFont = localStorage.getItem('preferredFont');
if (savedFont && fontSelect) {
  for (const opt of fontSelect.options) {
    if (opt.value === savedFont) { fontSelect.value = savedFont; break; }
  }
  applyFont(savedFont);
} else if (fontSelect) {
  applyFont(fontSelect.value);
}
if (fontSelect) {
  fontSelect.addEventListener('change', function(){ applyFont(this.value); });
}

/* ---------- Apply & persist size ---------- */
function applySize(px) {
  const bodyPx = Number(px);
  document.documentElement.style.setProperty('--fs-body', bodyPx + 'px');
  document.documentElement.style.setProperty('--fs-h1', Math.round(bodyPx * 1.25) + 'px');
  document.documentElement.style.setProperty('--fs-quote', Math.round(bodyPx * 0.95) + 'px');
  document.documentElement.style.setProperty('--fs-btn', Math.round(bodyPx * 0.875) + 'px');
  document.documentElement.style.setProperty('--fs-meta', Math.round(bodyPx * 0.8125) + 'px');
  document.documentElement.style.setProperty('--fs-small', Math.round(bodyPx * 0.75) + 'px');

  if (sizeSlider) sizeSlider.value = bodyPx;
  localStorage.setItem('preferredSize', String(bodyPx));
}

const savedSize = parseInt(localStorage.getItem('preferredSize'), 10);
if (!isNaN(savedSize)) applySize(savedSize);
else if (sizeSlider) applySize(Number(sizeSlider.value || 16));

if (sizeSlider) {
  sizeSlider.addEventListener('input', function(){ applySize(this.value); });
}
if (decBtn) {
  decBtn.addEventListener('click', function(){ applySize(Math.max(12, Number(sizeSlider.value) - 1)); });
}
if (incBtn) {
  incBtn.addEventListener('click', function(){ applySize(Math.min(24, Number(sizeSlider.value) + 1)); });
}

if (presetBtns) {
  presetBtns.forEach(btn => {
    btn.addEventListener('click', function(){
      const s = Number(this.getAttribute('data-size'));
      applySize(s);
    });
  });
}

/* ---------- Back button ---------- */
const backBtn = document.getElementById('backBtn');
if (backBtn) {
  backBtn.addEventListener('click', function(e){
    e.preventDefault();
    const novelId = qs('id');
    if (novelId) {
      location.href = 'desk.html?id=' + encodeURIComponent(novelId);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      location.href = 'index.html';
    }
  });
}

/* ---------- Main: fetch data and render ---------- */
(async function main(){
  const app = document.getElementById('app');
  const novelId = qs('id');
  const chapterIndexStr = qs('ch');

  if (!app) {
    console.error('Element #app not found');
    return;
  }

  if (!novelId || chapterIndexStr === null) {
    app.innerHTML = '<div class="error">Parameter URL tidak lengkap (id atau ch tidak ditemukan).</div>';
    return;
  }

  try {
    app.innerHTML = '<div style="text-align:center;padding:40px;">Loading...</div>';

    // Fetch novel data from API
    const res = await fetch(`${API_BASE}/novels/${novelId}`, { 
      headers: { ...authHeaders() },
      cache: 'no-cache' 
    });
    
    if (!res.ok) throw new Error('Gagal mengambil data novel: ' + res.status);
    const data = await res.json();
    const series = data.novel || data;

    if (!series) {
      app.innerHTML = '<div class="error">Novel tidak ditemukan untuk id=' + safeText(novelId) + '.</div>';
      return;
    }

    const chapters = Array.isArray(series.chapters) ? series.chapters : [];
    const chIndex = parseInt(chapterIndexStr, 10);

    if (isNaN(chIndex) || chIndex < 0 || chIndex >= chapters.length) {
      app.innerHTML = '<div class="error">Chapter tidak ditemukan.</div>';
      return;
    }

    const chapter = chapters[chIndex];
    const seriesTitle = series.title || 'Unknown Series';
    const cover = series.img || '';
    const chapterTitle = chapter.title || ('Chapter ' + (chIndex + 1));
    const views = chapter.views || 0;

    // Load chapter content
    let rawContent = '';
    let contentHTML = '';
    
    if (chapter.content && isUrl(chapter.content)) {
      const contentUrl = chapter.content.startsWith('http') 
        ? chapter.content 
        : `${STATIC_BASE}${chapter.content}`;
      
      // Check file extension
      if (contentUrl.endsWith('.docx')) {
        contentHTML = await loadDocxContent(contentUrl);
        rawContent = contentHTML.replace(/<[^>]+>/g, ''); // Strip HTML for excerpt
      } else {
        rawContent = await loadTextContent(contentUrl);
        contentHTML = rawContent.replace(/\n/g, '<br>');
      }
    } else {
      rawContent = chapter.content || '[Konten tidak tersedia]';
      contentHTML = rawContent.replace(/\n/g, '<br>');
    }

    // Render card
    app.innerHTML = `
      <article class="read-card" aria-label="Kartu bab novel">
        <div style="overflow:hidden;">
          ${ cover ? `<img class="cover" src="${cover}" alt="Cover ${safeText(seriesTitle)}">` : '' }
          <div style="overflow:hidden;">
            <div class="meta"><strong>Series</strong> • <span>${safeText(seriesTitle)}</span></div>
            <h1>${safeText(chapterTitle)}</h1>
            <div class="meta">Views: <strong>${safeText(views)}</strong></div>
          </div>
        </div>

        <blockquote aria-label="Cuplikan bab">${safeText(excerpt(rawContent, 420))}</blockquote>

        <div class="controls" role="navigation" aria-label="Navigasi bab">
          <a class="btn ghost" id="prevBtn" href="#" aria-label="Bab sebelumnya">‹ Bab Sebelumnya</a>
          <a class="btn primary" id="readBtn" href="#" aria-label="Baca bab ini">Baca Penuh</a>
          <a class="btn ghost" id="nextBtn" href="#" aria-label="Bab berikutnya">Bab Berikutnya ›</a>
          ${chapter.content && isUrl(chapter.content) ? '<a class="btn raw" id="rawLink" href="#" target="_blank" aria-label="Buka file raw" style="margin-left:auto;">Buka Raw</a>' : ''}
        </div>

        <span class="small">Estimasi waktu baca: ~12 menit</span>
      </article>
    `;

    // Navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const readBtn = document.getElementById('readBtn');
    const rawLink = document.getElementById('rawLink');

    // Previous button
    if (chIndex > 0) {
      const prevIndex = chIndex - 1;
      prevBtn.href = location.pathname + '?id=' + encodeURIComponent(novelId) + '&ch=' + prevIndex;
    } else {
      prevBtn.href = '#';
      prevBtn.setAttribute('aria-disabled', 'true');
      prevBtn.style.opacity = '0.6';
      prevBtn.onclick = (e) => e.preventDefault();
    }

    // Next button
    if (chIndex < chapters.length - 1) {
      const nextIndex = chIndex + 1;
      nextBtn.href = location.pathname + '?id=' + encodeURIComponent(novelId) + '&ch=' + nextIndex;
    } else {
      nextBtn.href = '#';
      nextBtn.setAttribute('aria-disabled', 'true');
      nextBtn.style.opacity = '0.6';
      nextBtn.onclick = (e) => e.preventDefault();
    }

    // Raw link
    if (rawLink && chapter.content && isUrl(chapter.content)) {
      rawLink.href = chapter.content.startsWith('http') 
        ? chapter.content 
        : `${STATIC_BASE}${chapter.content}`;
    }

    // Reader modal
    function openReader() {
      const reader = document.createElement('div');
      reader.className = 'reader';
      reader.innerHTML = `
        <div class="sheet" role="dialog" aria-label="Reader penuh">
          <a href="#" class="close closeReader">Tutup</a>
          <h2>${safeText(seriesTitle)} — ${safeText(chapterTitle)}</h2>
          <div id="chapterBody" class="chapter-content" style="margin-top:12px;"></div>
          <a href="#" class="close closeReader">Tutup</a>
        </div>
      `;
      document.body.appendChild(reader);

      reader.querySelectorAll('.closeReader').forEach(btn => {
        btn.onclick = function(e) {
          e.preventDefault();
          document.body.removeChild(reader);
        };
      });

      const bodyEl = reader.querySelector('#chapterBody');
      bodyEl.innerHTML = contentHTML; // Use HTML content (for DOCX) or plain text

      reader.addEventListener('click', (e) => {
        if (e.target === reader) {
          reader.classList.remove('show');
          reader.classList.add('hide');
          setTimeout(() => {
            if (document.body.contains(reader)) {
              document.body.removeChild(reader);
            }
          }, 300);
        }
      });
    }

    readBtn.onclick = function(e){
      e.preventDefault();
      openReader();
    };

    // Keyboard shortcut: Escape
    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') {
        location.href = 'desk.html?id=' + encodeURIComponent(novelId);
      }
    });

  } catch (err) {
    console.error(err);
    app.innerHTML = '<div class="error">Terjadi kesalahan saat memuat data. ' + safeText(err.message) + '</div>';
  }
})();