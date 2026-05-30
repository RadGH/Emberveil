/**
 * InputManager — unified input: mouse, touch, keyboard, gamepad
 */
export class InputManager {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.mouse = { x: 0, y: 0, down: false };
    this.keys = new Set();
    this._clicks = [];
    this._listeners = [];

    this._bind('pointermove', canvas, e => this._onMove(e));
    this._bind('pointerdown', canvas, e => this._onDown(e));
    this._bind('pointerup', canvas, e => this._onUp(e));
    this._bind('keydown', window, e => this.keys.add(e.code));
    this._bind('keyup', window, e => this.keys.delete(e.code));
  }

  _bind(event, target, handler) {
    target.addEventListener(event, handler, { passive: true });
    this._listeners.push({ event, target, handler });
  }

  _onMove(e) {
    const r = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / r.width;
    const scaleY = this.canvas.height / r.height;
    this.mouse.x = (e.clientX - r.left) * scaleX;
    this.mouse.y = (e.clientY - r.top) * scaleY;
  }

  _onDown(e) {
    this._onMove(e);
    this.mouse.down = true;
  }

  _onUp(e) {
    this._onMove(e);
    this.mouse.down = false;
    this._clicks.push({ x: this.mouse.x, y: this.mouse.y });
  }

  consumeClicks() {
    const clicks = this._clicks;
    this._clicks = [];
    return clicks;
  }

  isKey(code) { return this.keys.has(code); }

  destroy() {
    for (const { event, target, handler } of this._listeners) {
      target.removeEventListener(event, handler);
    }
  }
}
