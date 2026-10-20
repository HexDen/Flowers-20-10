(() => {
  'use strict';

  const album = document.getElementById('memoryAlbum');
  const toggle = document.getElementById('toggleAlbum');
  const edit = document.getElementById('editAlbum');
  const addCard = document.getElementById('addCard');
  const restoreAlbum = document.getElementById('restoreAlbum');
  const hint = document.getElementById('albumEditHint');
  const status = document.getElementById('albumStatus');
  const photosContainer = document.getElementById('albumPhotos');
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const PHOTO_KEY_PREFIX = 'flower.album.photo.20-10.v1.';
  const STRUCTURE_KEY = 'flower.album.structure.20-10.v1';

  let editing = false;

  const DEFAULT_STRUCTURE = [
    {
      key: '0',
      original: './assets/portrait-placeholder.webp',
      dedication: 'Một nụ cười rất thương.',
      date: 'Những ngày thật vui',
      alt: 'Ảnh kỷ niệm thứ nhất của người nhận thiệp'
    },
    {
      key: '1',
      original: './assets/portrait-placeholder.webp',
      dedication: 'Bình yên từ điều nhỏ.',
      date: 'Một khoảnh khắc dịu dàng',
      alt: 'Ảnh kỷ niệm thứ hai của người nhận thiệp'
    },
    {
      key: '2',
      original: './assets/portrait-placeholder.webp',
      dedication: 'Mong bạn luôn rạng rỡ.',
      date: 'Hôm nay và cả mai sau',
      alt: 'Ảnh kỷ niệm thứ ba của người nhận thiệp'
    }
  ];

  function getCardIndex(card) {
    return [...photosContainer.querySelectorAll('.album-card')].indexOf(card);
  }

  function isCustomized() {
    try {
      if (localStorage.getItem(STRUCTURE_KEY) !== null) return true;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PHOTO_KEY_PREFIX)) return true;
      }
    } catch {}
    return false;
  }

  function updateRestoreButton() {
    if (!restoreAlbum) return;
    restoreAlbum.hidden = !editing || !isCustomized();
  }

  function setEditing(open) {
    editing = open;
    if (open && !album.classList.contains('is-spread')) toggle.click();
    photosContainer.querySelectorAll('.photo-actions').forEach(actions => {
      actions.hidden = !open;
    });
    hint.hidden = !open;
    if (addCard) addCard.hidden = !open;
    updateRestoreButton();
    edit.setAttribute('aria-expanded', String(open));
    edit.textContent = open ? 'Xong' : 'Thay ảnh ✎';
  }

  edit.addEventListener('click', () => setEditing(!editing));
  toggle.addEventListener('click', () => {
    if (editing && !album.classList.contains('is-spread')) setEditing(false);
  });

  async function preparePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fffdfb';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', .85);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function saveDomStructure() {
    const domCards = [...photosContainer.querySelectorAll('.album-card')];
    const structure = domCards.map((c, i) => {
      const img = c.querySelector('img');
      const ded = c.querySelector('.portrait-dedication');
      const dt = c.querySelector('.portrait-date');
      return {
        key: c.dataset.key || String(i),
        original: c.dataset.original || (img ? img.getAttribute('src') : './assets/portrait-placeholder.webp'),
        dedication: ded ? ded.textContent : '',
        date: dt ? dt.textContent : '',
        alt: img ? img.getAttribute('alt') : ''
      };
    });
    try {
      localStorage.setItem(STRUCTURE_KEY, JSON.stringify(structure));
    } catch {}
  }

  function checkEmptyState() {
    const count = photosContainer.querySelectorAll('.album-card').length;
    const emptyEl = photosContainer.querySelector('.album-empty');
    if (count === 0) {
      if (!emptyEl) {
        const div = document.createElement('div');
        div.className = 'album-empty';
        div.setAttribute('role', 'status');
        div.innerHTML = `
          <p>Album hiện chưa có ảnh nào.</p>
          <div class="empty-actions">
            <button id="emptyAddBtn" class="text-button" type="button">Thêm khung ảnh <span aria-hidden="true">+</span></button>
            <button id="emptyRestoreBtn" class="text-button" type="button">Khôi phục 3 ảnh ban đầu <span aria-hidden="true">↺</span></button>
          </div>
        `;
        photosContainer.appendChild(div);
        div.querySelector('#emptyAddBtn').addEventListener('click', onAddCard);
        div.querySelector('#emptyRestoreBtn').addEventListener('click', onRestoreAlbum);
      }
    } else if (emptyEl) {
      emptyEl.remove();
    }
  }

  function createCardElement(item) {
    const figure = document.createElement('figure');
    figure.className = 'portrait-card album-card';
    figure.dataset.key = item.key;
    figure.dataset.original = item.original;
    figure.innerHTML = `
      <div class="portrait-photo"><img src="${item.original}" alt="${item.alt || 'Ảnh kỷ niệm'}" width="768" height="1024" decoding="async" loading="lazy"></div>
      <figcaption><span class="portrait-dedication">${item.dedication}</span><span class="portrait-date">${item.date}</span></figcaption>
      <div class="photo-actions" ${editing ? '' : 'hidden'}>
        <button class="text-button change-photo" type="button" aria-label="Đổi ảnh">Đổi ảnh</button>
        <button class="text-button reset-photo" type="button" aria-label="Gỡ ảnh đã tải lên" disabled>Gỡ ảnh</button>
        <button class="text-button delete-card" type="button" aria-label="Xóa khung ảnh khỏi album">Xóa khung</button>
        <input class="photo-input" type="file" accept="image/*" aria-label="Chọn ảnh" hidden>
      </div>
    `;
    return figure;
  }

  async function bindCard(card, keyId, originalSrc) {
    const photo = card.querySelector('img');
    const input = card.querySelector('.photo-input');
    const change = card.querySelector('.change-photo');
    const reset = card.querySelector('.reset-photo');
    const deleteBtn = card.querySelector('.delete-card');
    const original = originalSrc || card.dataset.original || photo.getAttribute('src');
    const key = `${PHOTO_KEY_PREFIX}${keyId}`;
    let busy = false;

    change.addEventListener('click', () => {
      input.value = '';
      input.click();
    });

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file || busy) return;
      if (!file.type.startsWith('image/')) {
        status.textContent = 'Bạn chọn một tệp ảnh nhé (JPG, PNG hoặc WebP).';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        status.textContent = 'Ảnh quá lớn. Bạn chọn ảnh nhỏ hơn hoặc bằng 20 MB nhé.';
        return;
      }
      busy = true;
      change.disabled = true;
      reset.disabled = true;
      if (deleteBtn) deleteBtn.disabled = true;
      card.setAttribute('aria-busy', 'true');
      const idx = getCardIndex(card);
      status.textContent = `Đang xử lý ảnh thứ ${idx >= 0 ? idx + 1 : 1}…`;
      const previous = photo.getAttribute('src');
      try {
        const data = await preparePhoto(file);
        photo.src = data;
        await photo.decode();
        try {
          localStorage.setItem(key, data);
          const currentIdx = getCardIndex(card);
          status.textContent = `Đã lưu ảnh thứ ${currentIdx >= 0 ? currentIdx + 1 : 1}.`;
        } catch {
          status.textContent = 'Đã thay ảnh. Trình duyệt chưa lưu được ảnh để dùng lần sau; bạn có thể giải phóng bộ nhớ rồi chọn lại ảnh.';
        }
      } catch {
        photo.src = previous;
        status.textContent = 'Chưa đọc được ảnh này. Bạn thử ảnh JPG, PNG hoặc WebP khác nhé.';
      } finally {
        busy = false;
        change.disabled = false;
        reset.disabled = photo.getAttribute('src') === original;
        if (deleteBtn) deleteBtn.disabled = false;
        card.removeAttribute('aria-busy');
        updateRestoreButton();
      }
    });

    reset.addEventListener('click', () => {
      photo.src = original;
      input.value = '';
      reset.disabled = true;
      try {
        localStorage.removeItem(key);
        const currentIdx = getCardIndex(card);
        status.textContent = `Đã khôi phục ảnh thứ ${currentIdx >= 0 ? currentIdx + 1 : 1}.`;
      } catch {
        status.textContent = 'Đã khôi phục ảnh. Trình duyệt chưa lưu được thay đổi để dùng lần sau.';
      }
      updateRestoreButton();
      change.focus({ preventScroll: true });
    });

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem(key);
        } catch {}

        card.remove();
        saveDomStructure();
        status.textContent = 'Đã xóa khung ảnh khỏi album.';
        checkEmptyState();
        updateRestoreButton();
        edit.focus({ preventScroll: true });
      });
    }

    try {
      const saved = localStorage.getItem(key);
      if (!saved || !saved.startsWith('data:image/jpeg;base64,')) return;
      const image = new Image();
      image.src = saved;
      await image.decode();
      photo.src = saved;
      reset.disabled = false;
    } catch {
      // Leave the original photo in place when storage is blocked or the saved image is invalid.
    }
  }

  function onAddCard() {
    const empty = photosContainer.querySelector('.album-empty');
    if (empty) empty.remove();

    const newKey = `c_${Date.now()}`;
    const item = {
      key: newKey,
      original: './assets/portrait-placeholder.webp',
      dedication: 'Khoảnh khắc ngọt ngào.',
      date: 'Kỷ niệm yêu thương',
      alt: 'Ảnh kỷ niệm mới trong album'
    };
    const card = createCardElement(item);
    photosContainer.appendChild(card);
    bindCard(card, item.key, item.original);
    saveDomStructure();
    status.textContent = 'Đã thêm một khung ảnh mới vào album.';
    updateRestoreButton();

    const changeBtn = card.querySelector('.change-photo');
    if (changeBtn) changeBtn.focus({ preventScroll: true });
  }
  if (addCard) addCard.addEventListener('click', onAddCard);

  async function onRestoreAlbum() {
    try {
      localStorage.removeItem(STRUCTURE_KEY);
    } catch {}

    photosContainer.innerHTML = '';
    const initial = DEFAULT_STRUCTURE;
    const cards = initial.map(item => {
      const c = createCardElement(item);
      photosContainer.appendChild(c);
      return c;
    });

    await Promise.allSettled(cards.map((c, i) => bindCard(c, initial[i].key, initial[i].original)));
    status.textContent = 'Đã khôi phục album về 3 khung ảnh ban đầu.';
    checkEmptyState();
    updateRestoreButton();
  }
  if (restoreAlbum) restoreAlbum.addEventListener('click', onRestoreAlbum);

  async function initAlbum() {
    let savedStructure = null;
    try {
      const raw = localStorage.getItem(STRUCTURE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) savedStructure = parsed;
      }
    } catch {}

    if (savedStructure !== null) {
      photosContainer.innerHTML = '';
      if (savedStructure.length === 0) {
        checkEmptyState();
        return;
      }
      const cards = savedStructure.map(item => {
        const c = createCardElement(item);
        photosContainer.appendChild(c);
        return c;
      });
      await Promise.allSettled(cards.map((c, i) => bindCard(c, savedStructure[i].key, savedStructure[i].original)));
    } else {
      const domCards = [...photosContainer.querySelectorAll('.album-card')];
      await Promise.allSettled(domCards.map((c, i) => {
        const key = c.dataset.key || String(i);
        const orig = c.dataset.original || c.querySelector('img').getAttribute('src');
        c.dataset.key = key;
        c.dataset.original = orig;
        return bindCard(c, key, orig);
      }));
    }
    updateRestoreButton();
  }

  window.albumPhotosReady = initAlbum();
})();
