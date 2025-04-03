/**
 * Represents a single organism in the simulation.
 */
class Organism {
    /**
     * Creates a new Organism instance.
     * @param {number} id - Unique identifier for the organism.
     * @param {object} initialGenes - An object containing gene names and their *initial phenotype* values (used to create allele pairs).
     * @param {{x: number, y: number}} location - The initial coordinates of the organism.
     */
    constructor(id, initialGenes, location) {
        this.id = id;
        this.species = "BaseSpecies"; // Could be evolved later
        this.age = 0;
        this.energy = INITIAL_ENERGY; // From config.js
        this.alive = true;
        this.location = { ...location }; // Ensure it's a copy
        // Initialize genotype: Store pairs of alleles for each gene
        this.genes = {};
        for (const geneName in initialGenes) {
            // Create two alleles based on the initial value, adding some variation
            // This assumes initialGenes provides the target *phenotype* average
            const baseValue = initialGenes[geneName];
            // Simple variation: could be more sophisticated (e.g., normal distribution)
            const variation = INITIAL_GENE_VARIATION * 0.5; // Adjust variation source if needed
            const allele1 = baseValue + getRandom(-variation, variation);
            const allele2 = baseValue + getRandom(-variation, variation);
            // Store the allele pair, ensuring clamping happens later if needed during mutation/inheritance
            this.genes[geneName] = [allele1, allele2];
        }
        this.hasReproducedThisTick = false; // Flag to prevent multiple reproductions per tick
    }
    /**
     * Calculates the expressed phenotype for a given gene based on its alleles.
     * For now, uses simple averaging (additive model).
     * @param {string} geneName - The name of the gene.
     * @returns {number} The calculated phenotype value.
     */
    getPhenotype(geneName) {
        if (!this.genes[geneName]) {
            console.warn(`Gene ${geneName} not found for organism ${this.id}`);
            return 0; // Or throw error, or return a default
        }
        // Simple additive model: average of the two alleles
        const phenotype = (this.genes[geneName][0] + this.genes[geneName][1]) / 2.0;
        return phenotype;
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
        let cost = BASE_ENERGY_COST_PER_TICK / this.getPhenotype('metabolism_efficiency');

        // Calculate effective temperature including biome offset
        const effectiveTemperature = environment.temperature + cell.tempOffset;

        // Additional cost based on difference between effective temp and organism's tolerance
        let tempDifference = Math.abs(effectiveTemperature - this.getPhenotype('temperature_tolerance'));
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
            let energyGained = consumed * FOOD_ENERGY_VALUE * this.getPhenotype('feeding_efficiency');
            this.energy = clamp(this.energy + energyGained, 0, MAX_ENERGY); // Use clamp from utils.js, MAX_ENERGY from config.js
        }
    }

    /**
     * Moves the organism randomly to an adjacent cell (including diagonals) and consumes energy.
     * @private
     */
    _move(environment, predators) { // Accept list of predators
        let dx = 0;
        let dy = 0;
        let fleeing = false;

        // --- Predator Evasion Logic ---
        // TODO: Make detection range a gene? For now, use a constant.
        const preyDetectionRange = 4;
        const preyDetectionRangeSq = preyDetectionRange * preyDetectionRange;
        let closestPredatorDistSq = Infinity;
        let escapeVector = { x: 0, y: 0 };

        for (const predator of predators) {
            if (!predator.alive) continue;
            const distSq = (this.location.x - predator.location.x)**2 + (this.location.y - predator.location.y)**2;

            if (distSq <= preyDetectionRangeSq) {
                fleeing = true;
                // Simple weighted escape vector: move away from closer predators more strongly
                const weight = 1 / (distSq + 0.1); // Add small value to avoid division by zero
                escapeVector.x += (this.location.x - predator.location.x) * weight;
                escapeVector.y += (this.location.y - predator.location.y) * weight;

                if (distSq < closestPredatorDistSq) {
                    closestPredatorDistSq = distSq;
                }
            }
        }

        if (fleeing) {
            // Normalize the escape vector roughly to get a direction
            const magnitude = Math.sqrt(escapeVector.x**2 + escapeVector.y**2);
            if (magnitude > 0) {
                // Move directly away from the weighted center of threat
                dx = Math.round(escapeVector.x / magnitude);
                dy = Math.round(escapeVector.y / magnitude);
                // Ensure dx, dy are within -1, 0, 1
                dx = clamp(dx, -1, 1);
                dy = clamp(dy, -1, 1);
            }
            // If vector is zero (predator exactly on top?), move randomly
            if (dx === 0 && dy === 0) {
                dx = getRandomInt(-1, 1);
                dy = getRandomInt(-1, 1);
            }
             // Optional: Increase energy cost when fleeing?
             // moveCost *= 1.5;
        } else {
            // --- Random Movement Logic ---
            dx = getRandomInt(-1, 1);
            dy = getRandomInt(-1, 1);
        }

        // --- Apply Movement ---
        if (dx === 0 && dy === 0) {
            return; // No movement, no cost
        }

        const nextX = (this.location.x + dx + gridWidth) % gridWidth;
        const nextY = (this.location.y + dy + gridHeight) % gridHeight;

        const targetCell = environment.getCell(nextX, nextY);
        let moveCost = MOVEMENT_ENERGY_COST; // Base cost

        if (targetCell) {
            moveCost *= targetCell.moveCostMultiplier; // Apply biome cost
        } else {
            console.warn(`Organism ${this.id} tried to move to invalid cell (${nextX}, ${nextY})`);
        }

        this.energy -= moveCost;
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
     * Mutates the alleles within a given genotype (allele pairs).
     * @param {object} genotype - The genotype object { geneName: [allele1, allele2], ... } to mutate.
     * @returns {object} The mutated genotype object.
     * @private
     */
    _mutateGenotype(genotype) {
        const mutatedGenotype = {};
        const currentMutationRate = MUTATION_RATE; // Global from config.js

        for (const geneName in genotype) {
            let allele1 = genotype[geneName][0];
            let allele2 = genotype[geneName][1];

            // Mutate allele 1
            if (Math.random() < currentMutationRate) {
                allele1 += getRandom(-MUTATION_AMOUNT, MUTATION_AMOUNT);
            }
            // Mutate allele 2
            if (Math.random() < currentMutationRate) {
                allele2 += getRandom(-MUTATION_AMOUNT, MUTATION_AMOUNT);
            }

            // Clamp mutated alleles
            if (geneName === 'metabolism_efficiency' || geneName === 'feeding_efficiency') {
                allele1 = clamp(allele1, 0.1, 2.0);
                allele2 = clamp(allele2, 0.1, 2.0);
            } else if (geneName === 'temperature_tolerance') {
                allele1 = clamp(allele1, -10, 60);
                allele2 = clamp(allele2, -10, 60);
            }
            // Add clamping for other genes if needed

            mutatedGenotype[geneName] = [allele1, allele2];
        }
        return mutatedGenotype;
    }

    /**
     * Creates a new offspring organism via sexual reproduction with a partner.
     * Inherits one random allele from each parent per gene, then mutates the resulting genotype.
     * @param {Organism} partner - The organism to reproduce with.
     * @returns {Organism} A new Organism instance (offspring).
     */
    reproduce(partner) {
        const offspringGenotype = {};

        // Inherit one allele randomly from each parent for each gene
        for (const geneName in this.genes) {
            if (partner.genes.hasOwnProperty(geneName)) {
                const alleleFromParentA = this.genes[geneName][getRandomInt(0, 1)];
                const alleleFromParentB = partner.genes[geneName][getRandomInt(0, 1)];
                offspringGenotype[geneName] = [alleleFromParentA, alleleFromParentB];
            } else {
                // Handle case where partner might lack a gene (e.g., different species later)
                // For now, just copy from parent A - could be more complex
                offspringGenotype[geneName] = [...this.genes[geneName]];
            }
        }

        // Mutate the inherited genotype
        const finalOffspringGenotype = this._mutateGenotype(offspringGenotype);

        // Offspring starts at the location of parent 'this'
        const offspringLocation = { ...this.location };

        // Create the new organism with the final genotype.
        // The constructor now expects an object representing the *initial phenotype values*
        // to create its own allele pairs. We need to pass the *genotype* directly,
        // so we need a way to bypass the constructor's allele generation or add a new constructor path.

        // --- Option 1: Add a flag/different constructor --- (More complex)
        // --- Option 2: Create with placeholder, then assign genotype --- (Simpler for now)

        // Create offspring with placeholder genes (using phenotype average for simplicity)
        const placeholderInitialGenes = {};
        for(const geneName in finalOffspringGenotype) {
            placeholderInitialGenes[geneName] = (finalOffspringGenotype[geneName][0] + finalOffspringGenotype[geneName][1]) / 2.0;
        }
        const offspring = new Organism(-1, placeholderInitialGenes, offspringLocation);

        // Directly assign the calculated genotype to the offspring
        offspring.genes = finalOffspringGenotype;

        return offspring;
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
    update(environment, predators) { // Add predators parameter
        if (!this.alive) return null; // Skip updates if dead

        this.age++; // Increment age each active tick
        this._move(environment, predators); // Pass predators list
        this._metabolize(environment);
        this._feed(environment);
        this._checkDeath(); // Check death after all actions

        // Currently returns null, could be extended for more complex interactions
        return null;
    }
}