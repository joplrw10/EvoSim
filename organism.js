/**
 * Represents a single organism in the simulation.
 */
class Organism {
    /**
     * Creates a new Organism instance.
     * @param {number} id - Unique identifier for the organism.
     * @param {object} genes - An object containing gene names and their values.
     * @param {{x: number, y: number}} location - The initial coordinates of the organism.
     */
    constructor(id, genes, location) {
        this.id = id;
        this.species = "BaseSpecies"; // Could be evolved later
        this.age = 0;
        this.energy = INITIAL_ENERGY; // From config.js
        this.alive = true;
        this.location = { ...location }; // Ensure it's a copy
        this.genes = { ...genes };     // Ensure it's a copy
        this.hasReproducedThisTick = false; // Flag to prevent multiple reproductions per tick
    }

    /**
     * Reduces energy based on metabolism and environmental temperature.
     * @param {Environment} environment - The simulation environment.
     * @private
     */
    _metabolize(environment) {
        const cell = environment.getCell(this.location.x, this.location.y);
        if (!cell) return; // Should not happen, but safety check

        // Base cost adjusted by metabolic efficiency (lower efficiency = higher cost)
        let cost = BASE_ENERGY_COST_PER_TICK / this.genes.metabolism_efficiency; // From config.js

        // Calculate effective temperature including biome offset
        const effectiveTemperature = environment.temperature + cell.tempOffset;

        // Additional cost based on difference between effective temp and organism's tolerance
        let tempDifference = Math.abs(effectiveTemperature - this.genes.temperature_tolerance);
        cost *= (1 + tempDifference * TEMP_PENALTY_FACTOR); // From config.js

        this.energy -= cost;
    }

    /**
     * Consumes resources from the current cell to gain energy.
     * @param {Environment} environment - The simulation environment.
     * @private
     */
    _feed(environment) {
        const cell = environment.getCell(this.location.x, this.location.y);
        if (!cell) return; // Cell might be out of bounds (shouldn't happen with wrap-around)

        // Determine how much can be consumed (limited by cell resources and organism's rate)
        let canConsume = Math.min(cell.resourceAmount, FOOD_CONSUMPTION_RATE); // From config.js

        if (canConsume > 0) {
            // Consume the resource from the environment
            const consumed = environment.consumeResourceAt(this.location.x, this.location.y, canConsume);

            // Gain energy based on consumed amount and feeding efficiency
            let energyGained = consumed * FOOD_ENERGY_VALUE * this.genes.feeding_efficiency; // From config.js
            this.energy = clamp(this.energy + energyGained, 0, MAX_ENERGY); // Use clamp from utils.js, MAX_ENERGY from config.js
        }
    }

    /**
     * Moves the organism randomly to an adjacent cell (including diagonals) and consumes energy.
     * @private
     */
    _move(environment) { // Pass environment to access grid/cells
        const dx = getRandomInt(-1, 1); // Use getRandomInt from utils.js
        const dy = getRandomInt(-1, 1);

        if (dx === 0 && dy === 0) {
            return; // No movement, no cost
        }

        // Calculate potential new location
        // Note: gridWidth and gridHeight are expected to be globally available from config.js or simulation state
        const nextX = (this.location.x + dx + gridWidth) % gridWidth;
        const nextY = (this.location.y + dy + gridHeight) % gridHeight;

        // Get the cell the organism is moving *into*
        const targetCell = environment.getCell(nextX, nextY);
        let moveCost = MOVEMENT_ENERGY_COST; // Base cost from config.js

        if (targetCell) {
            // Apply biome movement cost multiplier
            moveCost *= targetCell.moveCostMultiplier;
        } else {
            // Should not happen with wrap-around, but handle defensively
            console.warn(`Organism ${this.id} tried to move to invalid cell (${nextX}, ${nextY})`);
        }

        // Deduct energy cost for movement
        this.energy -= moveCost;

        // Update location only after calculating cost based on target cell
        this.location.x = nextX;
        this.location.y = nextY;
    }

    /**
     * Checks if the organism should die due to low energy or old age.
     * @private
     */
    _checkDeath() {
        if (this.energy <= 0 || this.age > MAX_LIFESPAN) { // From config.js
            this.alive = false;
        }
    }

    /**
     * Creates a mutated copy of the parent's genes.
     * @param {object} genesToMutate - The genes object to mutate.
     * @returns {object} A new object with potentially mutated genes.
     * @private
     */
    _mutateGenes(genesToMutate) {
        const mutatedGenes = { ...genesToMutate }; // Create a copy
        // Note: MUTATION_RATE is expected to be globally available from config.js or simulation state
        const currentMutationRate = MUTATION_RATE;

        for (const gene in mutatedGenes) {
            if (Math.random() < currentMutationRate) {
                let change = getRandom(-MUTATION_AMOUNT, MUTATION_AMOUNT); // Use getRandom from utils.js, MUTATION_AMOUNT from config.js
                mutatedGenes[gene] += change;

                // Clamp gene values to reasonable ranges
                if (gene === 'metabolism_efficiency' || gene === 'feeding_efficiency') {
                    mutatedGenes[gene] = clamp(mutatedGenes[gene], 0.1, 2.0); // Use clamp from utils.js
                } else if (gene === 'temperature_tolerance') {
                    // Allow wider range for temperature tolerance based on original code
                    mutatedGenes[gene] = clamp(mutatedGenes[gene], -10, 60); // Use clamp from utils.js
                }
                // Add clamping for other genes if introduced later
            }
        }
        return mutatedGenes;
    }

    /**
     * Creates a new offspring organism via sexual reproduction with a partner.
     * Genes are averaged, then mutated.
     * @param {Organism} partner - The organism to reproduce with.
     * @returns {Organism} A new Organism instance (offspring).
     */
    reproduce(partner) {
        const offspringGenes = {};

        // Average genes from both parents
        for (const gene in this.genes) {
            // Ensure the partner also has the gene (might differ if species diverge later)
            if (partner.genes.hasOwnProperty(gene)) {
                offspringGenes[gene] = (this.genes[gene] + partner.genes[gene]) / 2.0;
            } else {
                // If partner lacks the gene, inherit directly (or handle differently if needed)
                offspringGenes[gene] = this.genes[gene];
            }
        }

        // Mutate the averaged genes
        const finalOffspringGenes = this._mutateGenes(offspringGenes);

        // Offspring starts at the location of parent 'this'
        const offspringLocation = { ...this.location }; // Copy location

        // Create the new organism.
        // The ID assignment is handled by the Simulation class which increments a global counter.
        // We pass a placeholder ID (-1) here.
        return new Organism(-1, finalOffspringGenes, offspringLocation);
    }

    /**
     * Updates passive aspects like age and checks for death.
     * Separated in case some updates shouldn't happen every tick (though currently not used this way).
     */
    passiveUpdate() {
        if (!this.alive) return;
        this.age++;
        this._checkDeath();
    }

    /**
     * Performs the main update logic for one simulation tick.
     * @param {Environment} environment - The simulation environment.
     * @returns {null} Currently returns null, could return actions/events later.
     */
    update(environment) {
        if (!this.alive) return null; // Skip updates if dead

        this.age++; // Increment age each active tick
        this._move(environment); // Pass environment
        this._metabolize(environment);
        this._feed(environment);
        this._checkDeath(); // Check death after all actions

        // Currently returns null, could be extended for more complex interactions
        return null;
    }
}