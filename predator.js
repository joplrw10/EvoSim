/**
 * Represents a Predator organism in the simulation.
 * Initially similar to base Organism, but with added hunting capabilities and genes.
 */
class Predator {
    /**
     * Creates a new Predator instance.
     * @param {number} id - Unique identifier for the predator.
     * @param {object} genes - An object containing predator-specific gene names and values.
     * @param {{x: number, y: number}} location - The initial coordinates of the predator.
     */
    constructor(id, genes, location) {
        this.id = id;
        this.species = "PredatorSpecies"; // Distinguish from prey
        this.age = 0;
        this.energy = INITIAL_ENERGY * 1.5; // Predators might start with more energy
        this.alive = true;
        this.location = { ...location };
        // Ensure predator-specific genes are present, potentially inheriting others
        this.genes = {
            metabolism_efficiency: genes.metabolism_efficiency || 1.0, // Example default
            temperature_tolerance: genes.temperature_tolerance || 25,   // Example default
            // Predator specific genes (add defaults if not provided)
            speed: genes.speed || 1.0, // Base speed multiplier
            detection_range: genes.detection_range || 5, // How many cells away it can see prey
            hunting_efficiency: genes.hunting_efficiency || 0.5, // Chance to successfully catch prey upon contact
        };
        this.hasReproducedThisTick = false; // Reuse flag if predators reproduce
        this.targetPrey = null; // Store reference to targeted prey if any
    }

    // --- Core Lifecycle Methods (Similar to Organism, potentially adjusted) ---

    _metabolize(environment) {
        const cell = environment.getCell(this.location.x, this.location.y);
        if (!cell) return;
        // Predators might have higher base energy cost
        let cost = (BASE_ENERGY_COST_PER_TICK * 1.2) / this.genes.metabolism_efficiency;
        const effectiveTemperature = environment.temperature + cell.tempOffset;
        let tempDifference = Math.abs(effectiveTemperature - this.genes.temperature_tolerance);
        cost *= (1 + tempDifference * TEMP_PENALTY_FACTOR);
        this.energy -= cost;
    }

    // Predators don't feed on environment resources in this model
    // _feed(environment) { }

    _move(environment, allOrganisms) { // Needs allOrganisms to find prey
        const cell = environment.getCell(this.location.x, this.location.y);
        if (!cell) return;

        let dx = 0;
        let dy = 0;

        // --- Predator Behavior: Find and Move Towards Prey ---
        const nearbyPrey = this._findNearbyPrey(environment, allOrganisms);

        if (nearbyPrey.length > 0) {
            // Simple strategy: move towards the closest prey
            let closestPrey = null;
            let minDistanceSq = Infinity;

            for (const prey of nearbyPrey) {
                const distSq = (this.location.x - prey.location.x)**2 + (this.location.y - prey.location.y)**2;
                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestPrey = prey;
                }
            }

            if (closestPrey) {
                this.targetPrey = closestPrey; // Target the closest
                // Move towards target (adjust dx, dy)
                dx = Math.sign(closestPrey.location.x - this.location.x);
                dy = Math.sign(closestPrey.location.y - this.location.y);
                // Add randomness? Allow diagonal? For now, simple cardinal/diagonal step.
            } else {
                 this.targetPrey = null; // No prey found
            }
        } else {
             this.targetPrey = null; // No prey nearby
        }

        // If no prey targeted, move randomly (like base organism, but maybe faster)
        if (dx === 0 && dy === 0) {
            dx = getRandomInt(-1, 1);
            dy = getRandomInt(-1, 1);
        }

        if (dx === 0 && dy === 0) return; // No movement

        // Apply speed gene
        // For simplicity, let speed increase the *chance* or *distance* of moving per tick later.
        // Here, just use base movement cost calculation for now.
        const nextX = (this.location.x + dx + gridWidth) % gridWidth;
        const nextY = (this.location.y + dy + gridHeight) % gridHeight;

        const targetCell = environment.getCell(nextX, nextY);
        let moveCost = MOVEMENT_ENERGY_COST * 1.1; // Slightly higher base cost?

        if (targetCell) {
            moveCost *= targetCell.moveCostMultiplier;
        }

        this.energy -= moveCost;
        this.location.x = nextX;
        this.location.y = nextY;
    }

    _checkDeath() {
        // Predators might live shorter lives or die quicker from starvation
        if (this.energy <= 0 || this.age > MAX_LIFESPAN * 0.8) {
            this.alive = false;
        }
    }

    // Reproduction might differ for predators (e.g., need more energy)
    // _reproduce(partner) { ... }

    // --- Predator Specific Methods ---

    _findNearbyPrey(environment, allOrganisms) {
        const nearby = [];
        const range = this.genes.detection_range;
        const rangeSq = range * range;

        for (const org of allOrganisms) {
            // Check if it's prey (instanceof Organism, not Predator) and alive
            if (org instanceof Organism && org.alive) {
                // Basic distance check (can be optimized with spatial hashing later)
                const distSq = (this.location.x - org.location.x)**2 + (this.location.y - org.location.y)**2;
                if (distSq <= rangeSq) {
                    nearby.push(org);
                }
            }
        }
        return nearby;
    }

    /**
     * Attempts to hunt prey at the current location.
     * @param {Array<Organism>} organismsInCell - List of all organisms (prey) in the same cell.
     * @returns {Organism | null} The prey organism that was successfully hunted, or null.
     */
    hunt(organismsInCell) {
        if (!this.alive) return null;

        for (const potentialPrey of organismsInCell) {
            // Ensure it's actually prey (not another predator) and alive
            if (potentialPrey instanceof Organism && potentialPrey.alive && potentialPrey.id !== this.id) {
                // Check hunting efficiency
                if (Math.random() < this.genes.hunting_efficiency) {
                    // Successful hunt!
                    const energyGain = potentialPrey.energy * 0.8; // Gain portion of prey's energy
                    this.energy = clamp(this.energy + energyGain, 0, MAX_ENERGY * 1.2); // Predators might have higher max energy
                    potentialPrey.alive = false; // Prey dies
                    console.log(`Predator ${this.id} hunted Organism ${potentialPrey.id}`);
                    this.targetPrey = null; // Stop targeting
                    return potentialPrey; // Return the hunted prey
                } else {
                    // Failed hunt attempt (prey escapes this time)
                    // Optionally add a cooldown or reduce energy slightly for failed attempt
                }
            }
        }
        return null; // No prey hunted in this cell
    }

    /**
     * Main update logic for the predator.
     * @param {Environment} environment - The simulation environment.
     * @param {Array<Organism|Predator>} allOrganisms - List of all organisms for prey detection.
     * @param {Array<Organism>} organismsInCell - Prey organisms in the same cell for hunting.
     */
    update(environment, allOrganisms, organismsInCell) {
        if (!this.alive) return null;

        this.age++;
        this._metabolize(environment);
        this._move(environment, allOrganisms); // Movement includes seeking prey
        const huntedPrey = this.hunt(organismsInCell); // Attempt to hunt if prey is present
        this._checkDeath();

        // Return hunted prey ID if successful, otherwise null
        return huntedPrey ? huntedPrey.id : null;
    }
}