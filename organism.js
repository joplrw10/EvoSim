// Define constants based on config.js values (assuming config.js is loaded first)
const mediumOptimum = TEMP_BASE; // Use global TEMP_BASE as reference for Medium phenotype
const highOptimum = TEMP_BASE + 10; // Example: High prefers 10 degrees warmer
const lowOptimum = TEMP_BASE - 10; // Example: Low prefers 10 degrees cooler
const toleranceRange = 5; // Example: +/- 5 degrees from optimum is ideal

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
            // Handle dominant/recessive genes
            if (geneName === 'temperature_tolerance') {
                const allele1 = Math.random() < 0.5 ? 'H' : 'L';
                const allele2 = Math.random() < 0.5 ? 'H' : 'L';
                this.genes[geneName] = [allele1, allele2];
            } else if (geneName === 'size') {
                const allele1 = Math.random() < 0.5 ? 'S' : 's';
                const allele2 = Math.random() < 0.5 ? 'S' : 's';
                this.genes[geneName] = [allele1, allele2];
            } else if (geneName === 'speed') {
                const allele1 = Math.random() < 0.5 ? 'F' : 'f';
                const allele2 = Math.random() < 0.5 ? 'F' : 'f';
                this.genes[geneName] = [allele1, allele2];
            } else if (geneName === 'camouflage') {
                const allele1 = Math.random() < 0.5 ? 'C' : 'c';
                const allele2 = Math.random() < 0.5 ? 'C' : 'c';
                this.genes[geneName] = [allele1, allele2];
            } else if (geneName === 'reproductive_rate') {
                const allele1 = Math.random() < 0.5 ? 'R' : 'r';
                const allele2 = Math.random() < 0.5 ? 'R' : 'r';
                this.genes[geneName] = [allele1, allele2];
            } else if (geneName === 'resistance') {
                const allele1 = Math.random() < 0.5 ? 'D' : 'd';
                const allele2 = Math.random() < 0.5 ? 'D' : 'd';
                this.genes[geneName] = [allele1, allele2];
            }
            // Handle float-based genes
            else {
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

        const allele1 = alleles[0];
        const allele2 = alleles[1];

        if (geneName === 'temperature_tolerance') {
            // Dominant/Recessive with Heterozygous 'Medium' phenotype
            if (allele1 === 'H' && allele2 === 'H') return 'High';
            if (allele1 === 'L' && allele2 === 'L') return 'Low';
            return 'Medium'; // HL or LH
        } else if (geneName === 'size') {
            // 'S' (Large) is dominant over 's' (Small)
            if (allele1 === 'S' || allele2 === 'S') return 'Large';
            return 'Small'; // ss
        } else if (geneName === 'speed') {
            // 'F' (Fast) is dominant over 'f' (Slow)
            if (allele1 === 'F' || allele2 === 'F') return 'Fast';
            return 'Slow'; // ff
        } else if (geneName === 'camouflage') {
            // 'C' (Camouflaged) is dominant over 'c' (Conspicuous)
            if (allele1 === 'C' || allele2 === 'C') return 'Camouflaged';
            return 'Conspicuous'; // cc
        } else if (geneName === 'reproductive_rate') {
            // 'R' (High) is dominant over 'r' (Low)
            if (allele1 === 'R' || allele2 === 'R') return 'High';
            return 'Low'; // rr
        } else if (geneName === 'resistance') {
            // 'D' (Resistant) is dominant over 'd' (Susceptible)
            if (allele1 === 'D' || allele2 === 'D') return 'Resistant';
            return 'Susceptible'; // dd
        }
        // --- Float-based genes ---
        else {
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

        // Use the cell's current temperature, which is calculated by the environment
        const currentCellTemp = cell.currentTemp;

        // --- Temperature Penalty based on Phenotype ---
        const tempPhenotype = this.getPhenotype('temperature_tolerance'); // 'High', 'Medium', 'Low'
        let tempPenaltyMultiplier = 1.0; // Default penalty multiplier

        // Define rough temperature zones (adjust thresholds as needed)
        // Define rough temperature zones relative to the *biome's* base temp? Or global base?
        // Let's use thresholds relative to the organism's *phenotype* preference for simplicity.
        // We need reference points. Let's assume 'Medium' prefers TEMP_BASE (from config).
        // 'High' prefers higher, 'Low' prefers lower.
        // Optimums and toleranceRange are now defined globally within this file

        if (tempPhenotype === 'High') {
            // High phenotype: Penalize if below medium optimum, benefit if above high optimum
            if (currentCellTemp < mediumOptimum - toleranceRange) {
                tempPenaltyMultiplier = 2.5; // High penalty in cold
            } else if (currentCellTemp < highOptimum - toleranceRange) {
                 tempPenaltyMultiplier = 1.2; // Slight penalty in medium temps
            } else {
                 tempPenaltyMultiplier = 0.8; // Benefit in high temps
            }
        } else if (tempPhenotype === 'Low') {
            // Low phenotype: Penalize if above medium optimum, benefit if below low optimum
             if (currentCellTemp > mediumOptimum + toleranceRange) {
                 tempPenaltyMultiplier = 2.5; // High penalty in heat
             } else if (currentCellTemp > lowOptimum + toleranceRange) {
                 tempPenaltyMultiplier = 1.2; // Slight penalty in medium temps
             } else {
                 tempPenaltyMultiplier = 0.8; // Benefit in low temps
             }
        }
        else if (tempPhenotype === 'Medium') {
            // Medium phenotype: Penalize if outside medium range
            if (currentCellTemp < mediumOptimum - toleranceRange || currentCellTemp > mediumOptimum + toleranceRange) {
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

        // --- Size Phenotype Effect ---
        const sizePhenotype = this.getPhenotype('size');
        if (sizePhenotype === 'Large') {
            moveCost *= 1.1; // Large organisms cost slightly more to move
        } else if (sizePhenotype === 'Small') {
            moveCost *= 0.9; // Small organisms cost slightly less
        }
        // Ensure cost doesn't go below a minimum threshold? (Optional)
        // moveCost = Math.max(moveCost, MINIMUM_MOVEMENT_COST);

        this.energy -= moveCost;
        this.location.x = nextX;
        this.location.y = nextY;
    }

    /**
     * Checks if the organism should die due to low energy or old age.
     * @private
     */
    _checkDeath() {
        let shouldDie = false;
        if (this.energy <= 0) {
            shouldDie = true;
            // console.log(`Organism ${this.id} starving.`);
        }
        if (this.age > MAX_LIFESPAN) { // From config.js
             shouldDie = true;
             // console.log(`Organism ${this.id} died of old age.`);
        }

        if (shouldDie) {
            // --- Resistance Phenotype Effect ---
            const resistancePhenotype = this.getPhenotype('resistance');
            const resistanceCheck = Math.random(); // Roll for resistance/susceptibility

            if (resistancePhenotype === 'Resistant' && resistanceCheck < 0.1) { // e.g., 10% chance to survive lethal condition
                // console.log(`Organism ${this.id} resisted death!`);
                // Give a small energy boost to prevent immediate re-death?
                this.energy = Math.max(this.energy, BASE_ENERGY_COST_PER_TICK * 2); // Give minimal energy
                // Reset age slightly? Or just let it die next tick if still old? For now, just survive this tick.
            } else if (resistancePhenotype === 'Susceptible' && resistanceCheck < 0.05) { // e.g., 5% *additional* chance to die even if conditions weren't lethal? No, apply to existing lethal checks.
                 // Let's rephrase: If susceptible, the chance to resist is lower or non-existent.
                 // The current logic already makes them die. We need a chance to *avoid* death if resistant.
                 // Let's adjust:
                 this.alive = false; // Default: die if conditions met

                 if (resistancePhenotype === 'Resistant' && resistanceCheck < 0.1) { // 10% chance to *ignore* death trigger this tick
                     this.alive = true; // SURVIVED!
                     this.energy = Math.max(this.energy, BASE_ENERGY_COST_PER_TICK * 2); // Give minimal energy back if starving
                     // console.log(`Organism ${this.id} resisted death!`);
                 }
                 // If 'Susceptible', they just die as normal (this.alive remains false).
                 // If neither Resistant nor Susceptible (which shouldn't happen with D/d), they die as normal.

            } else {
                 // Not resistant or resistance roll failed
                 this.alive = false;
            }
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

            // --- Handle Allele Flipping for Dominant/Recessive Genes ---
            const isDominantRecessive = ['temperature_tolerance', 'size', 'speed', 'camouflage', 'reproductive_rate', 'resistance'].includes(geneName);

            if (isDominantRecessive) {
                 // Determine the two possible alleles for this gene
                 let dominantAllele = '';
                 let recessiveAllele = '';
                 switch (geneName) {
                     case 'temperature_tolerance': dominantAllele = 'H'; recessiveAllele = 'L'; break;
                     case 'size': dominantAllele = 'S'; recessiveAllele = 's'; break;
                     case 'speed': dominantAllele = 'F'; recessiveAllele = 'f'; break;
                     case 'camouflage': dominantAllele = 'C'; recessiveAllele = 'c'; break;
                     case 'reproductive_rate': dominantAllele = 'R'; recessiveAllele = 'r'; break;
                     case 'resistance': dominantAllele = 'D'; recessiveAllele = 'd'; break;
                 }

                 // Mutate allele 1 (flip)
                 if (Math.random() < alleleFlipRate) {
                     allele1 = (allele1 === dominantAllele ? recessiveAllele : dominantAllele);
                 }
                 // Mutate allele 2 (flip)
                 if (Math.random() < alleleFlipRate) {
                     allele2 = (allele2 === dominantAllele ? recessiveAllele : dominantAllele);
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
        // --- Create Offspring ---
        // The constructor now correctly initializes alleles based on gene name.
        // We need to pass *some* value for the new genes in initialGenes, but the constructor
        // will overwrite them with random alleles anyway. Let's pass a default value (e.g., 0)
        // for the new genes just to satisfy the loop structure, although it's not strictly used
        // for allele generation for these new genes.
        // The *correct* genotype is assigned directly after creation.

        // Create a dummy initialGenes object based on the *parent's* genes
        // This is only needed because the constructor expects it.
        const dummyInitialGenes = {};
         for (const geneName in this.genes) {
             if (['metabolism_efficiency', 'feeding_efficiency'].includes(geneName)) {
                 // Pass average for float genes
                 dummyInitialGenes[geneName] = (this.genes[geneName][0] + this.genes[geneName][1]) / 2.0;
             } else {
                 // Pass a placeholder for dominant/recessive (value doesn't matter here)
                 dummyInitialGenes[geneName] = 0; // Or null, or any placeholder
             }
         }
        // Ensure all new genes are present in the dummy object if the parent didn't have them (unlikely but safe)
        ['size', 'speed', 'camouflage', 'reproductive_rate', 'resistance'].forEach(gene => {
            if (!dummyInitialGenes.hasOwnProperty(gene)) {
                dummyInitialGenes[gene] = 0;
            }
        });


        const offspring = new Organism(-1, dummyInitialGenes, offspringLocation);

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