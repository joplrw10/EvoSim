/**
 * Manages the overall simulation, including organisms, environment, and the main loop.
 */
class Simulation {
    /**
     * Creates a new Simulation instance.
     * @param {object} initialConfig - Initial configuration settings (like grid size, population cap etc.).
     * @param {HTMLCanvasElement} canvas - The canvas element for drawing.
     */
    constructor(initialConfig, canvas) {
        this.config = { ...initialConfig }; // Store a copy of the initial config

        this.canvas = canvas;
        if (!this.canvas) {
            throw new Error("FATAL: Canvas element not provided to Simulation!");
        }
        this.ctx = this.canvas.getContext('2d');

        // Simulation state
        this.organisms = [];
        this.environment = null;
        this.tick_count = 0;
        this.isRunning = false;
        this.tickInterval = null;
        this.tickSpeed = this.config.tickSpeed || 50; // Use initial config or default
        this.cellSize = this.config.cellSize || 5;   // Use initial config or default
        this.nextOrganismId = 0;

        // Resource placement state (managed here, but UI interacts via methods)
        this.resourcePlacementMode = this.config.resourcePlacementMode || 'random';
        this.manuallyPlacedNodes = []; // For 'manual' mode persistence

        // Placeholder for UI interaction module/functions
        this.ui = null; // Will be set later via a method like setUIManager()

        console.log("Simulation instance created.");
    }

    /**
     * Connects the Simulation to a UI manager object.
     * @param {object} uiManager - An object responsible for UI interactions.
     */
    setUIManager(uiManager) {
        this.ui = uiManager;
        console.log("UI Manager connected to Simulation.");
        // Add canvas listener now that UI (and potentially canvas size) is stable
        this._addCanvasClickListener();
    }

    /**
     * Updates the simulation's configuration. Called by UI when settings change.
     * @param {object} newConfig - An object containing the settings to update.
     */
    updateConfig(newConfig) {
        // Merge new settings into the current config
        this.config = { ...this.config, ...newConfig };

        // Update simulation parameters that depend directly on config
        this.tickSpeed = this.config.tickSpeed;
        this.cellSize = this.config.cellSize;
        // Update global vars used by Organism/Environment (if necessary, though better to pass config)
        // Example: MUTATION_RATE = this.config.mutationRate / 100.0;
        //          RESOURCE_NODE_DENSITY = this.config.nodeDensity / 100.0;
        //          maxPopulation = this.config.maxPopulation;
        //          gridWidth = this.config.gridWidth;
        //          gridHeight = this.config.gridHeight;

        console.log("Simulation config updated:", this.config);

        // If grid size or cell size changed while not running, resize canvas
        if (!this.isRunning && (newConfig.gridWidth || newConfig.gridHeight || newConfig.cellSize)) {
            this.resizeCanvas();
        }
    }

    /**
     * Resizes the canvas based on current grid dimensions and cell size.
     */
    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = this.config.gridWidth * this.cellSize;
        this.canvas.height = this.config.gridHeight * this.cellSize;
        console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
        this._drawSimulation(); // Redraw with new size
    }

    /**
     * Adds the click listener to the canvas for manual resource placement.
     * @private
     */
    _addCanvasClickListener() {
        if (!this.canvas || !this.ui) {
            console.warn("Canvas or UI Manager not available for click listener.");
            return;
        }
        this.canvas.addEventListener('click', (event) => {
            // Only allow toggling when simulation is stopped and mode is 'manual'
            if (this.isRunning || this.resourcePlacementMode !== 'manual') {
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            // Calculate grid coordinates from click coordinates
            const gridX = Math.floor(clickX / this.cellSize);
            const gridY = Math.floor(clickY / this.cellSize);

            // Toggle the node in the environment
            if (this.environment && this.environment.toggleNode(gridX, gridY)) {
                // Update the stored manual nodes and redraw
                this.manuallyPlacedNodes = this.environment.getManuallyPlacedNodes();
                this._drawSimulation();
                // Optionally, notify UI about the change if needed
                // this.ui.updateManualNodeCount(this.manuallyPlacedNodes.length);
            }
        });
        console.log("Canvas click listener added for manual placement.");
    }

    /**
     * Toggles the resource placement mode. Called by the UI.
     */
    togglePlacementMode() {
        if (this.isRunning) return; // Cannot change mode while running

        // Cycle: random -> manual -> clustered -> random
        if (this.resourcePlacementMode === 'random') {
            this.resourcePlacementMode = 'manual';
            // Environment needs to be recreated in manual mode to clear old nodes
            // We pass the *current* list of manually placed nodes (likely empty initially)
            this.environment = new Environment(
                this.config.gridWidth, this.config.gridHeight,
                0, // Density doesn't apply
                'manual',
                this.manuallyPlacedNodes // Start with existing manual nodes
            );
        } else if (this.resourcePlacementMode === 'manual') {
            this.resourcePlacementMode = 'clustered';
            this.manuallyPlacedNodes = []; // Clear manual nodes when switching away
            this.environment = new Environment(
                this.config.gridWidth, this.config.gridHeight,
                0, // Density doesn't apply
                'clustered'
            );
        } else { // Was 'clustered'
            this.resourcePlacementMode = 'random';
            this.manuallyPlacedNodes = []; // Clear manual nodes
            this.environment = new Environment(
                this.config.gridWidth, this.config.gridHeight,
                this.config.nodeDensity / 100.0, // Use density from config
                'random'
            );
        }

        console.log("Resource placement mode toggled to:", this.resourcePlacementMode);
        this._drawSimulation(); // Redraw environment after mode change

        // Notify UI about the mode change
        if (this.ui) {
            this.ui.updatePlacementModeDisplay(this.resourcePlacementMode);
            this.ui.setSliderControlsDisabled(this.isRunning); // Re-evaluate control states
        }
    }


    /**
     * Creates the initial population of organisms based on current config.
     * @private
     */
    _createInitialPopulation() {
        this.organisms = [];
        this.nextOrganismId = 0;
        const settings = this.config; // Use current simulation config

        // Calculate initial population number based on density
        const totalCells = settings.gridWidth * settings.gridHeight;
        const initialPopNum = Math.max(1, Math.floor(totalCells * (settings.popDensity / 100.0)));

        console.log(`Creating ${initialPopNum} organisms...`);

        for (let i = 0; i < initialPopNum; i++) {
            // Generate genes with variation around the configured averages
            const genes = {
                metabolism_efficiency: clamp(getRandom(settings.avgMetabolism - INITIAL_GENE_VARIATION, settings.avgMetabolism + INITIAL_GENE_VARIATION), 0.1, 2.0),
                temperature_tolerance: clamp(getRandom(settings.avgTempTolerance - 10, settings.avgTempTolerance + 10), -10, 60), // Wider initial range
                feeding_efficiency: clamp(getRandom(settings.avgFeeding - INITIAL_GENE_VARIATION, settings.avgFeeding + INITIAL_GENE_VARIATION), 0.1, 2.0),
                // Add other genes here if needed
            };
            // Assign random location
            const location = {
                x: getRandomInt(0, settings.gridWidth - 1),
                y: getRandomInt(0, settings.gridHeight - 1)
            };
            this.organisms.push(new Organism(this.nextOrganismId++, genes, location));
        }
        console.log(`Created initial population of ${this.organisms.length}`);
    }

    /**
     * Resets the simulation to its initial state based on the current configuration.
     */
    reset() {
        console.log("Attempting simulation reset...");
        this.stop(); // Ensure simulation is stopped

        this.tick_count = 0;
        this.organisms = [];
        this.manuallyPlacedNodes = (this.resourcePlacementMode === 'manual' && this.environment)
            ? this.environment.getManuallyPlacedNodes() // Preserve manual nodes if mode is manual
            : [];

        // Update simulation parameters from config (in case they changed via UI)
        // This assumes this.config is up-to-date
        MUTATION_RATE = this.config.mutationRate / 100.0;
        RESOURCE_NODE_DENSITY = this.config.nodeDensity / 100.0;
        maxPopulation = this.config.maxPopulation;
        gridWidth = this.config.gridWidth;
        gridHeight = this.config.gridHeight;

        // Create the environment based on the *current* mode and size
        const densityForEnv = (this.resourcePlacementMode === 'random') ? RESOURCE_NODE_DENSITY : 0;
        this.environment = new Environment(
            gridWidth,
            gridHeight,
            densityForEnv,
            this.resourcePlacementMode,
            this.manuallyPlacedNodes // Pass preserved/empty manual nodes
        );

        // Resize canvas to match potential grid size changes
        this.resizeCanvas();

        // Create the initial population
        this._createInitialPopulation();

        // Reset and update UI elements (handled by UI manager)
        if (this.ui) {
            this.ui.resetUI(); // Resets charts, stats display, button states etc.
            const initialStats = this._calculateStats();
            this.ui.updateUI(this.tick_count, initialStats, this.environment.temperature, this.environment.getTotalResources());
            this.ui.setSliderControlsDisabled(false); // Enable controls
        }

        // Draw the initial state
        this._drawSimulation();

        console.log("Simulation reset complete.");
    }

    /**
     * Starts the simulation loop.
     */
    start() {
        if (this.isRunning) {
            console.warn("Start clicked but already running.");
            return;
        }
        console.log("Starting simulation...");

        // Ensure environment exists and matches current config (size, mode)
        // This is crucial if settings were changed after the last reset but before starting
        let envNeedsRecreate = false;
        if (!this.environment) {
            envNeedsRecreate = true;
            console.warn("Environment missing, creating before start...");
        } else if (this.environment.width !== this.config.gridWidth || this.environment.height !== this.config.gridHeight) {
            envNeedsRecreate = true;
            console.warn("Grid size mismatch, recreating environment before start...");
        } else if (this.resourcePlacementMode === 'manual') {
            // Check if manually placed nodes in env match stored ones (can change via clicks)
            const currentEnvNodes = this.environment.getManuallyPlacedNodes();
            if (currentEnvNodes.length !== this.manuallyPlacedNodes.length ||
                !currentEnvNodes.every(envNode => this.manuallyPlacedNodes.some(manNode => manNode.x === envNode.x && manNode.y === envNode.y))) {
                envNeedsRecreate = true;
                console.log("Manual nodes changed, recreating environment before start...");
                // Use the *currently stored* manual nodes
                this.manuallyPlacedNodes = currentEnvNodes;
            }
        }
        // Add similar checks if 'clustered' mode needs specific validation before start

        if (envNeedsRecreate) {
            const densityForEnv = (this.resourcePlacementMode === 'random') ? (this.config.nodeDensity / 100.0) : 0;
            this.environment = new Environment(
                this.config.gridWidth,
                this.config.gridHeight,
                densityForEnv,
                this.resourcePlacementMode,
                this.manuallyPlacedNodes // Use current manual nodes
            );
            this.resizeCanvas(); // Ensure canvas matches new grid size
        }

        // Ensure canvas size is correct before starting draw loop
        this.resizeCanvas();

        this.isRunning = true;
        if (this.tickInterval) clearInterval(this.tickInterval); // Clear just in case
        this.tickInterval = setInterval(() => {
            // Added check for 'this' existence in case of rapid start/stop/reset issues
            if (this && this.isRunning) {
                this.tick();
            } else if (!this.isRunning) {
                // Safety clear if somehow interval runs when not supposed to
                clearInterval(this.tickInterval);
                this.tickInterval = null;
            }
        }, this.tickSpeed);

        console.log(`Simulation started. Interval ID: ${this.tickInterval}, Speed: ${this.tickSpeed}ms.`);

        // Update UI state (handled by UI manager)
        if (this.ui) {
            this.ui.setSimulationRunning(true);
            this.ui.setSliderControlsDisabled(true);
        }
    }

    /**
     * Stops the simulation loop.
     */
    stop() {
        if (!this.isRunning) return;
        console.log(`Stopping simulation. Interval ID: ${this.tickInterval}`);
        this.isRunning = false;
        clearInterval(this.tickInterval);
        this.tickInterval = null;

        // Update UI state (handled by UI manager)
        // Controls remain disabled until reset
        if (this.ui) {
            this.ui.setSimulationRunning(false);
            // Keep controls disabled: this.ui.setSliderControlsDisabled(false);
        }
        console.log("Simulation stopped.");
    }

    /**
     * Executes a single simulation tick.
     */
    tick() {
        if (!this.isRunning || !this.environment) return;

        try {
            this.tick_count++;

            // 1. Update Environment
            this.environment.update(this.tick_count);

            // 2. Prepare for Reproduction
            this.organisms.forEach(org => org.hasReproducedThisTick = false); // Reset flag
            const newborns = [];
            const potentialParents = [];

            // 3. Update Organisms (Move, Metabolize, Feed, Check Death)
            // Iterate backwards for safe removal
            for (let i = this.organisms.length - 1; i >= 0; i--) {
                const org = this.organisms[i];
                org.update(this.environment); // Perform actions

                if (!org.alive) {
                    // Remove dead organism directly
                    this.organisms.splice(i, 1);
                } else {
                    // Check if eligible for reproduction
                    if (org.age >= REPRODUCTION_AGE && org.energy >= REPRODUCTION_ENERGY_THRESHOLD) {
                        potentialParents.push(org);
                    }
                }
            }

            // 4. Handle Reproduction
            shuffleArray(potentialParents); // Randomize mating order
            const spatialLookup = this._buildSpatialLookup(this.organisms); // Build lookup for finding partners

            for (const parentA of potentialParents) {
                // Check again if alive and hasn't reproduced already this tick
                if (!parentA.alive || parentA.hasReproducedThisTick) continue;

                const partner = this._findPartner(parentA, spatialLookup);
                if (partner) {
                    // Check population limit before creating offspring
                    if (this.organisms.length + newborns.length < this.config.maxPopulation) {
                        const offspring = parentA.reproduce(partner);
                        offspring.id = this.nextOrganismId++; // Assign unique ID

                        // Deduct energy cost from parents
                        parentA.energy -= ENERGY_COST_OF_REPRODUCTION;
                        partner.energy -= ENERGY_COST_OF_REPRODUCTION;

                        // Mark parents as reproduced for this tick
                        parentA.hasReproducedThisTick = true;
                        partner.hasReproducedThisTick = true;

                        newborns.push(offspring);
                    } else {
                        // Population limit reached, stop trying to reproduce
                        break;
                    }
                }
            }

            // Add newborns to the main list
            this.organisms.push(...newborns);

            // 5. Update Stats & UI (via UI Manager)
            const currentStats = this._calculateStats();
            if (this.ui) {
                this.ui.updateUI(this.tick_count, currentStats, this.environment.temperature, this.environment.getTotalResources());
            }

            // 6. Draw Simulation State
            this._drawSimulation();

            // 7. Check for Extinction
            if (this.organisms.length === 0) {
                console.log("Population died out.");
                this.stop();
                if (this.ui) {
                    this.ui.showExtinctionMessage();
                }
            }

        } catch (e) {
            console.error("Error during simulation tick:", e);
            this.stop(); // Stop simulation on error
            if (this.ui) {
                this.ui.showErrorMessage("Error during tick. Simulation stopped.");
            }
        }
    }

    /**
     * Builds a spatial lookup table for efficient neighbor finding.
     * @param {Array<Organism>} organismsList - The list of organisms to index.
     * @returns {object} A lookup object where keys are "x,y" and values are arrays of organisms at that location.
     * @private
     */
    _buildSpatialLookup(organismsList) {
        const lookup = {};
        organismsList.forEach(org => {
            if (!org.alive) return; // Only index living organisms
            const key = `${org.location.x},${org.location.y}`;
            if (!lookup[key]) {
                lookup[key] = [];
            }
            lookup[key].push(org);
        });
        return lookup;
    }

    /**
     * Finds a suitable partner for reproduction near the given parent.
     * @param {Organism} parentA - The organism seeking a partner.
     * @param {object} spatialLookup - The spatial lookup table.
     * @returns {Organism|null} A suitable partner or null if none found.
     * @private
     */
    _findPartner(parentA, spatialLookup) {
        const { x: startX, y: startY } = parentA.location;
        const radius = MATING_SEARCH_RADIUS; // From config.js

        // Check surrounding cells first
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip self cell for now

                // Calculate neighbor coordinates with wrap-around
                const checkX = (startX + dx + this.config.gridWidth) % this.config.gridWidth;
                const checkY = (startY + dy + this.config.gridHeight) % this.config.gridHeight;
                const key = `${checkX},${checkY}`;

                if (spatialLookup[key]) {
                    for (const potentialPartner of spatialLookup[key]) {
                        // Check eligibility: different ID, alive, hasn't reproduced, old enough, enough energy
                        if (potentialPartner.id !== parentA.id &&
                            potentialPartner.alive &&
                            !potentialPartner.hasReproducedThisTick &&
                            potentialPartner.age >= REPRODUCTION_AGE &&
                            potentialPartner.energy >= REPRODUCTION_ENERGY_THRESHOLD) {
                            return potentialPartner; // Found a partner
                        }
                    }
                }
            }
        }

        // Check own cell if no partner found in surroundings
        const ownCellKey = `${startX},${startY}`;
        if (spatialLookup[ownCellKey]) {
            for (const potentialPartner of spatialLookup[ownCellKey]) {
                if (potentialPartner.id !== parentA.id &&
                    potentialPartner.alive &&
                    !potentialPartner.hasReproducedThisTick &&
                    potentialPartner.age >= REPRODUCTION_AGE &&
                    potentialPartner.energy >= REPRODUCTION_ENERGY_THRESHOLD) {
                    return potentialPartner; // Found partner in own cell
                }
            }
        }

        return null; // No suitable partner found
    }

    /**
     * Calculates statistics about the current organism population.
     * @returns {object} An object containing population stats (count, avg genes, allele freqs).
     * @private
     */
    _calculateStats() {
        const popSize = this.organisms.length;
        const stats = {
            population: popSize,
            avgMetabolism: NaN,
            avgTempTolerance: NaN,
            avgFeedingEff: NaN,
            alleleFreqs: { 'Cold': 0, 'Mid': 0, 'Warm': 0 } // Based on ALLELE_TEMP_BINS from config.js
        };

        if (popSize === 0) {
            return stats; // Return default NaN/0 stats if population is zero
        }

        let totalMetabolism = 0, totalTempTolerance = 0, totalFeedingEff = 0;
        let counts = { 'Cold': 0, 'Mid': 0, 'Warm': 0 };

        this.organisms.forEach(org => {
            totalMetabolism += org.genes.metabolism_efficiency;
            totalTempTolerance += org.genes.temperature_tolerance;
            totalFeedingEff += org.genes.feeding_efficiency;

            // Classify temperature tolerance allele
            const tempVal = org.genes.temperature_tolerance;
            if (ALLELE_TEMP_BINS.Cold(tempVal)) counts.Cold++;
            else if (ALLELE_TEMP_BINS.Mid(tempVal)) counts.Mid++;
            else if (ALLELE_TEMP_BINS.Warm(tempVal)) counts.Warm++;
        });

        // Calculate averages
        stats.avgMetabolism = totalMetabolism / popSize;
        stats.avgTempTolerance = totalTempTolerance / popSize;
        stats.avgFeedingEff = totalFeedingEff / popSize;

        // Calculate frequencies
        for (const bin in stats.alleleFreqs) {
            stats.alleleFreqs[bin] = counts[bin] / popSize;
        }

        return stats;
    }

    /**
     * Draws the current state of the simulation grid and organisms onto the canvas.
     * @private
     */
    _drawSimulation() {
        if (!this.environment || !this.ctx || !this.canvas) return; // Ensure everything is ready

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cellSz = this.cellSize; // Use the simulation's cell size

        // --- Draw Background & Resources ---
        ctx.fillStyle = '#DDDDDD'; // Default background
        ctx.fillRect(0, 0, width, height);

        const maxRes = CELL_MAX_RESOURCES; // From config.js
        for (let y = 0; y < this.config.gridHeight; y++) {
            for (let x = 0; x < this.config.gridWidth; x++) {
                const cell = this.environment.getCell(x, y);
                if (!cell) continue; // Should not happen in a valid grid

                // Color cell based on resource amount (more green = more resources)
                const resourceRatio = clamp(cell.resourceAmount / maxRes, 0, 1); // Use clamp from utils.js
                const greenIntensity = Math.floor(180 + resourceRatio * 75);
                const baseIntensity = Math.floor(245 - resourceRatio * 45);
                ctx.fillStyle = `rgb(${baseIntensity - 30}, ${greenIntensity}, ${baseIntensity - 30})`;
                ctx.fillRect(x * cellSz, y * cellSz, cellSz, cellSz);

                // Draw border for resource nodes
                if (cell.isNode) {
                    // Different border style if in manual placement mode preview
                    const isManualPreview = this.resourcePlacementMode === 'manual' && !this.isRunning;
                    ctx.strokeStyle = isManualPreview ? 'rgba(0, 0, 200, 0.9)' : 'rgba(0, 60, 0, 0.6)';
                    ctx.lineWidth = Math.max(1, cellSz * (isManualPreview ? 0.2 : 0.1));
                    // Offset stroke slightly for better visibility
                    ctx.strokeRect(x * cellSz + ctx.lineWidth / 2, y * cellSz + ctx.lineWidth / 2, cellSz - ctx.lineWidth, cellSz - ctx.lineWidth);
                }
            }
        }

        // --- Draw Organisms ---
        ctx.fillStyle = '#480048'; // Organism color
        // Calculate size and offset for centering organisms within cells
        const orgSize = Math.max(1, cellSz * 0.75);
        const offset = (cellSz - orgSize) / 2;

        this.organisms.forEach(org => {
            if (!org.alive) return; // Don't draw dead organisms
            const drawX = org.location.x * cellSz + offset;
            const drawY = org.location.y * cellSz + offset;
            ctx.fillRect(drawX, drawY, orgSize, orgSize);
        });
    }
}