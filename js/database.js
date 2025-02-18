let db;

function openDatabase() {
    const request = indexedDB.open("KIMSDatabase", 1);

    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("inventory")) {
            db.createObjectStore("inventory", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("templates")) {
            db.createObjectStore("templates", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        checkAndPopulateDatabase();
        console.log("Database opened successfully");
    };

    request.onerror = function(event) {
        console.error("Database error:", event.target.errorCode);
    };
}

function checkAndPopulateDatabase() {
    const transaction = db.transaction(["inventory", "templates"], "readwrite");
    const inventoryStore = transaction.objectStore("inventory");
    const templatesStore = transaction.objectStore("templates");

    const inventoryCountRequest = inventoryStore.count();
    const templatesCountRequest = templatesStore.count();

    inventoryCountRequest.onsuccess = function() {
        if (inventoryCountRequest.result === 0) {
            // populateInventory(inventoryStore);
        }
    };

    templatesCountRequest.onsuccess = function() {
        if (templatesCountRequest.result === 0) {
            // populateTemplates(templatesStore);
        }
    };

    transaction.oncomplete = function() {
        dbReady = true;
    };
}


function exportDB() {
    const transaction = db.transaction(["inventory", "templates"], "readonly");
    const inventoryStore = transaction.objectStore("inventory");
    const templatesStore = transaction.objectStore("templates");

    const inventoryRequest = inventoryStore.getAll();
    const templatesRequest = templatesStore.getAll();

    Promise.all([
        new Promise(resolve => inventoryRequest.onsuccess = () => resolve(inventoryRequest.result)),
        new Promise(resolve => templatesRequest.onsuccess = () => resolve(templatesRequest.result))
    ]).then(results => {
        const [inventoryData, templatesData] = results;

        const data = {
            inventory: inventoryData,
            templates: templatesData
        };

        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date();
        let day = date.getDate();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();
        let currentDate = `${month}-${day}-${year}-`;
        a.download = currentDate+'kims_db.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

// Call the function to open the database
openDatabase();
