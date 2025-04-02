/**
 * Main entry point for the EvoSim application.
 * Initializes the simulation and UI after the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing application...");

    // --- Get Essential Elements ---
    const canvas = document.getElementById('simulationCanvas');
    if (!canvas) {
        console.error("FATAL: Canvas element 'simulationCanvas' not found. Aborting.");
        alert("Error: Simulation canvas could not be found. Please check the HTML structure.");
        return;
    }

    // --- Initial Configuration ---
    // Start with default settings from config.js
    // The UI manager will read initial values from sliders/inputs later if needed,
    // but the simulation needs a starting point.
    const initialConfig = { ...DEFAULT_SETTINGS };

    // --- Create Core Instances ---
    let simulation;
    let uiManager;

    try {
        // 1. Create Simulation instance
        simulation = new Simulation(initialConfig, canvas);

        // 2. Create UI Manager instance
        uiManager = new UIManager(simulation);

        // 3. Connect UI Manager to Simulation
        simulation.setUIManager(uiManager);

        // 4. Initialize UI (attaches listeners, sets initial states)
        uiManager.initializeUI();

        // 5. Perform Initial Simulation Reset
        // This uses the config values currently held by the simulation,
        // which should match DEFAULT_SETTINGS at this point.
        // It creates the initial environment, population, and draws the first frame.
        simulation.reset();

        console.log("EvoSim Initialization Sequence Complete.");

    } catch (error) {
        console.error("FATAL ERROR during initialization:", error);
        alert(`An error occurred during simulation setup: ${error.message}`);
        // Optionally disable UI elements or show a persistent error message
        document.body.innerHTML = `<div style="color: red; padding: 20px;">
            <h1>Initialization Failed</h1>
            <p>Could not set up the simulation environment.</p>
            <pre>${error.stack || error}</pre>
            </div>`;
    }
});