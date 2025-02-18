class JobTemplates {
    constructor() {
        this.templates = [];
        this.loadTemplatesFromDB();
    }

    render(parent) {
        this.parent = parent;
        this.templates.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        parent.innerHTML = ''; // Clear the parent container before rendering
        this.templates.forEach((template, index) => {
            const templateDiv = document.createElement('div');
            templateDiv.classList.add('template');
            if (!template.qty){
                template.qty = 1;
            }
            templateDiv.innerHTML = `
                <div class="template-header">
                    <div class="template-name" data-index="${index}">${template.name}</div>
                    <input type="number" class="quantity" data-index="${index}" value=${template.qty} min="1">
                    <button class="build-btn" data-index="${index}" disabled>Build</button>
                    <button class="remove-template-btn" data-index="${index}">Remove</button>
                </div>
                <div class="template-details-wrapper">
                    <div class="template-details hidden" data-index="${index}">
                        ${this.renderShapesTable(template.shapes, index)}
                        <div class="add-part-controls">
                            <input type="number" step="0.01" class="part-width-input" placeholder="Width">
                            <input type="number" step="0.01" class="part-height-input" placeholder="Height">
                            <input type="number" class="part-qty-input" placeholder="Quantity">
                            <button class="add-part-btn" data-index="${index}">Add Part</button>
                        </div>
                    </div>
                </div>
            `;
            parent.appendChild(templateDiv);
            this.updateTemplatesInDB();
        });

        // Add event listeners for template names
        document.querySelectorAll('.template-name').forEach(nameElem => {
            nameElem.addEventListener('click', this.toggleDetails.bind(this));
        });

        // Add event listeners for add part buttons
        document.querySelectorAll('.add-part-btn').forEach(button => {
            button.addEventListener('click', this.handleAddPart.bind(this));
        });

        // Add event listeners for remove part buttons
        document.querySelectorAll('.remove-part-btn').forEach(button => {
            button.addEventListener('click', this.removePart.bind(this));
        });

        // Add event listeners for build buttons
        document.querySelectorAll('.build-btn').forEach(button => {
            button.addEventListener('click', this.handleBuild.bind(this));
        });

        // Add event listeners for remove template buttons
        document.querySelectorAll('.remove-template-btn').forEach(button => {
            button.addEventListener('click', this.removeTemplate.bind(this));
        });

        // Add event listeners for quantity change
        document.querySelectorAll('.quantity').forEach(qty => {
            qty.addEventListener('input', this.handleQtyChange.bind(this));
        });
    }

    renderShapesTable(shapes, templateIndex) {
        shapes.sort((a, b) => {
            const widthA = a.width || a.diameter;
            const widthB = b.width || b.diameter;
            const heightA = a.height || 0;
            const heightB = b.height || 0;
            return widthB - widthA || heightB - heightA;
        });

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Width (Diameter)</th>
                    <th>Height</th>
                    <th>Qty</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${shapes.map((shape, shapeIndex) => {
                    const width = shape.type === 'circle' ? shape.diameter : Math.max(shape.width, shape.height);
                    const height = shape.type === 'circle' ? '' : Math.min(shape.width, shape.height);
                    return `
                        <tr>
                            <td>${width}</td>
                            <td>${height}</td>
                            <td>${shape.qty}</td>
                            <td><button class="remove-part-btn" data-template-index="${templateIndex}" data-shape-index="${shapeIndex}">Remove</button></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        return table.outerHTML;
    }

    toggleDetails(event) {
        const index = event.target.dataset.index;
        const details = document.querySelectorAll('.template-details');
        details.forEach((detail, i) => {
            if (i == index) {
                detail.classList.toggle('hidden');
            } else {
                detail.classList.add('hidden');
            }
        });
    }

    addTemplate(name) {
        if (this.templates.some(template => template.name === name)) {
            alert('Template name must be unique.');
            return;
        }
        const template = { name, shapes: [] };
        this.templates.push(template);
        this.updateTemplatesInDB();
        this.render(this.parent);
        
        // Enable or disable all build buttons based on Pyodide initialization status
        document.querySelectorAll('.build-btn').forEach(button => {
        button.disabled = !pyodideReady; // Enable if Pyodide is ready
        });
    }

    handleAddPart(event) {
        const index = event.target.dataset.index;
        const template = this.templates[index];

        const widthInput = event.target.parentElement.querySelector('.part-width-input');
        const heightInput = event.target.parentElement.querySelector('.part-height-input');
        const qtyInput = event.target.parentElement.querySelector('.part-qty-input');

        const width = parseFloat(widthInput.value);
        const height = parseFloat(heightInput.value);
        const qty = parseInt(qtyInput.value, 10);

        if (isNaN(width) || width <= 0 || isNaN(qty) || qty <= 0) {
            alert('Please enter valid positive numbers for width and quantity.');
            return;
        }

        let displayWidth, displayHeight;
        if (!isNaN(height) && height >= width) {
            displayWidth = height;
            displayHeight = width;
        } else if (!isNaN(height)) {
            displayWidth = width;
            displayHeight = height;
        } else {
            displayWidth = width;
            displayHeight = null;
        }

        const shape = displayHeight ?
            { type: 'rectangle', width: displayWidth, height: displayHeight, qty } :
            { type: 'circle', diameter: displayWidth, qty };

        // Check if a part with the same dimensions and shape type already exists
        const existingShape = template.shapes.find(existing =>
            existing.width === shape.width &&
            existing.height === shape.height
        );

        if (existingShape) {
            existingShape.qty += shape.qty;
        } else {
            template.shapes.push(shape);
        }

        this.renderTemplate(index); // Refresh only the specific template
        this.updateTemplatesInDB();

        // Clear input fields
        widthInput.value = '';
        heightInput.value = '';
        qtyInput.value = '';
    }

    removePart(event) {
        const templateIndex = event.target.dataset.templateIndex;
        const shapeIndex = event.target.dataset.shapeIndex;
        this.templates[templateIndex].shapes.splice(shapeIndex, 1);
        this.renderTemplate(templateIndex); // Refresh only the specific template
        this.updateTemplatesInDB();
    }

    handleQtyChange(event) {
        this.templates[event.target.dataset.index].qty = event.target.value;
        this.updateTemplatesInDB();
    }

    handleBuild(event) {
        const index = event.target.dataset.index;
        const template = this.templates[index];
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

    removeTemplate(event) {
        const index = event.target.dataset.index;
        this.templates.splice(index, 1);
        this.updateTemplatesInDB();
        this.render(this.parent);
        document.querySelectorAll('.build-btn').forEach(button => {
            button.disabled = !pyodideReady; // Enable if Pyodide is ready
        });
    }

    renderTemplate(index) {
        const template = this.templates[index];
        const templateDetails = document.querySelector(`.template-details[data-index='${index}']`);
        if (templateDetails) {
            templateDetails.innerHTML = `
                ${this.renderShapesTable(template.shapes, index)}
                <div class="add-part-controls">
                    <input type="number" step="0.01" class="part-width-input" placeholder="Width">
                    <input type="number" step="0.01" class="part-height-input" placeholder="Height">
                    <input type="number" class="part-qty-input" placeholder="Quantity">
                    <button class="add-part-btn" data-index="${index}">Add Part</button>
                </div>
            `;

            // Re-attach event listeners for the new elements
            templateDetails.querySelectorAll('.add-part-btn').forEach(button => {
                button.addEventListener('click', this.handleAddPart.bind(this));
            });

            templateDetails.querySelectorAll('.remove-part-btn').forEach(button => {
                button.addEventListener('click', this.removePart.bind(this));
            });
        }
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
                    <input type="number" class="quantity" data-index="${index}" value=${template.qty} min="1">
                    <button class="build-btn" data-index="${index}">Build</button>
                    <button class="remove-template-btn" data-index="${index}">Remove</button>
                </div>
                <div class="template-details-wrapper">
                    <div class="template-details hidden" data-index="${index}">
                        ${this.renderShapesTable(template.shapes, index)}
                        <div class="add-part-controls">
                            <input type="number" step="0.01" class="part-width-input" placeholder="Width">
                            <input type="number" step="0.01" class="part-height-input" placeholder="Height">
                            <input type="number" class="part-qty-input" placeholder="Quantity">
                            <button class="add-part-btn" data-index="${index}">Add Part</button>
                        </div>
                    </div>
                </div>
            `;
            this.parent.appendChild(templateDiv);
        });

        // Add event listeners for template names
        document.querySelectorAll('.template-name').forEach(nameElem => {
            nameElem.addEventListener('click', this.toggleDetails.bind(this));
        });

        // Add event listeners for add part buttons
        document.querySelectorAll('.add-part-btn').forEach(button => {
            button.addEventListener('click', this.handleAddPart.bind(this));
        });

        // Add event listeners for remove part buttons
        document.querySelectorAll('.remove-part-btn').forEach(button => {
            button.addEventListener('click', this.removePart.bind(this));
        });

        // Add event listeners for build buttons
        document.querySelectorAll('.build-btn').forEach(button => {
            button.addEventListener('click', this.handleBuild.bind(this));
        });

        // Add event listeners for remove template buttons
        document.querySelectorAll('.remove-template-btn').forEach(button => {
            button.addEventListener('click', this.removeTemplate.bind(this));
        });
        
        // Add event listeners for quantity change
        document.querySelectorAll('.quantity').forEach(qty => {
            qty.addEventListener('input', this.handleQtyChange.bind(this));
        });
    }

    updateTemplatesInDB() {
        const transaction = db.transaction(["templates"], "readwrite");
        const objectStore = transaction.objectStore("templates");
        objectStore.clear(); // Clear existing data
        this.templates.forEach(template => {
            objectStore.add(template);
        });
    }

    loadTemplatesFromDB() {
        const transaction = db.transaction(["templates"]);
        const objectStore = transaction.objectStore("templates");
        const request = objectStore.getAll();

        request.onsuccess = () => {
            this.templates = request.result || [];
            this.render(this.parent);
        };
    }
}
