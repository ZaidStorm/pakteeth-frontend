/**
 * City Manager Utility
 * Handles dynamic city suggestions and UI integration for PakTeeth.
 * Optimized for Electron and dynamic modal content.
 */

const CityManager = {
    cities: [],
    initializedInputs: new Set(),

    init() {
        console.log("[CityManager] Initializing...");
        this.loadCities();
        this.observeDOM();
        this.attachToExisting();
    },

    async loadCities() {
        try {
            console.log("[CityManager] Fetching cities from server...");
            const response = await fetch(`${API_BASE}/cities`);
            if (!response.ok) throw new Error("Server response not OK");
            this.cities = await response.json();
            console.log(`[CityManager] Successfully loaded ${this.cities.length} cities.`);
        } catch (error) {
            console.warn('[CityManager] Failed to load cities from server, using fallback:', error);
            this.cities = [
                {name: 'Lahore', province: 'Punjab'}, 
                {name: 'Karachi', province: 'Sindh'}, 
                {name: 'Islamabad', province: 'ICT'},
                {name: 'Faisalabad', province: 'Punjab'},
                {name: 'Rawalpindi', province: 'Punjab'},
                {name: 'Multan', province: 'Punjab'},
                {name: 'Peshawar', province: 'KPK'},
                {name: 'Quetta', province: 'Balochistan'},
                {name: 'Sialkot', province: 'Punjab'},
                {name: 'Gujranwala', province: 'Punjab'}
            ];
        }
        document.dispatchEvent(new CustomEvent('cityCollectionUpdated', { detail: this.cities }));
    },

    // Attach to inputs already in the DOM
    attachToExisting() {
        const targetIds = ["p_city", "edit_city", "citySearch", "patient_city"];
        targetIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.setupInput(el);
        });
    },

    // Watch for inputs added dynamically (e.g. in modals or via AJAX)
    observeDOM() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return; // Only process elements
                    
                    // Check if node is a target input or contains one
                    const targetIds = ["p_city", "edit_city", "citySearch", "patient_city"];
                    targetIds.forEach(id => {
                        if (node.id === id) {
                            this.setupInput(node);
                        } else if (node.querySelectorAll) {
                            const found = node.querySelectorAll(`#${id}`);
                            found.forEach(el => this.setupInput(el));
                        }
                    });
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    setupInput(input) {
        if (this.initializedInputs.has(input)) return;
        this.initializedInputs.add(input);

        console.log(`[CityManager] Setting up suggestions for: #${input.id}`);

        // Disable native browser autocomplete and datalist
        input.setAttribute('autocomplete', 'off');
        input.removeAttribute('list');

        // Create or get unique suggestion container
        let containerId = `city-suggestions-${input.id}`;
        let container = document.getElementById(containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'city-suggestions-container';
            document.body.appendChild(container);
        }

        let highlightedIndex = -1;

        const showSuggestions = (val) => {
            // Optional: fallback to empty string if undefined
            const query = (val || '').trim().toLowerCase();

            // Filter cities by query, or show all if query is empty
            const filtered = this.cities.filter(city => 
                city.name.toLowerCase().includes(query)
            ).slice(0, 50);

            if (filtered.length > 0) {
                container.innerHTML = filtered.map((city, index) => `
                    <div class="city-suggestion-item" data-name="${city.name}">
                        <span class="suggestion-city-name">${city.name}</span>
                        <span class="suggestion-region">${city.province || ''}</span>
                    </div>
                `).join('');
                
                this.positionContainer(input, container);
                container.classList.add('active');
            } else {
                container.classList.remove('active');
            }
            highlightedIndex = -1;
        };

        // Event Listeners
        input.addEventListener('input', (e) => showSuggestions(e.target.value));
        input.addEventListener('focus', (e) => showSuggestions(e.target.value));

        input.addEventListener('keydown', (e) => {
            const items = container.querySelectorAll('.city-suggestion-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                this.updateHighlight(items, highlightedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                this.updateHighlight(items, highlightedIndex);
            } else if (e.key === 'Enter' && highlightedIndex > -1) {
                e.preventDefault();
                input.value = items[highlightedIndex].dataset.name;
                container.classList.remove('active');
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (e.key === 'Escape') {
                container.classList.remove('active');
            }
        });

        container.addEventListener('click', (e) => {
            const item = e.target.closest('.city-suggestion-item');
            if (item) {
                input.value = item.dataset.name;
                container.classList.remove('active');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Close on click outside
        document.addEventListener('mousedown', (e) => {
            if (!input.contains(e.target) && !container.contains(e.target)) {
                container.classList.remove('active');
            }
        });

        // Reposition on window resize or scroll
        const reposition = () => {
            if (container.classList.contains('active')) {
                this.positionContainer(input, container);
            }
        };
        window.addEventListener('resize', reposition);
        document.addEventListener('scroll', reposition, true); // Catch inside modals
    },

    positionContainer(input, container) {
        const rect = input.getBoundingClientRect();
        // Use fixed positioning if the container is appended to body, 
        // this is more reliable for Electron layouts.
        container.style.position = 'fixed';
        container.style.top = `${rect.bottom + 4}px`;
        container.style.left = `${rect.left}px`;
        container.style.width = `${rect.width}px`;
        container.style.zIndex = '100000'; // Ensure it's above everything
    },

    updateHighlight(items, index) {
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    },

    async refresh() {
        await this.loadCities();
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CityManager.init());
} else {
    CityManager.init();
}

window.CityManager = CityManager;
