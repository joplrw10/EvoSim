/**
 * Manages all UI interactions, event listeners, and updates to the DOM.
 */
class UIManager {
    /**
     * Creates a new UIManager instance.
     * @param {Simulation} simulationInstance - The main simulation object.
     */
    constructor(simulationInstance) {
        this.simulation = simulationInstance;
        this.chartInstances = { pop: null, genes: null, resource: null, allele: null };
        this.simulationHistory = { ticks: [], preyPopulation: [], predatorPopulation: [], totalResources: [], avgPreyMetabolism: [], avgPreyTempTolerance: [], avgPreyFeedingEff: [], freqCold: [], freqMid: [], freqWarm: [] };

        // Store references to frequently used DOM elements
        this.elements = {
            startButton: document.getElementById('startButton'),
            stopButton: document.getElementById('stopButton'),
            resetButton: document.getElementById('resetButton'),
            placementModeButton: document.getElementById('placementModeButton'),
            tickSpeedInput: document.getElementById('tickSpeedInput'),
            cellSizeInput: document.getElementById('cellSizeInput'),
            maxPopulationInput: document.getElementById('maxPopulationInput'),
            resetSettingsButton: document.getElementById('resetSettingsButton'),
            statsOutput: document.getElementById('statsOutput'),
            placementModeDisplay: document.getElementById('placementModeDisplay'),
            canvas: document.getElementById('simulationCanvas'),
            // Add other elements as needed (sliders, value spans)
            popDensitySlider: document.getElementById('popDensity'),
            popDensityValue: document.getElementById('popDensityValue'),
            nodeDensitySlider: document.getElementById('nodeDensity'),
            nodeDensityValue: document.getElementById('nodeDensityValue'),
            avgMetabolismSlider: document.getElementById('avgMetabolism'),
            avgMetabolismValue: document.getElementById('avgMetabolismValue'),
            avgFeedingSlider: document.getElementById('avgFeeding'),
            avgFeedingValue: document.getElementById('avgFeedingValue'),
            avgTempToleranceSlider: document.getElementById('avgTempTolerance'),
            avgTempToleranceValue: document.getElementById('avgTempToleranceValue'),
            mutationRateSlider: document.getElementById('mutationRate'),
            mutationRateValue: document.getElementById('mutationRateValue'),
            gridWidthSlider: document.getElementById('gridWidthInput'),
            gridWidthValue: document.getElementById('gridWidthValue'),
            gridHeightSlider: document.getElementById('gridHeightInput'),
            gridHeightValue: document.getElementById('gridHeightValue'),
        };

        if (!this.elements.canvas) {
            console.error("UI Manager: Canvas element not found!");
            // Potentially throw an error or disable functionality
        }

        console.log("UIManager instance created.");
    }

    /**
     * Initializes all UI components, including charts and event listeners.
     */
    initializeUI() {
        console.log("Initializing UI components...");
        this._initializeCharts();
        this._attachEventListeners();
        this.updatePlacementModeDisplay(this.simulation.resourcePlacementMode); // Set initial display
        // Set initial state for buttons (assuming simulation starts reset)
        this.setSimulationRunning(false);
        this.setSliderControlsDisabled(false);
        console.log("UI Initialization complete.");
    }

    /** Clears simulation history data. @private */
    _clearHistory() {
        for (const key in this.simulationHistory) {
            this.simulationHistory[key] = [];
        }
    }

    /** Initializes or re-initializes all Chart.js instances. @private */
    _initializeCharts() {
        this._clearHistory(); // Clear data before recreating charts

        const popCtx = document.getElementById('popChart')?.getContext('2d');
        const geneCtx = document.getElementById('geneChart')?.getContext('2d');
        const resourceCtx = document.getElementById('resourceChart')?.getContext('2d');
        const alleleCtx = document.getElementById('alleleChart')?.getContext('2d');

        if (!popCtx || !geneCtx || !resourceCtx || !alleleCtx) {
            console.error("One or more chart canvas contexts not found!");
            return;
        }

        // Destroy existing charts if they exist
        Object.values(this.chartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.chartInstances = { pop: null, genes: null, resource: null, allele: null };

        // --- Chart Configuration ---
        const baseChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disable animation for performance
            scales: {
                x: {
                    type: 'linear', // Use linear scale for ticks
                    title: { display: true, text: 'Tick' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Value' }
                }
            },
            elements: {
                point: { radius: 0 } // Hide points for performance
            },
            plugins: {
                legend: { position: 'top' }
            }
        };

        // --- Population Chart ---
        this.chartInstances.pop = new Chart(popCtx, {
            type: 'line',
            data: { labels: [], datasets: [
                { label: 'Prey', data: [], borderColor: 'rgb(54, 162, 235)', tension: 0.1 },
                { label: 'Predators', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 }
            ] },
            options: { ...baseChartOptions, plugins: { title: { display: false }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { ...baseChartOptions.scales.y, title: { text: 'Count' } } } }
        });

        // --- Average Genes Chart ---
        this.chartInstances.genes = new Chart(geneCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Avg Prey Metabolism Eff', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1, }, // Lower is better
                    { label: 'Avg Prey Temp Tolerance', data: [], borderColor: 'rgb(255, 159, 64)', tension: 0.1, },
                    { label: 'Avg Prey Feeding Eff', data: [], borderColor: 'rgb(153, 102, 255)', tension: 0.1, } // Higher is better
                ]
            },
            options: { ...baseChartOptions, plugins: { title: { display: false }, legend: { display: true } }, scales: {...baseChartOptions.scales, y: { beginAtZero: false, title: { display: true, text: 'Avg. Gene Value' } } }}
        });

        // --- Total Resources Chart ---
        this.chartInstances.resource = new Chart(resourceCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Total Grid Resources', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 }] },
            options: { ...baseChartOptions, plugins: { title: { display: false }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { ...baseChartOptions.scales.y, title: { text: 'Total Amount' } } } }
        });

        // --- Allele Frequency Chart ---
        this.chartInstances.allele = new Chart(alleleCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Cold Tolerant', data: [], borderColor: 'rgb(0, 100, 255)', tension: 0.1, fill: false },
                    { label: 'Mid Range', data: [], borderColor: 'rgb(0, 180, 0)', tension: 0.1, fill: false },
                    { label: 'Warm Tolerant', data: [], borderColor: 'rgb(255, 100, 0)', tension: 0.1, fill: false }
                ]
            },
            options: { ...baseChartOptions, plugins: { title: { display: false }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { min: 0, max: 1, title: { display: true, text: 'Frequency' } } } }
        });

        console.log("Charts initialized.");
    }

    /** Updates history data and redraws charts. @private */
    _updateHistoryAndCharts(tick, stats, totalResources) {
        // Add data to history
        this.simulationHistory.ticks.push(tick);
        this.simulationHistory.preyPopulation.push(stats.preyPopulation);
        this.simulationHistory.predatorPopulation.push(stats.predatorPopulation);
        this.simulationHistory.totalResources.push(totalResources);
        this.simulationHistory.avgPreyMetabolism.push(stats.avgPreyMetabolism);
        this.simulationHistory.avgPreyTempTolerance.push(stats.avgPreyTempTolerance);
        this.simulationHistory.avgPreyFeedingEff.push(stats.avgPreyFeedingEff);
        // Use preyAlleleFreqs from the stats object
        this.simulationHistory.freqCold.push(stats.preyAlleleFreqs?.Cold || 0);
        this.simulationHistory.freqMid.push(stats.preyAlleleFreqs?.Mid || 0);
        this.simulationHistory.freqWarm.push(stats.preyAlleleFreqs?.Warm || 0);

        // Limit history size
        if (this.simulationHistory.ticks.length > MAX_HISTORY) { // MAX_HISTORY from config.js
            for (const key in this.simulationHistory) {
                this.simulationHistory[key].shift();
            }
        }

        // Update charts efficiently using 'none' transition
        if (this.chartInstances.pop) {
            this.chartInstances.pop.data.labels = this.simulationHistory.ticks;
            this.chartInstances.pop.data.datasets[0].data = this.simulationHistory.preyPopulation;
            this.chartInstances.pop.data.datasets[1].data = this.simulationHistory.predatorPopulation;
            this.chartInstances.pop.update('none');
        }
        if (this.chartInstances.genes) {
            this.chartInstances.genes.data.labels = this.simulationHistory.ticks;
            this.chartInstances.genes.data.datasets[0].data = this.simulationHistory.avgPreyMetabolism;
            this.chartInstances.genes.data.datasets[1].data = this.simulationHistory.avgPreyTempTolerance;
            this.chartInstances.genes.data.datasets[2].data = this.simulationHistory.avgPreyFeedingEff;
            this.chartInstances.genes.update('none');
        }
        if (this.chartInstances.resource) {
            this.chartInstances.resource.data.labels = this.simulationHistory.ticks;
            this.chartInstances.resource.data.datasets[0].data = this.simulationHistory.totalResources;
            this.chartInstances.resource.update('none');
        }
        if (this.chartInstances.allele) {
            this.chartInstances.allele.data.labels = this.simulationHistory.ticks;
            this.chartInstances.allele.data.datasets[0].data = this.simulationHistory.freqCold;
            this.chartInstances.allele.data.datasets[1].data = this.simulationHistory.freqMid;
            this.chartInstances.allele.data.datasets[2].data = this.simulationHistory.freqWarm;
            this.chartInstances.allele.update('none');
        }
    }

    /** Attaches event listeners to UI controls. @private */
    _attachEventListeners() {
        // --- Control Buttons ---
        this.elements.startButton?.addEventListener('click', () => this.simulation.start());
        this.elements.stopButton?.addEventListener('click', () => this.simulation.stop());
        this.elements.resetButton?.addEventListener('click', () => this.simulation.reset());
        this.elements.placementModeButton?.addEventListener('click', () => this.simulation.togglePlacementMode());

        // --- Simulation Parameter Inputs ---
        this.elements.tickSpeedInput?.addEventListener('change', (event) => {
            const speed = parseInt(event.target.value, 10);
            if (!isNaN(speed) && speed >= 10) {
                this.simulation.updateConfig({ tickSpeed: speed });
            } else {
                event.target.value = this.simulation.config.tickSpeed; // Reset if invalid
            }
        });
        this.elements.cellSizeInput?.addEventListener('change', (event) => {
             const size = parseInt(event.target.value, 10);
             if (!isNaN(size) && size >= 1) {
                 this.simulation.updateConfig({ cellSize: size });
             } else {
                 event.target.value = this.simulation.config.cellSize; // Reset if invalid
             }
        });
        this.elements.maxPopulationInput?.addEventListener('change', (event) => {
            const pop = parseInt(event.target.value, 10);
            if (!isNaN(pop) && pop >= 100 && pop <= 10000) { // Use validation from HTML
                this.simulation.updateConfig({ maxPopulation: pop });
            } else {
                 event.target.value = this.simulation.config.maxPopulation; // Reset if invalid
            }
        });

        // --- Settings Sliders ---
        const sliderConfigs = [
            { slider: this.elements.popDensitySlider, valueSpan: this.elements.popDensityValue, configKey: 'popDensity', suffix: '%', decimals: 1 },
            { slider: this.elements.nodeDensitySlider, valueSpan: this.elements.nodeDensityValue, configKey: 'nodeDensity', suffix: '%', decimals: 1 },
            { slider: this.elements.avgMetabolismSlider, valueSpan: this.elements.avgMetabolismValue, configKey: 'avgMetabolism', suffix: '', decimals: 2 },
            { slider: this.elements.avgFeedingSlider, valueSpan: this.elements.avgFeedingValue, configKey: 'avgFeeding', suffix: '', decimals: 2 },
            { slider: this.elements.avgTempToleranceSlider, valueSpan: this.elements.avgTempToleranceValue, configKey: 'avgTempTolerance', suffix: '', decimals: 0 },
            { slider: this.elements.mutationRateSlider, valueSpan: this.elements.mutationRateValue, configKey: 'mutationRate', suffix: '%', decimals: 1 },
            { slider: this.elements.gridWidthSlider, valueSpan: this.elements.gridWidthValue, configKey: 'gridWidth', suffix: '', decimals: 0 },
            { slider: this.elements.gridHeightSlider, valueSpan: this.elements.gridHeightValue, configKey: 'gridHeight', suffix: '', decimals: 0 }
        ];

        sliderConfigs.forEach(({ slider, valueSpan, configKey, suffix, decimals }) => {
            if (slider && valueSpan) {
                // Function to update display and potentially config
                const updateSlider = () => {
                    const newValue = parseFloat(slider.value);
                    valueSpan.textContent = newValue.toFixed(decimals) + (suffix || '');
                    // Update simulation config immediately only if not running
                    if (!this.simulation.isRunning) {
                        this.simulation.updateConfig({ [configKey]: newValue });
                    }
                };
                slider.addEventListener('input', updateSlider);
                // Set initial display text
                updateSlider();
            } else {
                console.error(`Slider or value span missing for config key: ${configKey}`);
            }
        });

        // --- Reset Settings Button ---
        this.elements.resetSettingsButton?.addEventListener('click', () => {
            console.log("Resetting UI settings to default.");
            // Reset sliders and number inputs to DEFAULT_SETTINGS from config.js
            sliderConfigs.forEach(({ slider, configKey }) => {
                if (slider) {
                    let defaultValue = DEFAULT_SETTINGS[configKey];
                    slider.value = defaultValue;
                    // Trigger input event to update the value span display
                    slider.dispatchEvent(new Event('input'));
                }
            });
            // Reset number inputs separately
            if(this.elements.maxPopulationInput) this.elements.maxPopulationInput.value = DEFAULT_SETTINGS.maxPopulation;
            if(this.elements.tickSpeedInput) this.elements.tickSpeedInput.value = DEFAULT_SETTINGS.tickSpeed;
            if(this.elements.cellSizeInput) this.elements.cellSizeInput.value = DEFAULT_SETTINGS.cellSize;

            // Update the simulation's config immediately if not running
            if (!this.simulation.isRunning) {
                this.simulation.updateConfig({ ...DEFAULT_SETTINGS }); // Pass all defaults
            }
        });

        console.log("UI Event listeners attached.");
    }

    /**
     * Updates the main statistics display area.
     * @param {number} tick - Current simulation tick.
     * @param {object} stats - Calculated statistics object from Simulation.
     * @param {number} temperature - Current environment temperature.
     */
    updateStatsDisplay(tick, stats, temperature) {
        if (!this.elements.statsOutput) return;
        if (!this.elements.statsOutput || !stats) return; // Add null check for stats
        const totalPop = stats.preyPopulation + stats.predatorPopulation;
        this.elements.statsOutput.textContent = `Tick: ${tick}\n` +
            `Total Pop: ${totalPop} / ${this.simulation.config.maxPopulation} (Prey: ${stats.preyPopulation}, Pred: ${stats.predatorPopulation})\n` +
            `Environment Temp: ${temperature.toFixed(1)}°C\n` +
            `Avg. Prey Metabolism: ${isNaN(stats.avgPreyMetabolism) ? 'N/A' : stats.avgPreyMetabolism.toFixed(3)} (L)\n` +
            `Avg. Prey Temp Tol: ${isNaN(stats.avgPreyTempTolerance) ? 'N/A' : stats.avgPreyTempTolerance.toFixed(3)}\n` +
            `Avg. Prey Feeding: ${isNaN(stats.avgPreyFeedingEff) ? 'N/A' : stats.avgPreyFeedingEff.toFixed(3)} (H)`;
            // Add predator stats display later if needed
    }

    /**
     * Updates all relevant UI elements based on the current simulation state.
     * Called by the Simulation class during its tick or reset methods.
     * @param {number} tick - Current simulation tick.
     * @param {object} stats - Calculated statistics object.
     * @param {number} temperature - Current environment temperature.
     * @param {number} totalResources - Total resources in the environment.
     */
    updateUI(tick, stats, temperature, totalResources) {
        this.updateStatsDisplay(tick, stats, temperature);
        this._updateHistoryAndCharts(tick, stats, totalResources);
    }

    /** Resets UI elements to their initial state (charts, stats display). */
    resetUI() {
        this._initializeCharts(); // Clears history and recreates charts
        if (this.elements.statsOutput) {
            this.elements.statsOutput.textContent = "Simulation reset. Ready to start.";
        }
        // Button states are handled by setSimulationRunning and setSliderControlsDisabled
    }

    /**
     * Updates the display text for the resource placement mode.
     * @param {string} mode - The current placement mode ('random', 'manual', 'clustered').
     */
    updatePlacementModeDisplay(mode) {
        if (!this.elements.placementModeButton || !this.elements.placementModeDisplay) return;

        let buttonText = 'Mode: Unknown';
        let displayHelpText = '';

        if (mode === 'random') {
            buttonText = 'Mode: Random';
            displayHelpText = 'Using density slider. Manual/cluster nodes cleared on Reset.';
        } else if (mode === 'manual') {
            buttonText = 'Mode: Manual';
            displayHelpText = 'Click grid to toggle resource nodes. Density slider disabled.';
        } else if (mode === 'clustered') {
            buttonText = 'Mode: Clustered';
            displayHelpText = `Generating ~${NUM_CLUSTERS} clusters. Density slider disabled. Manual nodes cleared on Reset.`; // NUM_CLUSTERS from config.js
        }

        this.elements.placementModeButton.textContent = buttonText;
        this.elements.placementModeDisplay.textContent = displayHelpText;
    }

    /**
     * Enables or disables UI controls based on simulation running state.
     * @param {boolean} disabled - True to disable controls, false to enable.
     */
    setSliderControlsDisabled(disabled) {
        // List all elements that should be disabled when running
        const elementsToDisable = [
            this.elements.popDensitySlider, this.elements.nodeDensitySlider,
            this.elements.avgMetabolismSlider, this.elements.avgFeedingSlider,
            this.elements.avgTempToleranceSlider, this.elements.mutationRateSlider,
            this.elements.gridWidthSlider, this.elements.gridHeightSlider,
            this.elements.tickSpeedInput, this.elements.cellSizeInput,
            this.elements.maxPopulationInput, this.elements.resetSettingsButton,
            this.elements.placementModeButton
        ];

        elementsToDisable.forEach(el => {
            if (el) el.disabled = disabled;
        });

        // Special logic for nodeDensity slider based on placement mode
        if (this.elements.nodeDensitySlider) {
            this.elements.nodeDensitySlider.disabled = disabled || this.simulation.resourcePlacementMode === 'manual' || this.simulation.resourcePlacementMode === 'clustered';
        }

        // Update canvas cursor for manual placement mode
        if (this.elements.canvas) {
            this.elements.canvas.classList.toggle('manual-placement-active', !disabled && this.simulation.resourcePlacementMode === 'manual');
        }
    }

    /**
     * Updates the state of the Start/Stop buttons.
     * @param {boolean} isRunning - True if the simulation is running.
     */
    setSimulationRunning(isRunning) {
        if (this.elements.startButton) this.elements.startButton.disabled = isRunning;
        if (this.elements.stopButton) this.elements.stopButton.disabled = !isRunning;
        // Reset button is always enabled unless explicitly disabled elsewhere
    }

    /** Displays a message indicating the population died out. */
    showExtinctionMessage(message = "Population Extinct") {
        if (this.elements.statsOutput) {
            this.elements.statsOutput.textContent += `\n\n--- ${message} ---`;
        }
        // Optionally show an alert or more prominent message
        // alert(message);
    }

    // Added for non-critical info messages
    showInfoMessage(message) {
         if (this.elements.statsOutput) {
            this.elements.statsOutput.textContent += `\n\n--- INFO: ${message} ---`;
        }
    }

    /** Displays an error message in the stats area. */
    showErrorMessage(message) {
         if (this.elements.statsOutput) {
            this.elements.statsOutput.textContent += `\n\n--- ERROR: ${message} ---`;
        }
    }
}