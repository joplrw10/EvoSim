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
            if (geneName === 'temperature_tolerance') {
                // Initialize temperature alleles randomly as 'H' or 'L'
                const allele1 = Math.random() < 0.5 ? 'H' : 'L';
                const allele2 = Math.random() < 0.5 ? 'H' : 'L';
                this.genes[geneName] = [allele1, allele2];
            } else {
                // Initialize other genes as float pairs based on average phenotype
                const baseValue = initialGenes[geneName];
                const variation = INITIAL_GENE_VARIATION * 0.5;
                const allele1 = baseValue + getRandom(-variation, variation);
                const allele2 = baseValue + getRandom(-variation, variation);
                // Clamp initial float alleles immediately for safety
                if (geneName === 'metabolism_efficiency' || geneName === 'feeding_efficiency') {
                     this.genes[geneName] = [clamp(allele1, 0.1, 2.0), clamp(allele2, 0.1, 2.0)];
                } else {
                     // Default case if other float genes are added
                     this.genes[geneName] = [allele1, allele2];
                }
            }
        }
        this.hasReproducedThisTick = false; // Flag to prevent multiple reproductions per tick
    }
    /**
     * Calculates the expressed phenotype for a given gene based on its alleles.
     * Uses dominant/recessive for temperature_tolerance ('H' dominant over 'L').
     * Uses averaging for other float-based genes.
     * @param {string} geneName - The name of the gene.
     * @returns {number|string} The calculated phenotype value (string for temp, number for others).
     */
    getPhenotype(geneName) {
        const alleles = this.genes[geneName];
        if (!alleles) {
            console.warn(`Gene ${geneName} not found for organism ${this.id}`);
            return geneName === 'temperature_tolerance' ? 'Medium' : 0; // Default phenotype
        }

        if (geneName === 'temperature_tolerance') {
            // Dominant/Recessive with Heterozygous 'Medium' phenotype
            const allele1 = alleles[0];
            const allele2 = alleles[1];

            if (allele1 === 'H' && allele2 === 'H') {
                return 'High';
            } else if (allele1 === 'L' && allele2 === 'L') {
                return 'Low';
            } else {
                return 'Medium'; // HL or LH
            }
        } else {
            // Simple additive model for other genes: average of the two float alleles
            const phenotype = (alleles[0] + alleles[1]) / 2.0;
            return phenotype;
        }
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

        // --- Temperature Penalty based on Phenotype ---
        const tempPhenotype = this.getPhenotype('temperature_tolerance'); // 'High', 'Medium', 'Low'
        let tempPenaltyMultiplier = 1.0; // Default penalty multiplier

        // Define rough temperature zones (adjust thresholds as needed)
        const lowTempThreshold = TEMP_BASE - TEMP_AMPLITUDE * 0.4; // e.g., 25 - 15*0.4 = 19
        const highTempThreshold = TEMP_BASE + TEMP_AMPLITUDE * 0.4; // e.g., 25 + 15*0.4 = 31

        if (tempPhenotype === 'High') {
            if (effectiveTemperature < lowTempThreshold) {
                tempPenaltyMultiplier = 2.5; // High penalty in cold
            } else if (effectiveTemperature < highTempThreshold) {
                 tempPenaltyMultiplier = 1.2; // Slight penalty in medium temps
            } else {
                 tempPenaltyMultiplier = 0.8; // Benefit in high temps
            }
        } else if (tempPhenotype === 'Low') {
             if (effectiveTemperature > highTempThreshold) {
                 tempPenaltyMultiplier = 2.5; // High penalty in heat
             } else if (effectiveTemperature > lowTempThreshold) {
                 tempPenaltyMultiplier = 1.2; // Slight penalty in medium temps
             } else {
                 tempPenaltyMultiplier = 0.8; // Benefit in low temps
             }
        }
        else if (tempPhenotype === 'Medium') {
            if (effectiveTemperature < lowTempThreshold || effectiveTemperature > highTempThreshold) {
                tempPenaltyMultiplier = 1.5; // Moderate penalty in extremes
            } else {
                tempPenaltyMultiplier = 1.0; // No penalty in medium temps
            }
        }

        // Apply base cost penalty factor AND the phenotype multiplier
        // We still need a base penalty for being away from the *absolute* optimum,
        // but the phenotype adjusts *how much* that penalty is.
        // Let's simplify: the phenotype multiplier directly affects the cost.
        // A more complex model could adjust the TEMP_PENALTY_FACTOR itself.
        // Simpler approach: Phenotype multiplier directly scales the base cost part.
        cost *= tempPenaltyMultiplier;

        // --- Original temp difference penalty (optional, could be removed if multiplier handles it) ---
        // let tempDifference = Math.abs(effectiveTemperature - TEMP_BASE); // Difference from base optimal?
        // cost *= (1 + tempDifference * TEMP_PENALTY_FACTOR * tempPenaltyMultiplier);

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
     * Handles 'H'/'L' flips for temperature and float changes for others.
     * @param {object} genotype - The genotype object { geneName: [allele1, allele2], ... } to mutate.
     * @returns {object} The mutated genotype object.
     * @private
     */
    _mutateGenotype(genotype) {
        const mutatedGenotype = {};
        const currentMutationRate = MUTATION_RATE; // Global from config.js
        // Define a separate, likely lower, mutation rate for allele flips
        const alleleFlipRate = currentMutationRate * 0.2; // e.g., 20% of base mutation rate

        for (const geneName in genotype) {
            let allele1 = genotype[geneName][0];
            let allele2 = genotype[geneName][1];

            if (geneName === 'temperature_tolerance') {
                // Mutate allele 1 (flip H/L)
                if (Math.random() < alleleFlipRate) {
                    allele1 = (allele1 === 'H' ? 'L' : 'H');
                }
                // Mutate allele 2 (flip H/L)
                if (Math.random() < alleleFlipRate) {
                    allele2 = (allele2 === 'H' ? 'L' : 'H');
                }
            } else {
                // Mutate float alleles for other genes
                // Mutate allele 1
                if (Math.random() < currentMutationRate) {
                    allele1 += getRandom(-MUTATION_AMOUNT, MUTATION_AMOUNT);
                }
                // Mutate allele 2
                if (Math.random() < currentMutationRate) {
                    allele2 += getRandom(-MUTATION_AMOUNT, MUTATION_AMOUNT);
                }

                // Clamp mutated float alleles
                if (geneName === 'metabolism_efficiency' || geneName === 'feeding_efficiency') {
                    allele1 = clamp(allele1, 0.1, 2.0);
                    allele2 = clamp(allele2, 0.1, 2.0);
                }
                 // Add clamping for other float genes if needed
            }

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
                // Inherit one random allele (could be 'H'/'L' or float) from each parent
                const alleleFromParentA = this.genes[geneName][getRandomInt(0, 1)];
                const alleleFromParentB = partner.genes[geneName][getRandomInt(0, 1)];
                offspringGenotype[geneName] = [alleleFromParentA, alleleFromParentB];
            } else {
                // Fallback if partner lacks the gene (shouldn't happen if same species)
                offspringGenotype[geneName] = [...this.genes[geneName]]; // Copy from parent A
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

        // Create offspring with placeholder genes.
        // For temp tolerance, we can't average 'H'/'L', so use a default or parent A's phenotype.
        // For others, use the average of the new alleles.
        const placeholderInitialGenes = {};
        for(const geneName in finalOffspringGenotype) {
            if (geneName === 'temperature_tolerance') {
                 // Determine placeholder phenotype based on inherited genotype (H/L/M)
                 const alleles = finalOffspringGenotype[geneName];
                 if (alleles[0] === 'H' && alleles[1] === 'H') {
                     placeholderInitialGenes[geneName] = TEMP_BASE + 5; // Placeholder value representing 'High'
                 } else if (alleles[0] === 'L' && alleles[1] === 'L') {
                     placeholderInitialGenes[geneName] = TEMP_BASE - 5; // Placeholder value representing 'Low'
                 } else {
                      placeholderInitialGenes[geneName] = TEMP_BASE; // Placeholder value representing 'Medium'
                 }
            } else {
                 // Average float alleles for placeholder
                 placeholderInitialGenes[geneName] = (finalOffspringGenotype[geneName][0] + finalOffspringGenotype[geneName][1]) / 2.0;
            }
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