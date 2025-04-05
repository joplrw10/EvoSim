N/**
 * Manages all UI interactions, event listeners, and updates to the DOM.
 */
class UIManager {
    /**
     * Creates a new UIManager instance.
     * @param {Simulation} simulationInstance - The main simulation object.
     */
    constructor(simulationInstance) {
        this.simulation = simulationInstance;
        this.chartInstances = { pop: null, genes: null, resource: null, tempPhenotype: null, physicalPhenotype: null, internalPhenotype: null }; // Renamed allele, added new charts
        this.simulationHistory = {
            ticks: [], preyPopulation: [], predatorPopulation: [], totalResources: [],
            avgPreyMetabolism: [], avgPreyFeedingEff: [],
            // Temperature Phenotypes
            tempPhenotypeHighFreq: [], tempPhenotypeMediumFreq: [], tempPhenotypeLowFreq: [],
            // Size Phenotypes
            sizePhenotypeLargeFreq: [], sizePhenotypeSmallFreq: [],
            // Speed Phenotypes
            speedPhenotypeFastFreq: [], speedPhenotypeSlowFreq: [],
            // Camouflage Phenotypes
            camouflagePhenotypeCamouflagedFreq: [], camouflagePhenotypeConspicuousFreq: [],
            // Reproductive Rate Phenotypes
            reproRatePhenotypeHighFreq: [], reproRatePhenotypeLowFreq: [],
            // Resistance Phenotypes
            resistancePhenotypeResistantFreq: [], resistancePhenotypeSusceptibleFreq: [],
        };

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

        const popCtx = document.getElementById('popChart').getContext('2d');
        const geneCtx = document.getElementById('geneChart').getContext('2d');
        const resourceCtx = document.getElementById('resourceChart').getContext('2d');
        const tempPhenotypeCtx = document.getElementById('tempPhenotypeChart').getContext('2d'); // Renamed canvas ID
        const physicalPhenotypeCtx = document.getElementById('physicalPhenotypeChart').getContext('2d'); // New canvas ID
        const internalPhenotypeCtx = document.getElementById('internalPhenotypeChart').getContext('2d'); // New canvas ID

        if (!popCtx || !geneCtx || !resourceCtx || !tempPhenotypeCtx || !physicalPhenotypeCtx || !internalPhenotypeCtx) {
            console.error("One or more chart canvas contexts not found! Ensure canvas elements with IDs 'popChart', 'geneChart', 'resourceChart', 'tempPhenotypeChart', 'physicalPhenotypeChart', 'internalPhenotypeChart' exist.");
            return;
        }

        // Destroy existing charts if they exist
        Object.values(this.chartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.chartInstances = { pop: null, genes: null, resource: null, tempPhenotype: null, physicalPhenotype: null, internalPhenotype: null };

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
                    // { label: 'Avg Prey Temp Tolerance', data: [], borderColor: 'rgb(255, 159, 64)', tension: 0.1, }, // Removed avg numerical tolerance
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

        // --- Temperature Phenotype Frequency Chart --- (Previously Allele Chart)
        this.chartInstances.tempPhenotype = new Chart(tempPhenotypeCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'High Temp', data: [], borderColor: 'rgb(255, 100, 0)', tension: 0.1, fill: false },
                    { label: 'Medium Temp', data: [], borderColor: 'rgb(0, 180, 0)', tension: 0.1, fill: false },
                    { label: 'Low Temp', data: [], borderColor: 'rgb(0, 100, 255)', tension: 0.1, fill: false }
                ]
            },
            options: { ...baseChartOptions, plugins: { title: { display: true, text: 'Temp Phenotype Frequencies' }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { min: 0, max: 1, title: { display: true, text: 'Frequency' } } } }
        });

        // --- Physical Phenotype Frequency Chart (Size, Speed, Camo) ---
        this.chartInstances.physicalPhenotype = new Chart(physicalPhenotypeCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Large Size', data: [], borderColor: 'rgb(139, 69, 19)', tension: 0.1, fill: false }, // Brown
                    { label: 'Small Size', data: [], borderColor: 'rgb(210, 105, 30)', tension: 0.1, fill: false, borderDash: [5, 5] }, // Peru (dashed)
                    { label: 'Fast Speed', data: [], borderColor: 'rgb(255, 215, 0)', tension: 0.1, fill: false }, // Gold
                    { label: 'Slow Speed', data: [], borderColor: 'rgb(184, 134, 11)', tension: 0.1, fill: false, borderDash: [5, 5] }, // DarkGoldenrod (dashed)
                    { label: 'Camouflaged', data: [], borderColor: 'rgb(85, 107, 47)', tension: 0.1, fill: false }, // DarkOliveGreen
                    { label: 'Conspicuous', data: [], borderColor: 'rgb(154, 205, 50)', tension: 0.1, fill: false, borderDash: [5, 5] }, // YellowGreen (dashed)
                ]
            },
            options: { ...baseChartOptions, plugins: { title: { display: true, text: 'Physical Phenotype Frequencies' }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { min: 0, max: 1, title: { display: true, text: 'Frequency' } } } }
        });

         // --- Internal Phenotype Frequency Chart (Repro Rate, Resistance) ---
         this.chartInstances.internalPhenotype = new Chart(internalPhenotypeCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'High Repro Rate', data: [], borderColor: 'rgb(255, 20, 147)', tension: 0.1, fill: false }, // DeepPink
                    { label: 'Low Repro Rate', data: [], borderColor: 'rgb(199, 21, 133)', tension: 0.1, fill: false, borderDash: [5, 5] }, // MediumVioletRed (dashed)
                    { label: 'Resistant', data: [], borderColor: 'rgb(0, 128, 128)', tension: 0.1, fill: false }, // Teal
                    { label: 'Susceptible', data: [], borderColor: 'rgb(72, 209, 204)', tension: 0.1, fill: false, borderDash: [5, 5] }, // MediumTurquoise (dashed)
                ]
            },
            options: { ...baseChartOptions, plugins: { title: { display: true, text: 'Internal Phenotype Frequencies' }, legend: { display: true } }, scales: { ...baseChartOptions.scales, y: { min: 0, max: 1, title: { display: true, text: 'Frequency' } } } }
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
        // this.simulationHistory.avgPreyTempTolerance.push(stats.avgPreyTempTolerance); // Removed
        this.simulationHistory.avgPreyFeedingEff.push(stats.avgPreyFeedingEff);
        // Temperature Phenotypes
        const tempFreqs = stats?.preyTempPhenotypeFreqs;
        this.simulationHistory.tempPhenotypeHighFreq.push(tempFreqs?.High || 0);
        this.simulationHistory.tempPhenotypeMediumFreq.push(tempFreqs?.Medium || 0);
        this.simulationHistory.tempPhenotypeLowFreq.push(tempFreqs?.Low || 0);
        // Size Phenotypes
        const sizeFreqs = stats?.preySizePhenotypeFreqs;
        this.simulationHistory.sizePhenotypeLargeFreq.push(sizeFreqs?.Large || 0);
        this.simulationHistory.sizePhenotypeSmallFreq.push(sizeFreqs?.Small || 0);
        // Speed Phenotypes
        const speedFreqs = stats?.preySpeedPhenotypeFreqs;
        this.simulationHistory.speedPhenotypeFastFreq.push(speedFreqs?.Fast || 0);
        this.simulationHistory.speedPhenotypeSlowFreq.push(speedFreqs?.Slow || 0);
        // Camouflage Phenotypes
        const camoFreqs = stats?.preyCamouflagePhenotypeFreqs;
        this.simulationHistory.camouflagePhenotypeCamouflagedFreq.push(camoFreqs?.Camouflaged || 0);
        this.simulationHistory.camouflagePhenotypeConspicuousFreq.push(camoFreqs?.Conspicuous || 0);
        // Reproductive Rate Phenotypes
        const reproFreqs = stats?.preyReproRatePhenotypeFreqs;
        this.simulationHistory.reproRatePhenotypeHighFreq.push(reproFreqs?.High || 0);
        this.simulationHistory.reproRatePhenotypeLowFreq.push(reproFreqs?.Low || 0);
        // Resistance Phenotypes
        const resistFreqs = stats?.preyResistancePhenotypeFreqs;
        this.simulationHistory.resistancePhenotypeResistantFreq.push(resistFreqs?.Resistant || 0);
        this.simulationHistory.resistancePhenotypeSusceptibleFreq.push(resistFreqs?.Susceptible || 0);

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
            // this.chartInstances.genes.data.datasets[1].data = this.simulationHistory.avgPreyTempTolerance; // Removed
            this.chartInstances.genes.data.datasets[1].data = this.simulationHistory.avgPreyFeedingEff; // Index was 2, now 1
            this.chartInstances.genes.update('none');
        }
        if (this.chartInstances.resource) {
            this.chartInstances.resource.data.labels = this.simulationHistory.ticks;
            this.chartInstances.resource.data.datasets[0].data = this.simulationHistory.totalResources;
            this.chartInstances.resource.update('none');
        }
        if (this.chartInstances.tempPhenotype) {
            this.chartInstances.tempPhenotype.data.labels = this.simulationHistory.ticks;
            this.chartInstances.tempPhenotype.data.datasets[0].data = this.simulationHistory.tempPhenotypeHighFreq;
            this.chartInstances.tempPhenotype.data.datasets[1].data = this.simulationHistory.tempPhenotypeMediumFreq;
            this.chartInstances.tempPhenotype.data.datasets[2].data = this.simulationHistory.tempPhenotypeLowFreq;
            this.chartInstances.tempPhenotype.update('none');
        }
        if (this.chartInstances.physicalPhenotype) {
            this.chartInstances.physicalPhenotype.data.labels = this.simulationHistory.ticks;
            this.chartInstances.physicalPhenotype.data.datasets[0].data = this.simulationHistory.sizePhenotypeLargeFreq;
            this.chartInstances.physicalPhenotype.data.datasets[1].data = this.simulationHistory.sizePhenotypeSmallFreq;
            this.chartInstances.physicalPhenotype.data.datasets[2].data = this.simulationHistory.speedPhenotypeFastFreq;
            this.chartInstances.physicalPhenotype.data.datasets[3].data = this.simulationHistory.speedPhenotypeSlowFreq;
            this.chartInstances.physicalPhenotype.data.datasets[4].data = this.simulationHistory.camouflagePhenotypeCamouflagedFreq;
            this.chartInstances.physicalPhenotype.data.datasets[5].data = this.simulationHistory.camouflagePhenotypeConspicuousFreq;
            this.chartInstances.physicalPhenotype.update('none');
        }
         if (this.chartInstances.internalPhenotype) {
            this.chartInstances.internalPhenotype.data.labels = this.simulationHistory.ticks;
            this.chartInstances.internalPhenotype.data.datasets[0].data = this.simulationHistory.reproRatePhenotypeHighFreq;
            this.chartInstances.internalPhenotype.data.datasets[1].data = this.simulationHistory.reproRatePhenotypeLowFreq;
            this.chartInstances.internalPhenotype.data.datasets[2].data = this.simulationHistory.resistancePhenotypeResistantFreq;
            this.chartInstances.internalPhenotype.data.datasets[3].data = this.simulationHistory.resistancePhenotypeSusceptibleFreq;
            this.chartInstances.internalPhenotype.update('none');
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
     */
    updateStatsDisplay(tick, stats) { // Removed temperature parameter
        if (!this.elements.statsOutput) return;
        if (!this.elements.statsOutput || !stats) return; // Add null check for stats
        const totalPop = stats.preyPopulation + stats.predatorPopulation;
        // Helper to format frequency display
        const formatFreq = (freqObj, key1, key2) => {
            if (!freqObj || typeof freqObj[key1] === 'undefined' || typeof freqObj[key2] === 'undefined') return 'N/A';
            return `${(freqObj[key1] * 100).toFixed(1)}% / ${(freqObj[key2] * 100).toFixed(1)}%`;
        };
        const formatFreq3 = (freqObj, key1, key2, key3) => {
             if (!freqObj || typeof freqObj[key1] === 'undefined' || typeof freqObj[key2] === 'undefined' || typeof freqObj[key3] === 'undefined') return 'N/A';
             return `${(freqObj[key1] * 100).toFixed(1)}% / ${(freqObj[key2] * 100).toFixed(1)}% / ${(freqObj[key3] * 100).toFixed(1)}%`;
        };

        this.elements.statsOutput.textContent = `Tick: ${tick}\n` +
            `Total Pop: ${totalPop} / ${this.simulation.config.maxPopulation} (Prey: ${stats.preyPopulation}, Pred: ${stats.predatorPopulation})\n` +
            `Avg. Prey Metabolism: ${isNaN(stats.avgPreyMetabolism) ? 'N/A' : stats.avgPreyMetabolism.toFixed(3)} (L)\n` +
            `Avg. Prey Feeding: ${isNaN(stats.avgPreyFeedingEff) ? 'N/A' : stats.avgPreyFeedingEff.toFixed(3)} (H)\n` +
            `--- Phenotype Frequencies ---\n` +
            `Temp (H/M/L): ${formatFreq3(stats.preyTempPhenotypeFreqs, 'High', 'Medium', 'Low')}\n` +
            `Size (Lrg/Sml): ${formatFreq(stats.preySizePhenotypeFreqs, 'Large', 'Small')}\n` +
            `Speed (Fst/Slw): ${formatFreq(stats.preySpeedPhenotypeFreqs, 'Fast', 'Slow')}\n` +
            `Camo (Cam/Con): ${formatFreq(stats.preyCamouflagePhenotypeFreqs, 'Camouflaged', 'Conspicuous')}\n` +
            `Repro (Hi/Lo): ${formatFreq(stats.preyReproRatePhenotypeFreqs, 'High', 'Low')}\n` +
            `Resist (Res/Sus): ${formatFreq(stats.preyResistancePhenotypeFreqs, 'Resistant', 'Susceptible')}`;
    }

    /**
     * Updates all relevant UI elements based on the current simulation state.
     * Called by the Simulation class during its tick or reset methods.
     * @param {number} tick - Current simulation tick.
     * @param {object} stats - Calculated statistics object.
     * @param {number} totalResources - Total resources in the environment.
     */
    updateUI(tick, stats, totalResources) { // Removed temperature parameter
        this.updateStatsDisplay(tick, stats); // Removed temperature parameter
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