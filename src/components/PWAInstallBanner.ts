/**
 * PWAInstallBanner
 *
 * Mobile-only install prompt.
 * - Android/Chrome: captures beforeinstallprompt → one-tap install button
 * - iOS/Safari:     shows "Share → Add to Home Screen" instructions
 *
 * Shown once after a short delay. Dismissed state persists in localStorage.
 */

const STORAGE_KEY = 'wm-pwa-install-dismissed';
const SHOW_DELAY_MS = 8_000;

type InstallMode = 'prompt' | 'ios' | null;

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectMode(): InstallMode {
  // Already installed as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  if ((navigator as { standalone?: boolean }).standalone) return null;

  // Android/Chrome: beforeinstallprompt already fired and was deferred
  if (deferredPrompt) return 'prompt';

  // iOS Safari
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS/i.test(ua)) {
    return 'ios';
  }

  return null;
}

function buildBanner(mode: InstallMode): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pwa-install-banner';

  if (mode === 'prompt') {
    el.innerHTML = `
      <div class="pwa-install-content">
        <span class="pwa-install-icon">📲</span>
        <span class="pwa-install-text">ホーム画面に追加してオフラインでも使えます</span>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn">インストール</button>
        <button class="pwa-install-dismiss" aria-label="閉じる">✕</button>
      </div>
    `;

    el.querySelector('.pwa-install-btn')!.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEY, '1');
      }
      dismiss(el);
    });
  } else {
    // iOS
    el.innerHTML = `
      <div class="pwa-install-content">
        <span class="pwa-install-icon">📲</span>
        <span class="pwa-install-text">
          ホーム画面に追加：
          <strong>共有</strong> <span class="pwa-ios-share">⎋</span> →
          <strong>ホーム画面に追加</strong>
        </span>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-dismiss" aria-label="閉じる">✕</button>
      </div>
    `;
  }

  el.querySelector('.pwa-install-dismiss')!.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    dismiss(el);
  });

  return el;
}

function dismiss(el: HTMLElement): void {
  el.classList.remove('pwa-install-visible');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

export function maybeShowPWAInstallBanner(): void {
  if (localStorage.getItem(STORAGE_KEY)) return;

  setTimeout(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const mode = detectMode();
    if (!mode) return;

    const banner = buildBanner(mode);
    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add('pwa-install-visible'));
    });
  }, SHOW_DELAY_MS);
}

/** Call this from main.ts to capture the install prompt before it fires */
export function capturePWAInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });

  // Re-check after appinstalled (clear deferred)
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(STORAGE_KEY, '1');
  });
}
