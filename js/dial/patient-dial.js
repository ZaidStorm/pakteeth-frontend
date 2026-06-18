/**
 * Patient Card HUD — Action Buttons Controller
 * Adapted for multiple instances in a grid.
 */

class PatientCardHUD {
  /**
   * @param {string|Element} wrapSelector — wrapper element or CSS selector
   * @param {object} options
   * @param {number} options.spread   — px distance from gear to each button
   * @param {number} options.labelGap — extra px beyond spread for labels
   */
  constructor(wrapSelector, options = {}) {
    this.wrap = typeof wrapSelector === 'string'
      ? document.querySelector(wrapSelector)
      : wrapSelector;

    if (!this.wrap) return;

    this.spread = options.spread ?? 65;
    this.labelGap = options.labelGap ?? 28;
    this.isOpen = false;

    // Find elements within this wrapper
    this.gear = this.wrap.querySelector('.pc-gear');
    this.overlay = this.wrap.querySelector('.pc-glass');

    this.buttons = [
      { type: 'view',   dx: -this.spread, dy: 0 },
      { type: 'edit',   dx: 0,            dy: -this.spread },
      { type: 'delete', dx: this.spread,  dy: 0 },
    ];

    this._init();
  }

  _init() {
    // Park all buttons on top of gear initially
    const center = this._gearCenter();
    if (!center) return;
    const { gx, gy } = center;

    this.buttons.forEach(({ type }) => {
      const btnEl = this.wrap.querySelector(`.pc-hud-btn.${type}`);
      this._place(btnEl, gx, gy);
    });
  }

  /** Returns gear center position relative to wrap */
  _gearCenter() {
    if (!this.gear) return null;
    const wr = this.wrap.getBoundingClientRect();
    const gr = this.gear.getBoundingClientRect();
    return {
      gx: gr.left + gr.width / 2 - wr.left,
      gy: gr.top + gr.height / 2 - wr.top,
    };
  }

  _place(el, x, y) {
    if (!el) return;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._setGearActive(true);
    this._setOverlay(true);

    const center = this._gearCenter();
    if (!center) return;
    const { gx, gy } = center;

    this.buttons.forEach(({ type, dx, dy }, i) => {
      const btnEl = this.wrap.querySelector(`.pc-hud-btn.${type}`);

      if (btnEl) {
        btnEl.style.transitionDelay = (i * 0.05) + 's';
        this._place(btnEl, gx + dx, gy + dy);
        btnEl.classList.add('on');
      }
    });

    // Close on click outside this card
    this._clickOutsideHandler = (e) => {
        if (!this.wrap.contains(e.target)) {
            this.close();
        }
    };
    document.addEventListener('mousedown', this._clickOutsideHandler);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._setGearActive(false);
    this._setOverlay(false);

    const center = this._gearCenter();
    if (!center) return;
    const { gx, gy } = center;

    this.buttons.forEach(({ type }) => {
      const btnEl = this.wrap.querySelector(`.pc-hud-btn.${type}`);

      if (btnEl) {
        btnEl.style.transitionDelay = '0s';
        this._place(btnEl, gx, gy);
        btnEl.classList.remove('on');
      }
    });

    if (this._clickOutsideHandler) {
        document.removeEventListener('mousedown', this._clickOutsideHandler);
        this._clickOutsideHandler = null;
    }
  }

  _setGearActive(on) {
    if (this.gear) this.gear.classList.toggle('active', on);
  }

  _setOverlay(on) {
    if (this.overlay) this.overlay.classList.toggle('on', on);
  }
}

// Global registry for HUD instances
window.activePatientHUDs = new Map();

window.togglePatientHUD = function(event, patientId) {
    event.stopPropagation();
    const wrapSelector = `#hud-wrap-${patientId}`;
    let hud = window.activePatientHUDs.get(patientId);
    
    if (!hud) {
        hud = new PatientCardHUD(wrapSelector);
        window.activePatientHUDs.set(patientId, hud);
    }
    
    hud.toggle();
};
