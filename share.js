(() => {
  'use strict';

  // Built-in free cloud image upload configuration (100% automated for users)
  const CLOUD_UPLOAD_KEY = 'd3606f71d5334c9c1bdf739a83a0429f';

  async function compressData(dataObj) {
    const jsonStr = JSON.stringify(dataObj);
    if (typeof CompressionStream === 'function') {
      try {
        const encoder = new TextEncoder();
        const stream = new Blob([encoder.encode(jsonStr)]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
        const buffer = await new Response(compressedStream).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return 'z_' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch (e) {
        console.warn('CompressionStream fallback', e);
      }
    }
    return 'b_' + encodeURIComponent(jsonStr);
  }

  async function decompressData(code) {
    if (code.startsWith('z_')) {
      const b64Url = code.slice(2);
      let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const stream = new Blob([bytes]).stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
      const buffer = await new Response(decompressedStream).arrayBuffer();
      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(buffer));
    }
    if (code.startsWith('b_')) {
      return JSON.parse(decodeURIComponent(code.slice(2)));
    }
    try {
      return JSON.parse(decodeURIComponent(escape(atob(code))));
    } catch {
      return JSON.parse(code);
    }
  }

  async function uploadImageToCloud(base64DataUrl) {
    const cleanBase64 = base64DataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const formData = new FormData();
    formData.append('image', cleanBase64);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(CLOUD_UPLOAD_KEY)}`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error && json.error.message ? json.error.message : 'Tải ảnh thất bại');
    }
    return json.data.display_url || json.data.url;
  }

  function getShareParam() {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('c')) return searchParams.get('c');
    if (window.location.hash.startsWith('#c=')) return window.location.hash.slice(3);
    if (window.location.hash.startsWith('#share=')) return window.location.hash.slice(7);
    return null;
  }

  function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showSharedBanner(recipient, sender) {
    if (document.getElementById('sharedBanner')) return;
    const banner = document.createElement('aside');
    banner.id = 'sharedBanner';
    banner.className = 'shared-banner';
    banner.setAttribute('role', 'status');
    const cleanPath = window.location.origin + window.location.pathname;
    banner.innerHTML = `
      <div class="shared-banner-inner">
        <span class="shared-banner-icon">🌸</span>
        <span class="shared-banner-text">Thiệp & album này được chuẩn bị riêng cho <strong>${escapeText(recipient || 'bạn')}</strong> từ <strong>${escapeText(sender || 'người gửi')}</strong> ♡</span>
        <a href="${cleanPath}" class="shared-banner-link">Tự tạo thiệp của bạn</a>
      </div>
    `;
    const main = document.querySelector('main') || document.body;
    main.prepend(banner);
  }

  async function checkSharedView() {
    const code = getShareParam();
    if (!code) return;

    try {
      const payload = await decompressData(code);
      if (!payload) return;

      if (window.albumPhotosReady) {
        await window.albumPhotosReady;
      }

      if (window.flowerGreeting && (payload.to || payload.msg || payload.from)) {
        window.flowerGreeting.set({
          recipient: payload.to || 'bạn',
          message: payload.msg || '',
          sender: payload.from || 'Một người quý mến bạn'
        });
      }

      if (window.flowerAlbum && Array.isArray(payload.photos) && payload.photos.length > 0) {
        const cardsData = payload.photos.map(p => ({
          src: p.url || p.src || './assets/portrait-placeholder.webp',
          dedication: p.ded || p.dedication || '',
          date: p.date || '',
          alt: p.alt || 'Ảnh kỷ niệm'
        }));
        await window.flowerAlbum.setCards(cardsData);
      }

      showSharedBanner(payload.to, payload.from);
    } catch (err) {
      console.warn('Không thể nạp dữ liệu từ link chia sẻ:', err);
    }
  }

  function initShareUI() {
    const shareDialog = document.getElementById('shareDialog');
    const closeBtn = document.getElementById('closeShareDialog');
    const shareCardBtn = document.getElementById('shareCard');
    const shareAlbumBtn = document.getElementById('shareAlbumBtn');
    const generateBtn = document.getElementById('generateShareBtn');
    const statusText = document.getElementById('shareStatus');
    const resultArea = document.getElementById('shareResultArea');
    const linkInput = document.getElementById('shareLinkInput');
    const copyBtn = document.getElementById('copyShareBtn');
    const copyFeedback = document.getElementById('copyFeedback');
    const zaloBtn = document.getElementById('shareZaloBtn');
    const messengerBtn = document.getElementById('shareMessengerBtn');
    const previewBtn = document.getElementById('previewShareBtn');
    const qrImg = document.getElementById('shareQrImg');
    const nativeShareBtn = document.getElementById('nativeShareBtn');

    if (!shareDialog) return;

    function openDialog() {
      const greeting = window.flowerGreeting ? window.flowerGreeting.get() : { recipient: 'bạn', sender: 'Một người quý mến bạn' };
      const cards = window.flowerAlbum ? window.flowerAlbum.getCards() : [];

      const sumRecipient = document.getElementById('summaryRecipient');
      const sumSender = document.getElementById('summarySender');
      const sumCount = document.getElementById('summaryPhotoCount');

      if (sumRecipient) sumRecipient.textContent = greeting.recipient || 'bạn';
      if (sumSender) sumSender.textContent = greeting.sender || 'Một người quý mến bạn';
      if (sumCount) sumCount.textContent = `${cards.length} ảnh trong album`;

      if (resultArea) resultArea.hidden = true;
      if (statusText) statusText.textContent = '';
      if (copyFeedback) copyFeedback.textContent = '';

      if (nativeShareBtn) {
        nativeShareBtn.hidden = !navigator.share;
      }

      shareDialog.showModal();
    }

    if (shareCardBtn) shareCardBtn.addEventListener('click', openDialog);
    if (shareAlbumBtn) shareAlbumBtn.addEventListener('click', openDialog);
    if (closeBtn) closeBtn.addEventListener('click', () => shareDialog.close());

    shareDialog.addEventListener('click', (event) => {
      if (event.target === shareDialog) shareDialog.close();
    });

    if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true;
        if (resultArea) resultArea.hidden = true;
        if (copyFeedback) copyFeedback.textContent = '';
        statusText.textContent = 'Đang chuẩn bị lời chúc và album ảnh…';

        const greeting = window.flowerGreeting ? window.flowerGreeting.get() : { recipient: 'bạn', message: '', sender: 'Một người quý mến bạn' };
        const cards = window.flowerAlbum ? window.flowerAlbum.getCards() : [];

        const processedPhotos = [];
        let uploadFailed = false;

        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          let photoUrl = card.src;

          if (photoUrl && photoUrl.startsWith('data:image/')) {
            statusText.textContent = `Đang xử lý ảnh ${i + 1}/${cards.length}…`;
            try {
              photoUrl = await uploadImageToCloud(photoUrl);
            } catch (err) {
              uploadFailed = true;
            }
          }

          processedPhotos.push({
            url: photoUrl,
            ded: card.dedication,
            date: card.date,
            alt: card.alt
          });
        }

        statusText.textContent = 'Đang tạo đường link riêng cho bạn…';

        const payload = {
          v: 1,
          to: greeting.recipient,
          msg: greeting.message,
          from: greeting.sender,
          photos: processedPhotos
        };

        try {
          const code = await compressData(payload);
          const isLargeHash = uploadFailed || code.length > 1500;
          const shareUrl = isLargeHash
            ? `${window.location.origin}${window.location.pathname}#c=${code}`
            : `${window.location.origin}${window.location.pathname}?c=${code}`;

          linkInput.value = shareUrl;

          if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
          }

          if (zaloBtn) {
            zaloBtn.href = `https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`;
          }
          if (messengerBtn) {
            messengerBtn.href = `fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`;
          }
          if (previewBtn) {
            previewBtn.href = shareUrl;
          }

          if (resultArea) resultArea.hidden = false;
          statusText.textContent = 'Đã tạo link chia sẻ riêng thành công! ♡';
          linkInput.select();
        } catch (err) {
          statusText.textContent = `Chưa tạo được link: ${err.message}`;
        } finally {
          generateBtn.disabled = false;
        }
      });
    }

    if (copyBtn && linkInput) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(linkInput.value);
          copyFeedback.textContent = '✓ Đã sao chép link vào bộ nhớ tạm! Dán vào Zalo hoặc Messenger để gửi nhé.';
        } catch {
          linkInput.select();
          document.execCommand('copy');
          copyFeedback.textContent = '✓ Đã sao chép link!';
        }
      });
    }

    if (nativeShareBtn) {
      nativeShareBtn.addEventListener('click', async () => {
        if (!navigator.share || !linkInput.value) return;
        const greeting = window.flowerGreeting ? window.flowerGreeting.get() : { recipient: 'bạn' };
        try {
          await navigator.share({
            title: `Bó hoa và thiệp 20/10 gửi tặng ${greeting.recipient || 'bạn'} ♡`,
            text: `Gửi tặng ${greeting.recipient || 'bạn'} một bó hoa và thiệp chúc mừng 20/10 thật dịu dàng:`,
            url: linkInput.value
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Native share error:', err);
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      checkSharedView();
      initShareUI();
    });
  } else {
    checkSharedView();
    initShareUI();
  }
})();
