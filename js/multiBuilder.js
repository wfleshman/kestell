class MultiBuilder {
    constructor() {
        this.templates = [];
        this.selectedTemplates = [];
        this.loadTemplatesFromDB();
    }

    render(parent) {
        this.parent = parent;
        this.parent.classList.add('template-container');
        parent.innerHTML = ''; // Clear the parent container before rendering
        this.templates.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        this.templates.forEach((template, index) => {
            const templateDiv = document.createElement('div');
            templateDiv.classList.add('template');
            templateDiv.innerHTML = `
                <div class="template-header">
                    <div class="template-name" data-index="${index}">${template.name}</div>
                    <input type="number" class="quantity" data-index="${index}" value="1" min="1">
                    <button class="add-template-btn" data-index="${index}">Add</button>
                </div>
            `;
            parent.appendChild(templateDiv);
        });

        // Add event listeners for add template buttons
        document.querySelectorAll('.add-template-btn').forEach(button => {
            button.addEventListener('click', this.handleAddTemplate.bind(this));
        });

        // Add event listeners for quantity change
        document.querySelectorAll('.quantity').forEach(qty => {
            qty.addEventListener('input', this.handleQtyChange.bind(this));
        });
    }

    filterTemplates(query) {
        const filteredTemplates = this.templates.filter(template =>
            template.name.toLowerCase().includes(query.toLowerCase())
        );
        this.renderFilteredTemplates(filteredTemplates);
    }

    renderFilteredTemplates(templates) {
        this.parent.innerHTML = ''; // Clear the parent container before rendering
        templates.forEach(template => {
            const index = this.templates.findIndex(element => element.name == template.name);
            const templateDiv = document.createElement('div');
            templateDiv.classList.add('template');
            templateDiv.innerHTML = `
            <div class="template-header">
                <div class="template-name" data-index="${index}">${template.name}</div>
                <input type="number" class="quantity" data-index="${index}" value="1" min="1">
                <button class="add-template-btn" data-index="${index}">Add</button>
            </div>
            `;
            this.parent.appendChild(templateDiv);
        });
        // Add event listeners for add template buttons
        document.querySelectorAll('.add-template-btn').forEach(button => {
            button.addEventListener('click', this.handleAddTemplate.bind(this));
        });

        // Add event listeners for quantity change
        document.querySelectorAll('.quantity').forEach(qty => {
            qty.addEventListener('input', this.handleQtyChange.bind(this));
        });
    }

    handleAddTemplate(event) {
        const index = event.target.dataset.index;
        const template = this.templates[index];
        const qty = template.qty;
        if (qty > 0){
            this.selectedTemplates.push({ ...template, ...qty });
            this.renderSelectedTemplates();
        }
    }

    handleQtyChange(event) {
        const index = event.target.dataset.index;
        this.templates[index].qty = event.target.value;
    }

    renderSelectedTemplates() {
        const selectedContainer = document.getElementById('selected-templates-container');
        selectedContainer.innerHTML = ''; // Clear the container before rendering
        this.selectedTemplates.forEach((template, index) => {
            const templateDiv = document.createElement('div');
            templateDiv.classList.add('template');
            templateDiv.innerHTML = `
                <div class="template-header">
                    <div class="template-name">${template.name}</div>
                    <div class="template-qty">Quantity: ${template.qty}</div>
                    <button class="remove-selected-btn" data-index="${index}">Remove</button>
                </div>
            `;
            selectedContainer.appendChild(templateDiv);
        });

        // Add event listeners for remove selected buttons
        document.querySelectorAll('.remove-selected-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const index = event.target.dataset.index;
                this.selectedTemplates[index].qty = 1;
                this.selectedTemplates.splice(index, 1);
                this.renderSelectedTemplates();
            });
        });
    }

    loadTemplatesFromDB() {
        const transaction = db.transaction(["templates"]);
        const objectStore = transaction.objectStore("templates");
        const request = objectStore.getAll();

        request.onsuccess = () => {
            this.templates = request.result || [];
            this.render(document.getElementById('templates-container'));
            this.templates.forEach(template => {
                template.qty = 1;
            })
        };
    }

    handleBuild() {
        if (this.selectedTemplates.length == 0){
            alert("No templates selected for build!");
            return
        }
        let template = {'name': 'multi-build', 'qty': 1, 'shapes':[]};
        this.selectedTemplates.forEach((temp, idx) => {
            for(let i = 0; i < temp.qty; i++){
                template.shapes = template.shapes.concat(temp.shapes);
            }
        });
        localStorage.setItem('template-name', template.name);

        // Fetch the inventory data directly using a database transaction
        const transaction = db.transaction(["inventory"], "readonly");
        const objectStore = transaction.objectStore("inventory");
        const request = objectStore.getAll();

        request.onsuccess = () => {
            const inventory = request.result || [];

            // Call the performBinPacking function with the template and inventory data
            const sheets = performBinPacking(template, inventory);
            if (!sheets) {
                alert("Not enough inventory for this job!");
            }
            else {
                localStorage.setItem('sheets', JSON.stringify(sheets));
                window.location.href = 'build.html';
            }
        };

        request.onerror = () => {
            console.error("Error fetching inventory data from the database.");
        };
    }

    maxInventory() {
        // stuff to do while waiting
        let button = document.getElementById("max-inv-btn");
        button.disabled = true;
        button = document.getElementById("m-build-btn");
        button.disabled = true;
        let div = document.createElement('div');
        div.style = "position: fixed; z-index:1000; top:0; left:0; bottom:0; right:0; background:rgba(0,0,0,0.5); display:block"
        div.innerHTML = "";
        document.body.appendChild(div);
        this.selectedTemplates = [];
        function build(templates, inventory) {
            // combine templates
            let template = {'name': 'multi-build', 'qty': 1, 'shapes':[]};
            templates.forEach(temp => {
                template.shapes = template.shapes.concat(temp.shapes);
            });

            // pack the job
            const sheets = performBinPacking(template, inventory);
            if (!sheets) {
                return 0;
            }
            // compute ratio
            let total = 0;
            inventory.forEach(sheet => {
                total += (sheet.height * sheet.width);
            })

            let used = 0;
            sheets.forEach(sheet => {
                sheet.parts.forEach(part => {
                    if (part.height === 0){ // check circle
                        used += Math.PI * (part.width * part.width)/4;
                    } else{used += (part.height * part.width)}
                });
            });
            return used / total;
        };

        let best_templates = [];
        let best_score = -1;

        function explore(templates, inventory, available, startIndex){
            if (templates.length > 0){
                const score = build(templates, inventory);
                if (score === 0) {
                    return; // inventory is exhausted
                }
                if (score > best_score){
                    best_score = score;
                    best_templates = [...templates];
                }
            }
            if (templates.length === 5){
                return; // too many templates
            }
            available.forEach((template, idx) => {
                if (idx >= startIndex){
                    explore([...templates, template], inventory, available, idx);
                }
            });
        }

        // Fetch the inventory data directly using a database transaction
        const transaction = db.transaction(["inventory"], "readonly");
        const objectStore = transaction.objectStore("inventory");
        const request = objectStore.getAll();

        request.onsuccess = () => {
            const inventory = request.result || [];
            explore([], inventory, this.templates, 0);
            if(best_score > 0){
                // Create a Map to store object counts
                const countMap = new Map();
                    
                // Count occurrences
                for (const obj of best_templates) {
                    countMap.set(obj, (countMap.get(obj) || 0) + 1);
                }
                    
                // Convert to array of [object, count] pairs
                Array.from(countMap.entries()).forEach(pair => {
                    let template = pair[0];
                    template.qty = pair[1];
                    this.selectedTemplates.push(template);
                });
                this.renderSelectedTemplates();
            }
            else {
                alert("Not enough inventory!");
            }
            document.body.removeChild(div);
            let button = document.getElementById("max-inv-btn");
            button.disabled = false;
            button = document.getElementById("m-build-btn");
            button.disabled = false;
        }
    }
}