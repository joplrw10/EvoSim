/**
 * Represents the simulation environment, including the grid, resources, and temperature.
 */
// Define Biome properties
// Define Biome properties including base temperature and fluctuation amplitude
const BIOME_DEFINITIONS = {
    // Values are examples, adjust for desired simulation behavior
    PLAINS: { name: "Plains", color: "#a1c45a", baseTemp: 25, tempAmplitude: 8, moveCostMultiplier: 1.0 },
    FOREST: { name: "Forest", color: "#228B22", baseTemp: 20, tempAmplitude: 5, moveCostMultiplier: 1.5 },
    DESERT: { name: "Desert", color: "#f4a460", baseTemp: 35, tempAmplitude: 12, moveCostMultiplier: 1.2 },
    TUNDRA: { name: "Tundra", color: "#add8e6", baseTemp: 5, tempAmplitude: 10, moveCostMultiplier: 1.3 },
};

class Environment {
    /**
     * Creates a new Environment instance.
     * @param {number} gWidth - The width of the grid.
     * @param {number} gHeight - The height of the grid.
     * @param {number} nodeDensity - The probability (0-1) for a cell to be a resource node (used in 'random' mode).
     * @param {string} placementMode - 'random', 'manual', or 'clustered'.
     * @param {Array<{x: number, y: number}>} [manuallyPlacedNodes=[]] - An array of node locations for 'manual' mode.
     */
    constructor(gWidth, gHeight, nodeDensity, placementMode, manuallyPlacedNodes = []) {
        this.width = gWidth;
        this.height = gHeight;
        // this.temperature = TEMP_BASE; // Remove global temperature property
        this.grid = []; // 2D array for cell data
        this.resourceNodes = []; // List of {x, y} coordinates for faster node updates

        console.log(`Initializing ${this.width}x${this.height} environment: mode=${placementMode}, density=${nodeDensity.toFixed(3)}`);

        let clusterCenters = [];
        if (placementMode === 'clustered') {
            clusterCenters = this._generateClusterCenters(NUM_CLUSTERS, MIN_CLUSTER_DISTANCE); // From config.js
            console.log(`Generated ${clusterCenters.length} cluster centers.`);
        }

        // Initialize grid cells with biomes
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                let isNode = false;
                // Determine if the cell is a resource node based on placement mode
                if (placementMode === 'clustered') {
                    for (const center of clusterCenters) {
                        // Check if the cell is within the radius of any cluster center
                        const distSq = (x - center.x)**2 + (y - center.y)**2;
                        if (distSq <= CLUSTER_RADIUS**2) { // From config.js
                            isNode = true;
                            break;
                        }
                    }
                } else if (placementMode === 'manual') {
                    // Check if the cell coordinates match any manually placed node
                    isNode = manuallyPlacedNodes.some(node => node.x === x && node.y === y);
                } else { // 'random' mode
                    isNode = Math.random() < nodeDensity;
                }

                // Determine biome based on quadrant
                let biome;
                if (x < this.width / 2 && y < this.height / 2) {
                    biome = BIOME_DEFINITIONS.TUNDRA; // Top-left
                } else if (x >= this.width / 2 && y < this.height / 2) {
                    biome = BIOME_DEFINITIONS.FOREST; // Top-right
                } else if (x < this.width / 2 && y >= this.height / 2) {
                    biome = BIOME_DEFINITIONS.PLAINS; // Bottom-left
                } else {
                    biome = BIOME_DEFINITIONS.DESERT; // Bottom-right
                }

                // Create the cell object
                this.grid[y][x] = {
                    resourceAmount: isNode ? NODE_INITIAL_RESOURCES : NON_NODE_INITIAL_RESOURCES,
                    isNode: isNode,
                    biomeName: biome.name,
                    color: biome.color,
                    baseTemp: biome.baseTemp, // Store biome base temp
                    tempAmplitude: biome.tempAmplitude, // Store biome amplitude
                    moveCostMultiplier: biome.moveCostMultiplier,
                    currentTemp: biome.baseTemp, // Initialize current temp to base temp
                };

                // Add to the list of nodes if it is one
                if (isNode) {
                    this.resourceNodes.push({ x, y });
                }
            }
        }
        console.log(`Initialized grid with ${this.resourceNodes.length} resource nodes.`);
    }

    /**
     * Generates random centers for resource clusters, ensuring minimum distance.
     * @param {number} numClusters - The desired number of clusters.
     * @param {number} minDistance - The minimum distance between cluster centers.
     * @returns {Array<{x: number, y: number}>} An array of cluster center coordinates.
     * @private
     */
    _generateClusterCenters(numClusters, minDistance) {
        const centers = [];
        const minDistanceSq = minDistance ** 2;
        let attempts = 0;
        const maxAttempts = numClusters * 150; // Increased attempts for denser packing

        while (centers.length < numClusters && attempts < maxAttempts) {
            attempts++;
            // Define a margin to keep clusters away from the very edge
            const margin = CLUSTER_RADIUS + 2; // From config.js
            // Ensure random coordinates are within the margins
            const cx = getRandomInt(margin, this.width - 1 - margin); // Use getRandomInt from utils.js
            const cy = getRandomInt(margin, this.height - 1 - margin); // Use getRandomInt from utils.js

            let tooClose = false;
            // Check distance against existing centers
            for (const existingCenter of centers) {
                const distSq = (cx - existingCenter.x)**2 + (cy - existingCenter.y)**2;
                if (distSq < minDistanceSq) {
                    tooClose = true;
                    break;
                }
            }

            // Add the center if it's not too close to others
            if (!tooClose) {
                centers.push({ x: cx, y: cy });
            }
        }

        if (centers.length < numClusters) {
            console.warn(`Could only generate ${centers.length}/${numClusters} cluster centers satisfying min distance ${minDistance}.`);
        }
        return centers;
    }

    /**
     * Gets the cell object at the specified coordinates.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @returns {object|null} The cell object or null if coordinates are out of bounds.
     */
    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null; // Out of bounds
        }
        return this.grid[y][x];
    }

    /**
     * Updates the environment state for one simulation tick.
     * Calculates the current temperature for each cell based on biome and global seasonal factor.
     * Replenishes resources in node cells.
     * @param {number} currentTick - The current simulation tick count.
     */
    update(currentTick) {
        // Calculate global seasonal factor (gentle sine wave)
        // Assumes GLOBAL_SEASONAL_AMPLITUDE and GLOBAL_SEASONAL_FREQUENCY are defined in config.js
        const globalSeasonalFactor = GLOBAL_SEASONAL_AMPLITUDE * Math.sin(currentTick * GLOBAL_SEASONAL_FREQUENCY);

        // Update temperature for each cell and replenish resources
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell) continue;

                // Calculate cell's current temperature
                // Simple model: Base + Global Seasonal + Biome Fluctuation (using global frequency for now)
                // Could use a biome-specific frequency later: Math.sin(currentTick * cell.biomeFrequency)
                const biomeFluctuation = cell.tempAmplitude * Math.sin(currentTick * GLOBAL_SEASONAL_FREQUENCY); // Re-use global freq for biome fluctuation for now
                cell.currentTemp = cell.baseTemp + globalSeasonalFactor + biomeFluctuation;

                // Replenish resources if it's a node
                if (cell.isNode) {
                    cell.resourceAmount = clamp(
                        cell.resourceAmount + NODE_REPLENISH_RATE,
                        0,
                        CELL_MAX_RESOURCES
                    );
                }
            }
        }
        // No longer need to update this.temperature
    }

    /**
     * Consumes a specified amount of resources from a cell.
     * @param {number} x - The x-coordinate of the cell.
     * @param {number} y - The y-coordinate of the cell.
     * @param {number} amount - The amount of resource to attempt to consume.
     * @returns {number} The actual amount of resource consumed.
     */
    consumeResourceAt(x, y, amount) {
        const cell = this.getCell(x, y);
        if (!cell) {
            return 0; // Cannot consume from non-existent cell
        }
        const consumed = Math.min(amount, cell.resourceAmount);
        cell.resourceAmount -= consumed;
        return consumed;
    }

    /**
     * Calculates the total amount of resources currently present in the grid.
     * @returns {number} The total resource amount.
     */
    getTotalResources() {
        let total = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                total += this.grid[y][x].resourceAmount;
            }
        }
        return total;
    }

    /**
     * Toggles the resource node status of a cell (used for manual placement).
     * Updates the cell's resource amount and the internal list of resource nodes.
     * @param {number} x - The x-coordinate of the cell.
     * @param {number} y - The y-coordinate of the cell.
     * @returns {boolean} True if the toggle was successful, false if coordinates were invalid.
     */
    toggleNode(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false; // Invalid coordinates
        }
        const cell = this.grid[y][x];
        cell.isNode = !cell.isNode; // Toggle status

        // Set resource amount based on new status
        cell.resourceAmount = cell.isNode ? NODE_INITIAL_RESOURCES : NON_NODE_INITIAL_RESOURCES; // From config.js

        // Update the resourceNodes list
        const nodeIndex = this.resourceNodes.findIndex(node => node.x === x && node.y === y);
        if (cell.isNode && nodeIndex === -1) {
            // Was not a node, now is: add to list
            this.resourceNodes.push({ x, y });
        } else if (!cell.isNode && nodeIndex !== -1) {
            // Was a node, now is not: remove from list
            this.resourceNodes.splice(nodeIndex, 1);
        }

        console.log(`Toggled node at (${x}, ${y}). New status: ${cell.isNode}. Total nodes: ${this.resourceNodes.length}`);
        return true;
    }

    /**
     * Returns a copy of the current list of resource node coordinates.
     * Used to preserve manually placed nodes when recreating the environment.
     * @returns {Array<{x: number, y: number}>} A copy of the resource node list.
     */
    getManuallyPlacedNodes() {
        // Return a shallow copy to prevent external modification of the internal list
        return [...this.resourceNodes];
    }
}