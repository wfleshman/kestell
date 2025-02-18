class InventoryTable {
    constructor() {
        this.template = document.createElement('template');
        this.template.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Width</th>
                        <th>Height</th>
                        <th>Qty</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Rows will be inserted here -->
                </tbody>
            </table>
        `;
        this.tbody = this.template.content.querySelector('tbody');
        this.data = [];
        this.loadInventoryFromDB();
    }

    render(parent) {
        this.parent = parent;
        this.updateTableInDOM();
    }

    updateTableInDOM() {
        this.renderRows();
        this.parent.innerHTML = ''; // Clear the parent container before rendering
        this.parent.appendChild(this.template.content.cloneNode(true));
        this.attachEventListeners(); // Ensure event listeners are attached
    }

    renderRows() {
        this.data.sort((a, b) => b.width - a.width || (b.height || 0) - (a.height || 0)); // Sort by width and height
        this.tbody.innerHTML = ''; // Clear existing rows
        this.data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.width}</td>
                <td>${item.height !== '' ? item.height : ''}</td>
                <td>
                    <button class="qty-btn" data-index="${index}" data-action="decrease">-</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn" data-index="${index}" data-action="increase">+</button>
                </td>
                <td><button class="remove-btn" data-index="${index}">Remove</button></td>
            `;
            this.tbody.appendChild(row);
        });
    }

    attachEventListeners() {
        // Add event listeners for quantity buttons
        this.parent.querySelectorAll('.qty-btn').forEach(button => {
            button.addEventListener('click', this.handleQuantityChange.bind(this));
        });

        // Add event listeners for remove buttons
        this.parent.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', this.handleRemoveItem.bind(this));
        });
    }

    handleQuantityChange(event) {
        const index = event.target.dataset.index;
        const action = event.target.dataset.action;
        if (action === 'increase') {
            this.data[index].qty += 1;
        } else if (action === 'decrease' && this.data[index].qty > 1) {
            this.data[index].qty -= 1;
        }
        this.updateTableInDOM();
        this.updateInventoryInDB();
    }

    handleRemoveItem(event) {
        const index = event.target.dataset.index;
        this.data.splice(index, 1);
        this.updateTableInDOM();
        this.updateInventoryInDB();
    }

    addItem(item) {
        this.addItemHidden(item);
        this.updateTableInDOM();
    }

    addItemHidden(item){
        const displayHeight = item.height !== '' ? item.height : '';
        const [width, height] = [item.width, displayHeight].sort((a, b) => b - a);

        // Check if an item with the same dimensions already exists
        const existingItem = this.data.find(existing => existing.width === width && existing.height === height);

        if (existingItem) {
            existingItem.qty += item.qty;
        } else {
            this.data.push({ width, height, qty: item.qty });
        }

        this.updateInventoryInDB();
    }

    removeItemHidden(item){
        const existingItem = this.data.find(existing => existing.width === item.width && existing.height === item.height);
        existingItem.qty -= item.qty;
        this.updateTableInDOM();
        this.updateInventoryInDB();
    }

    updateInventoryInDB() {
        const transaction = db.transaction(["inventory"], "readwrite");
        const objectStore = transaction.objectStore("inventory");
        objectStore.clear(); // Clear existing data
        this.data.forEach(item => {
            objectStore.add(item);
        });
    }

    loadInventoryFromDB() {
        const transaction = db.transaction(["inventory"]);
        const objectStore = transaction.objectStore("inventory");
        const request = objectStore.getAll();

        request.onsuccess = () => {
            this.data = request.result || [];
            this.updateTableInDOM();
        };
    }
}
