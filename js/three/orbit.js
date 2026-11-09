// Minimal orbit offset: the scene owns the framed target per stage; the viewer can
// rotate around it by dragging or with arrow keys, and zoom with +/- keys.
// The mouse wheel is deliberately NOT captured, so page scrolling is never hijacked.

export class OrbitOffset {
  constructor(el, onChange) {
    this.el = el;
    this.onChange = onChange;
    this.yaw = 0; this.pitch = 0; this.zoom = 1;
    this.goal = { yaw: 0, pitch: 0, zoom: 1 };
    this.dragging = false;
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._key = this._key.bind(this);
    el.addEventListener('pointerdown', this._down);
    el.addEventListener('keydown', this._key);
  }

  _down(e) {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lx = e.clientX; this.ly = e.clientY;
    this.isTouch = e.pointerType === 'touch';
    this.el.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up, { once: true });
    window.addEventListener('pointercancel', this._up, { once: true });
  }

  _move(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lx, dy = e.clientY - this.ly;
    this.lx = e.clientX; this.ly = e.clientY;
    this.goal.yaw -= dx * 0.006;
    if (!this.isTouch) this.goal.pitch += dy * 0.004; // vertical touch drags scroll the page
    this._clamp();
    this.onChange();
  }

  _up() {
    this.dragging = false;
    window.removeEventListener('pointermove', this._move);
  }

  _key(e) {
    const step = e.shiftKey ? 0.3 : 0.12;
    let used = true;
    switch (e.key) {
      case 'ArrowLeft': this.goal.yaw += step; break;
      case 'ArrowRight': this.goal.yaw -= step; break;
      case 'ArrowUp': this.goal.pitch += step * 0.6; break;
      case 'ArrowDown': this.goal.pitch -= step * 0.6; break;
      case '+': case '=': this.goal.zoom *= 0.9; break;
      case '-': case '_': this.goal.zoom /= 0.9; break;
      case '0': case 'Home': this.reset(); break;
      default: used = false;
    }
    if (used) { e.preventDefault(); this._clamp(); this.onChange(); }
  }

  _clamp() {
    this.goal.yaw = Math.max(-1.9, Math.min(1.9, this.goal.yaw));
    this.goal.pitch = Math.max(-0.35, Math.min(0.7, this.goal.pitch));
    this.goal.zoom = Math.max(0.55, Math.min(1.7, this.goal.zoom));
  }

  reset() { this.goal.yaw = 0; this.goal.pitch = 0; this.goal.zoom = 1; this.onChange(); }

  /** Ease toward the goal; returns true while still moving. */
  update(instant) {
    const k = instant ? 1 : 0.16;
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.zoom += (this.goal.zoom - this.zoom) * k;
    return Math.abs(this.goal.yaw - this.yaw) + Math.abs(this.goal.pitch - this.pitch) + Math.abs(this.goal.zoom - this.zoom) > 1e-4;
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this._down);
    this.el.removeEventListener('keydown', this._key);
  }
}
