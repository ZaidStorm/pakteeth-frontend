/**
 * SURFACE DIAL HUD — FLOATING CONTROLLER
 * Manages the radial tooth surface selection UI as a floating HUD.
 */

const SurfaceDial = {
    _containerId: 'surfaceDialHUD',
    _activeTooth: null,
    _onToggle: null,

    _init() {
        if (document.getElementById(this._containerId)) return;

        // Container for Dial
        const container = document.createElement('div');
        container.id = this._containerId;
        container.className = 'surface-dial-container';

        // Glass overlay
        const glass = document.createElement('div');
        glass.id = 'sdGlassOverlay';
        glass.className = 'sd-glass';

        // We will append these dynamically to the active chart in open()
        this._container = container;
        this._glass = glass;

        // Click outside (on glass) to close
        this._glass.addEventListener('mousedown', () => this.close());

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    },

    /**
     * Opens the dial centered over the given element
     */
    open(anchorEl, toothNum, activeSurfaces = '', isBaby = false, onToggle) {
        this._init();
        if (!anchorEl) return;

        this._activeTooth = toothNum;
        this._onToggle = onToggle;

        const chart = anchorEl.closest('.fdi-chart');
        if (!chart) return;

        // Move elements to the active chart area
        if (this._container.parentElement !== chart) chart.appendChild(this._container);
        if (this._glass.parentElement !== chart) chart.appendChild(this._glass);

        // Calculate Relative Positioning
        const chartRect = chart.getBoundingClientRect();
        const toothRect = anchorEl.getBoundingClientRect();

        const relativeX = (toothRect.left + toothRect.width / 2) - chartRect.left - 5;
        const relativeY = (toothRect.top + toothRect.height / 2) - chartRect.top + 497.5;

        this._container.style.left = `${relativeX}px`;
        this._container.style.top = `${relativeY}px`;

        const surfaces = isBaby ? ['B', 'L', 'M', 'D', 'O'] : ['B', 'L', 'M', 'D', 'O', 'P'];

        const buttonsHtml = surfaces.map(s => {
            const isActive = activeSurfaces.includes(s);
            return `
                <button class="sd-btn ${isActive ? 'active' : ''}" 
                        data-s="${s}" 
                        onclick="SurfaceDial._handleToggle(event, '${s}')">
                    ${s}
                </button>
            `;
        }).join('');

        this._container.innerHTML = `
            <div class="sd-wrap popping">
                <div class="sd-hub" onclick="SurfaceDial.close()" title="Click to close">${toothNum}</div>
                ${buttonsHtml}
            </div>
        `;

        this._container.classList.add('on');
        this._glass.classList.add('on');
    },

    close() {
        if (this._container) this._container.classList.remove('on');
        if (this._glass) this._glass.classList.remove('on');

        // Remove inner content after transition
        setTimeout(() => {
            if (this._container && !this._container.classList.contains('on')) {
                this._container.innerHTML = '';
            }
        }, 200);
        this._activeTooth = null;
        this._onToggle = null;
    },

    _handleToggle(event, surface) {
        event.preventDefault();
        event.stopPropagation();

        if (this._onToggle) {
            this._onToggle(surface);
        }
    },

    /**
     * Re-renders only the current dial (when a surface is toggled)
     */
    refresh(activeSurfaces = '', isBaby = false) {
        const container = document.getElementById(this._containerId);
        if (!container || !container.classList.contains('on')) return;

        const surfaces = isBaby ? ['B', 'L', 'M', 'D', 'O'] : ['B', 'L', 'M', 'D', 'O', 'P'];
        container.querySelectorAll('.sd-btn').forEach(btn => {
            const s = btn.dataset.s;
            btn.classList.toggle('active', activeSurfaces.includes(s));
        });
    }
};

window.SurfaceDial = SurfaceDial;
