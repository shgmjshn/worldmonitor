/**
 * MobileBottomSheet
 *
 * Flightradar24-style draggable bottom sheet for mobile.
 * 3 snap positions:
 *   peek — 80px visible (default)
 *   half — ~50% of sheet height visible
 *   full — fully open
 *
 * Only the handle bar triggers drag; the inner panels-grid
 * scrolls independently when the sheet is fully open.
 */

export type SheetSnap = 'peek' | 'half' | 'full';

const PEEK_HEIGHT_PX = 80;
const FLICK_VELOCITY_THRESHOLD = 0.4; // px/ms

export class MobileBottomSheet {
  private element: HTMLElement;
  private handleBar: HTMLElement;
  private panelsGrid: HTMLElement;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartTranslateY = 0;
  private lastTouchY = 0;
  private lastTouchTime = 0;
  private velocity = 0;

  private currentSnap: SheetSnap = 'peek';

  private boundOnResize: () => void;

  constructor(element: HTMLElement) {
    this.element = element;
    this.handleBar = element.querySelector('.mobile-sheet-handle-bar') as HTMLElement;
    this.panelsGrid = element.querySelector('.panels-grid') as HTMLElement;

    this.boundOnResize = () => this.applySnap(this.currentSnap, false);

    this.applySnap('peek', false);
    this.setupTouchHandlers();
    window.addEventListener('resize', this.boundOnResize);
  }

  // ── Snap geometry ──────────────────────────────────────────

  private getSnapTranslateY(snap: SheetSnap): number {
    const h = this.element.offsetHeight;
    switch (snap) {
      case 'peek': return h - PEEK_HEIGHT_PX;
      case 'half': return Math.round(h / 2);
      case 'full': return 0;
    }
  }

  private readCurrentTranslateY(): number {
    const m = this.element.style.transform.match(/translateY\((-?[\d.]+)px\)/);
    const capturedTranslateY = m?.[1];
    return capturedTranslateY ? parseFloat(capturedTranslateY) : this.getSnapTranslateY(this.currentSnap);
  }

  // ── Snap application ───────────────────────────────────────

  private applySnap(snap: SheetSnap, animate: boolean): void {
    this.currentSnap = snap;
    const ty = this.getSnapTranslateY(snap);

    if (animate) {
      this.element.classList.add('sheet-transitioning');
      this.element.addEventListener('transitionend', () => {
        this.element.classList.remove('sheet-transitioning');
      }, { once: true });
    }

    this.element.style.transform = `translateY(${ty}px)`;
    this.element.dataset.snap = snap;

    // Allow inner scroll only when fully open
    this.panelsGrid.style.overflowY = snap === 'full' ? 'auto' : 'hidden';
  }

  // ── Snap resolution ────────────────────────────────────────

  private resolveSnap(ty: number, velocity: number): SheetSnap {
    // Velocity-based flick
    if (velocity > FLICK_VELOCITY_THRESHOLD) {
      // Flicking down → collapse one level
      return this.currentSnap === 'full' ? 'half' : 'peek';
    }
    if (velocity < -FLICK_VELOCITY_THRESHOLD) {
      // Flicking up → expand one level
      return this.currentSnap === 'peek' ? 'half' : 'full';
    }

    // Nearest snap by position
    const snaps: SheetSnap[] = ['peek', 'half', 'full'];
    return snaps.reduce((best, s) =>
      Math.abs(ty - this.getSnapTranslateY(s)) < Math.abs(ty - this.getSnapTranslateY(best))
        ? s
        : best
    );
  }

  // ── Touch handlers ─────────────────────────────────────────

  private setupTouchHandlers(): void {
    this.handleBar.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.handleBar.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.handleBar.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }

  private onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    this.isDragging = true;
    this.dragStartY = touch.clientY;
    this.dragStartTranslateY = this.readCurrentTranslateY();
    this.lastTouchY = touch.clientY;
    this.lastTouchTime = Date.now();
    this.velocity = 0;
    this.element.classList.remove('sheet-transitioning');
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;
    const now = Date.now();
    const dt = now - this.lastTouchTime;
    if (dt > 0) {
      this.velocity = (touch.clientY - this.lastTouchY) / dt;
    }
    this.lastTouchY = touch.clientY;
    this.lastTouchTime = now;

    const delta = touch.clientY - this.dragStartY;
    const raw = this.dragStartTranslateY + delta;
    // Clamp: above full(0) or below peek with 40px rubber band
    const max = this.getSnapTranslateY('peek') + 40;
    const ty = Math.max(0, Math.min(raw, max));
    this.element.style.transform = `translateY(${ty}px)`;
  };

  private onTouchEnd = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    const ty = this.readCurrentTranslateY();
    this.applySnap(this.resolveSnap(ty, this.velocity), true);
  };

  // ── Public API ─────────────────────────────────────────────

  public snapTo(snap: SheetSnap, animate = true): void {
    this.applySnap(snap, animate);
  }

  public getSnap(): SheetSnap {
    return this.currentSnap;
  }

  public destroy(): void {
    window.removeEventListener('resize', this.boundOnResize);
    this.handleBar.removeEventListener('touchstart', this.onTouchStart);
    this.handleBar.removeEventListener('touchmove', this.onTouchMove);
    this.handleBar.removeEventListener('touchend', this.onTouchEnd);
  }
}
