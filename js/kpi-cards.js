// js/kpi-cards.js - Logic for Interactive KPI Cards and Universal Filter

const KPICards = {
    instances: {},
    configs: {},
    modalChart: null,

    init: function () {
        // Make the whole card clickable
        document.querySelectorAll('.advanced-kpi-card').forEach(card => {
            // If it already has an inline onclick, let it handle its own click
            if (card.hasAttribute('onclick')) return;
            
            // Add visual cue
            card.style.cursor = 'pointer';

            card.addEventListener('click', (e) => {
                const canvas = card.querySelector('canvas');
                if (canvas && canvas.id) {
                    this.showModal(canvas.id);
                }
            });
        });

        // Initialize modal if it doesn't exist
        this.initModal();
    },

    initModal: function() {
        if (document.getElementById('kpiGraphModal')) return;

        const modalHTML = `
            <div id="kpiGraphModal" class="graph-modal-overlay">
                <div class="graph-modal-content">
                    <div class="graph-modal-header">
                        <div class="graph-modal-title" id="kpiModalTitle">Performance Detail</div>
                        <button class="graph-modal-close" onclick="window.KPICards.hideModal()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="graph-modal-body">
                        <canvas id="kpiModalCanvas"></canvas>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close on backdrop click
        document.getElementById('kpiGraphModal').addEventListener('click', (e) => {
            if (e.target.id === 'kpiGraphModal') {
                this.hideModal();
            }
        });
    },

    showModal: function(sourceId) {
        const config = this.configs[sourceId];
        if (!config) return;

        const modal = document.getElementById('kpiGraphModal');
        const title = document.getElementById('kpiModalTitle');
        const canvas = document.getElementById('kpiModalCanvas');
        
        title.textContent = config.labelName + " - Detailed Analysis";
        modal.classList.add('active');

        if (this.modalChart) {
            this.modalChart.destroy();
        }

        if (typeof Chart === 'undefined') {
            Toast.error("Chart library not loaded.");
            return;
        }

        const color = config.color;
        const bgColors = config.type === 'line' ? `rgba(${color}, 0.2)` : `rgba(${color}, 0.8)`;
        const borderColors = `rgba(${color}, 1)`;

        this.modalChart = new Chart(canvas, {
            type: config.type,
            data: {
                labels: config.labels,
                datasets: [{
                    label: config.labelName,
                    data: config.dataValues,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 3,
                    fill: config.type === 'line',
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: borderColors,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 14, weight: '600' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0,0,0,0.05)', drawOnChartArea: true }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)', drawOnChartArea: true }
                    }
                }
            }
        });
    },

    hideModal: function() {
        const modal = document.getElementById('kpiGraphModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Updates or creates a chart inside a KPI card
     * @param {string} canvasId 
     * @param {string} type 'bar', 'line', etc.
     * @param {Array} labels 
     * @param {Array} dataValues 
     * @param {string} labelName 
     * @param {string} color 
     */
    renderChart: function (canvasId, type, labels, dataValues, labelName, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        if (typeof Chart === 'undefined') {
            console.warn(`Chart.js failed to load. Cannot render ${canvasId}`);
            return;
        }

        // Store config for modal use
        this.configs[canvasId] = { type, labels, dataValues, labelName, color };

        const bgColors = type === 'line' ? `rgba(${color}, 0.1)` : `rgba(${color}, 0.8)`;
        const borderColors = `rgba(${color}, 1)`;

        this.instances[canvasId] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    fill: type === 'line',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { display: false },
                        border: { display: false },
                        grid: { display: false }
                    }
                },
                layout: {
                    padding: 0
                }
            }
        });
    },

    /**
     * Standard exported logic for KPI cards
     * @param {string} filename 
     * @param {Array} headers 
     * @param {Array} rows 
     */
    exportData: function(filename, headers, rows) {
        if(window.Utils && window.Utils.exportToCSV) {
            window.Utils.exportToCSV(filename, headers, rows);
        } else {
            console.error("Utils.exportToCSV not found");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    KPICards.init();
});

window.KPICards = KPICards;
