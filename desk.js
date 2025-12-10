// =================== Config ===================
const API_BASE = 'https://api.limenovel.my.id/api';
const STATIC_BASE = 'https://api.limenovel.my.id';

// =================== Auth / headers ===================
function getToken() {
  return localStorage.getItem('LN_TOKEN') || null;
}

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

// =================== Helpers ===================
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return `${STATIC_BASE}${url}`;
  return url;
}

// Fungsi untuk load image dengan auth header
async function loadImageWithAuth(url) {
  try {
    const fullUrl = getImageUrl(url);
    const response = await fetch(fullUrl, { 
      headers: { ...authHeaders() },
      mode: 'cors'
    });
    if (!response.ok) {
      console.error('Failed to fetch image:', fullUrl, response.status);
      return null;
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error loading image:', url, err);
    return null;
  }
}

// =================== Get ID from URL ===================
function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// =================== Elements ===================
const chapterList = document.getElementById("chapterList");
const btnNewest = document.getElementById("btnNewest");
const btnOldest = document.getElementById("btnOldest");

let chapters = [];

// =================== Render Chapters ===================
function renderChapters(data) {
  chapterList.innerHTML = "";
  
  data.forEach((chapter, index) => {
    const div = document.createElement("div");
    div.className = "chapter-item";
    
    const novelId = getIdFromUrl();
    // Gunakan index sebagai chapter identifier karena tidak ada _id
    
    div.innerHTML = `
      <div>
        <div onclick="location.href='ch.html?id=${encodeURIComponent(novelId)}&ch=${index}'" style="cursor:pointer;">
          <i class="fas fa-book-open"></i> ${escapeHtml(chapter.title)}
        </div>
        <div class="views"><i class="fas fa-eye"></i> ${escapeHtml(chapter.views || 0)}</div>
      </div>
    `;
    chapterList.appendChild(div);
  });
}

// =================== Load Novel ===================
async function loadNovel() {
  try {
    const id = getIdFromUrl();
    if (!id) {
      document.getElementById('novel-slider').innerHTML = '<p>ID novel tidak ditemukan di URL.</p>';
      return;
    }

    // Show loading
    document.getElementById('novel-slider').innerHTML = '<p style="text-align:center;padding:40px;">Loading...</p>';

    // Fetch novel data dengan auth
    const res = await fetch(`${API_BASE}/novels/${id}`, { 
      headers: { ...authHeaders() } 
    });
    
    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try { 
        const j = await res.json(); 
        if (j && j.message) errText = j.message; 
      } catch {}
      throw new Error('Gagal memuat novel: ' + errText);
    }

    const data = await res.json();
    const novel = data.novel || data;

    if (!novel) {
      document.getElementById('novel-slider').innerHTML = '<p>Novel tidak ditemukan.</p>';
      return;
    }

    // Load image dengan auth
    const imgBlobUrl = await loadImageWithAuth(novel.img);
    const imgSrc = imgBlobUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E';

    // Detail novel
    const detailHTML = `
      <div class="card">
        <img src="${imgSrc}" alt="${escapeHtml(novel.title)}" />
        <h2>${escapeHtml(novel.title)}</h2>
        <div class="meta">
          <i class="fas fa-star"></i> ${escapeHtml(novel.rating || '-')}
          <i class="fas fa-calendar-alt"></i> ${escapeHtml(novel.year || '-')}
          <i class="fas fa-check-circle"></i> ${escapeHtml(novel.status || '-')}
        </div>
        <div class="genre">
          <i class="fas fa-tags"></i> ${escapeHtml([novel.genre1, novel.genre2, novel.genre3].filter(Boolean).join(', ') || '-')}
        </div>
        <button class="btn-back" onclick="location.href='index.html'">
          <i class="fas fa-arrow-left"></i> Kembali
        </button>
      </div>
      <div class="section">
        <h3>Sinopsis</h3>
        <p>${escapeHtml(novel.summary || 'Tidak ada sinopsis.')}</p>
      </div>
    `;
    document.getElementById('novel-slider').innerHTML = detailHTML;

    // Daftar chapter
    chapters = novel.chapters || [];
    renderChapters(chapters);

  } catch (err) {
    console.error('Error fetching API:', err);
    document.getElementById('novel-slider').innerHTML = `<p>Gagal memuat data: ${escapeHtml(err.message)}</p>`;
  }
}

// =================== Tombol urutan chapter ===================
if (btnNewest) {
  btnNewest.addEventListener("click", () => {
    btnNewest.classList.add("active");
    btnOldest.classList.remove("active");
    renderChapters(chapters);
  });
}

if (btnOldest) {
  btnOldest.addEventListener("click", () => {
    btnOldest.classList.add("active");
    btnNewest.classList.remove("active");
    renderChapters([...chapters].slice().reverse());
  });
}

// =================== Jalankan load ===================
loadNovel();
