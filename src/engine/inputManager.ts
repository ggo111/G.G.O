import type { PlayerInputState } from '../types/game.ts';

export type TouchAction =
  | 'move_left'
  | 'move_right'
  | 'boost'
  | 'jump'
  | 'lance_up'
  | 'lance_down'
  | 'lance_slider'
  | 'special';

interface PointerRecord {
  action: TouchAction;
  sliderValue: number; // -1..1 for lance_slider
}

/**
 * Single unified InputManager for G G O fight phase.
 * Combines keyboard keys + multi-touch pointerId tracking into one deterministic
 * PlayerInputState per physics tick without triggering React re-renders.
 */
export class InputManager {
  private heldKeys: Set<string> = new Set();
  private activePointers: Map<number, PointerRecord> = new Map();

  // Edge-triggered tap buffers for Jump & Special weapon
  private pendingJump = false;
  private pendingSpecial = false;
  private sensitivity = 1.0;

  public setSensitivity(val: number) {
    this.sensitivity = Math.max(0.5, Math.min(1.6, val));
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    const code = e.code;
    const key = e.key.toLowerCase();
    if (code === 'ArrowDown') {
      e.preventDefault();
      return false;
    }

    const isGameKey =
      code === 'KeyA' ||
      code === 'KeyD' ||
      code === 'KeyW' ||
      code === 'KeyQ' ||
      code === 'KeyE' ||
      code === 'KeyF' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'ArrowUp' ||
      code === 'Space' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight';

    if (!isGameKey) return false;
    e.preventDefault();

    const wasHeld = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasHeld) {
      if (code === 'KeyW' || code === 'ArrowUp') {
        this.pendingJump = true;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyF' || key === 'f') {
        this.pendingSpecial = true;
      }
    }
    return true;
  }

  public handleKeyUp(e: KeyboardEvent) {
    this.heldKeys.delete(e.code);
  }

  public pointerDown(pointerId: number, action: TouchAction, sliderValue = 0) {
    this.activePointers.set(pointerId, { action, sliderValue });
    if (action === 'jump') {
      this.pendingJump = true;
    }
    if (action === 'special') {
      this.pendingSpecial = true;
    }
  }

  public pointerMove(pointerId: number, sliderValue: number) {
    const rec = this.activePointers.get(pointerId);
    if (rec && rec.action === 'lance_slider') {
      rec.sliderValue = Math.max(-1, Math.min(1, sliderValue));
    }
  }

  public pointerUp(pointerId: number) {
    this.activePointers.delete(pointerId);
  }

  public clearAll() {
    this.heldKeys.clear();
    this.activePointers.clear();
    this.pendingJump = false;
    this.pendingSpecial = false;
  }

  public hasPointer(pointerId: number): boolean {
    return this.activePointers.has(pointerId);
  }

  public hasActiveTouch(action: TouchAction): boolean {
    for (const rec of this.activePointers.values()) {
      if (rec.action === action) return true;
    }
    return false;
  }

  public getSliderValue(): number {
    for (const rec of this.activePointers.values()) {
      if (rec.action === 'lance_slider') return rec.sliderValue;
    }
    return 0;
  }

  /**
   * Produces a single PlayerInputState snapshot for a physics tick.
   * When consumeEdges=true (local/host tick), clears buffered special pulses.
   */
  public readTickInput(consumeEdges = true): PlayerInputState {
    let rawMove = 0;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.hasActiveTouch('move_left')) {
      rawMove -= 1;
    }
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.hasActiveTouch('move_right')) {
      rawMove += 1;
    }
    const move = Math.max(-1, Math.min(1, rawMove * this.sensitivity));

    const boost = this.heldKeys.has('Space') || this.hasActiveTouch('boost');

    let lanceDir = 0;
    if (this.heldKeys.has('KeyQ') || this.hasActiveTouch('lance_up')) {
      lanceDir -= 1;
    }
    if (this.heldKeys.has('KeyE') || this.hasActiveTouch('lance_down')) {
      lanceDir += 1;
    }
    const slider = this.getSliderValue();
    if (Math.abs(slider) > 0.08) {
      lanceDir = slider;
    }
    lanceDir = Math.max(-1, Math.min(1, lanceDir * this.sensitivity));

    const jump = this.pendingJump;
    const special = this.pendingSpecial || this.hasActiveTouch('special');

    if (consumeEdges) {
      this.pendingJump = false;
      this.pendingSpecial = false;
    }

    return {
      move,
      boost,
      jump,
      lanceDir,
      special,
    };
  }
}
