/**
 * ScreenManager — manages a stack of game screens
 */
export class ScreenManager {
  constructor(canvas, uiOverlay, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.uiOverlay = uiOverlay;
    this.input = input;
    this.audio = audio;
    this._stack = [];
  }

  push(screen) {
    const top = this._stack[this._stack.length - 1];
    if (top?.onPause) top.onPause();
    screen.manager = this;
    this._stack.push(screen);
    if (screen.onEnter) screen.onEnter();
  }

  pop() {
    if (!this._stack.length) return;
    const top = this._stack.pop();
    if (top.onExit) top.onExit();
    if (top.destroy) top.destroy();
    const next = this._stack[this._stack.length - 1];
    if (next?.onResume) next.onResume();
  }

  replace(screen) {
    if (this._stack.length) this.pop();
    this.push(screen);
  }

  update(dt) {
    const top = this._stack[this._stack.length - 1];
    top?.update?.(dt);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const top = this._stack[this._stack.length - 1];
    top?.draw?.(ctx);
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }
}
