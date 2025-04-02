// --- Core Simulation Parameters ---
const MAX_LIFESPAN = 400;
const REPRODUCTION_AGE = 70;
const REPRODUCTION_ENERGY_THRESHOLD = 90;
const ENERGY_COST_OF_REPRODUCTION = 45;
const INITIAL_ENERGY = 60;
const MAX_ENERGY = 120;
const BASE_ENERGY_COST_PER_TICK = 0.6;
const MOVEMENT_ENERGY_COST = 0.15;
const FOOD_ENERGY_VALUE = 30;
const FOOD_CONSUMPTION_RATE = 0.6; // Max resource units consumed per tick if available

// --- Genetics & Mutation ---
const INITIAL_GENE_VARIATION = 0.2; // Initial spread around average gene values
let MUTATION_RATE = 0.05; // Default mutation rate (percentage/100), updated by UI
const MUTATION_AMOUNT = 0.05; // Max +/- change during mutation

// --- Environment: Temperature ---
const TEMP_BASE = 25.0; // Average temperature
const TEMP_AMPLITUDE = 15.0; // Fluctuation range (+/- TEMP_BASE)
const TEMP_FREQUENCY = 0.001; // Speed of temperature cycle
const TEMP_PENALTY_FACTOR = 0.03; // Multiplier for energy cost based on temp difference

// --- Environment: Resources & Grid ---
const CELL_MAX_RESOURCES = 15.0; // Max resources a single cell can hold
let RESOURCE_NODE_DENSITY = 0.05; // Default density (percentage/100), updated by UI
const NODE_REPLENISH_RATE = 0.25; // Resources added per tick to a node
const NODE_INITIAL_RESOURCES = 7.0; // Starting resources for a node cell
const NON_NODE_INITIAL_RESOURCES = 1.0; // Starting resources for a non-node cell
const MATING_SEARCH_RADIUS = 2; // How many cells away an organism looks for a mate

// --- Environment: Resource Node Placement ---
const NUM_CLUSTERS = 4; // Number of resource clusters in 'clustered' mode
const CLUSTER_RADIUS = 12; // Radius of each cluster
const MIN_CLUSTER_DISTANCE = 35; // Minimum distance between cluster centers

// --- Allele Tracking (Temperature) ---
const ALLELE_TEMP_BINS = {
    'Cold': (val) => val < TEMP_BASE - TEMP_AMPLITUDE / 2,
    'Mid': (val) => val >= TEMP_BASE - TEMP_AMPLITUDE / 2 && val <= TEMP_BASE + TEMP_AMPLITUDE / 2,
    'Warm': (val) => val > TEMP_BASE + TEMP_AMPLITUDE / 2
};

// --- UI & Display ---
let CELL_SIZE = 5; // Default cell size in pixels, updated by UI
const MAX_HISTORY = 600; // Max data points for charts

// --- Simulation State Variables (Defaults, updated by UI/Simulation) ---
let initialPopulationNum = 100; // Default, calculated from density later
let maxPopulation = 5000; // Default, updated by UI
let gridWidth = 100; // Default, updated by UI
let gridHeight = 100; // Default, updated by UI
let resourcePlacementMode = 'random'; // 'random', 'manual', 'clustered'

// --- Default UI Settings ---
const DEFAULT_SETTINGS = {
    popDensity: 1.0, // Percentage
    nodeDensity: 5.0, // Percentage
    avgMetabolism: 1.0,
    avgFeeding: 1.0,
    avgTempTolerance: 25,
    mutationRate: 5.0, // Percentage
    maxPopulation: 5000,
    gridWidth: 100,
    gridHeight: 100,
    tickSpeed: 50, // ms
    cellSize: 5 // px
};

// Note: 'currentInitialSettings' will be managed within the UI/Simulation logic,
// initialized using DEFAULT_SETTINGS.