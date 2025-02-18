let pyodideReady = false;
let pyodide = null;

// Function to initialize Pyodide and load necessary libraries
async function initializePyodide() {
    // Load Pyodide
    pyodide = await loadPyodide();

    // Load any necessary Python packages
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('rectpack-0.2.2-py3-none-any.whl');
    await micropip.install('ezdxf==1.3.5')

    // Set the flag to indicate Pyodide is ready
    pyodideReady = true;
    // Enable the build buttons
    document.querySelectorAll('.build-btn').forEach(button => {
        button.disabled = false;
    });
    console.log("Pyodide initialized and ready.");
}

// Initialize Pyodide when the application starts
initializePyodide();
