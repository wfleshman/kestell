function drawLayoutOnCanvas() {
    const canvas = document.getElementById('layout-canvas');
    const ctx = canvas.getContext('2d');

    // Retrieve sheets from localStorage
    let sheets = JSON.parse(localStorage.getItem('sheets'));

    if (!sheets) {
        console.error("No sheets data found in localStorage.");
        return;
    }

    // Define colors for parts, scraps, and keeps
    const colors = {
        parts: 'lightblue',
        scraps: 'lightcoral',
        keeps: 'lightgreen'
    };

    // Determine the maximum sheet dimension
    let maxDimension = 0;
    sheets.forEach(sheet => {
        maxDimension = Math.max(maxDimension, sheet.width, sheet.height);
    });

    // Calculate scaling factors
    const scale = (canvas.width - 200) / maxDimension; // Subtract space for legend

    // Calculate the total height needed for the canvas
    let totalHeight = 0;
    sheets.forEach(sheet => {
        totalHeight += sheet.height * scale + 50; // Increased spacing between sheets
    });

    // Set the canvas height dynamically
    canvas.height = totalHeight;
    canvas.style.height = totalHeight + 'px'; // Update CSS height

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Function to draw and label shapes
    function drawAndLabelShapes(shapes, color, labelInside) {
        ctx.fillStyle = color;
        shapes.forEach(shape => {
            const x = 10 + shape.x * scale;
            const y = 10 + currentCumulativeHeight + shape.y * scale;
            const width = shape.width * scale;
            const height = shape.height * scale;

            if (shape.height === 0) {
                // Draw a circle
                const radius = width / 2;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();

                // Draw the label inside the circle if it's large enough
                if (labelInside) { 
                    ctx.fillStyle = '#000000'; // Use a contrasting color for text
                    ctx.font = '12px Arial'; // Set a fixed font size
                    const label = `${shape.width.toFixed(2)}"`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, x, y);
                    ctx.fillStyle = color;  // reset to color
                }
            } else {
                // Draw the rectangle
                ctx.fillRect(x, y, width, height);
                ctx.strokeRect(x, y, width, height);

                // Draw the label inside the shape if it's large enough
                if (labelInside) {
                    ctx.fillStyle = '#000000'; // Use a contrasting color for text
                    ctx.font = '12px Arial'; // Set a fixed font size
                    const label = `${Math.max(shape.width, shape.height).toFixed(2)}" x ${Math.min(shape.height, shape.width).toFixed(2)}"`;
                    const textX = x + width / 2;
                    const textY = y + height / 2;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    if (width > height) {
                        ctx.fillText(label, textX, textY);
                    }
                    else{
                        ctx.save();
                        ctx.translate(textX, textY);
                        ctx.rotate(Math.PI / 2);
                        ctx.translate(-textX, -textY);
                        ctx.fillText(label, textX, textY);
                        ctx.restore();
                    }
                    ctx.fillStyle = color;  // reset to color
                }
            }
        });
    }

    // Draw each sheet
    let currentCumulativeHeight = 0;
    sheets.forEach((sheet, sheetIndex) => {
        // Draw sheet background (optional)
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(10, 10 + currentCumulativeHeight, sheet.width * scale, sheet.height * scale);
        ctx.strokeRect(10, 10 + currentCumulativeHeight, sheet.width * scale, sheet.height * scale);

        // Add a label to each sheet for its width and height at the bottom right corner
        ctx.fillStyle = '#000000'; // Use a contrasting color for text
        ctx.font = '16px Arial'; // Set a fixed font size
        const sheetLabel = `${sheet.width.toFixed(2)}" x ${sheet.height.toFixed(2)}"`;
        const labelX = 10 + sheet.width * scale; // Align left edge of text with right edge of sheet
        const labelY = 10 + currentCumulativeHeight + sheet.height * scale; // Align bottom of text with bottom of sheet
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(sheetLabel, labelX, labelY);

        // Draw scraps without labels inside
        drawAndLabelShapes(sheet.scraps, colors.scraps, false);

        // Draw and label parts with labels inside
        drawAndLabelShapes(sheet.parts, colors.parts, true);

        // Draw and label keeps (Stock) with labels inside
        drawAndLabelShapes(sheet.keeps, colors.keeps, true);

        // Draw a dashed line between sheets
        if (sheetIndex < sheets.length - 1) {
            ctx.setLineDash([5, 5]); // Set line dash pattern
            ctx.beginPath();
            ctx.moveTo(10, 10 + currentCumulativeHeight + sheet.height * scale + 20);
            ctx.lineTo(canvas.width - 190, 10 + currentCumulativeHeight + sheet.height * scale + 20);
            ctx.strokeStyle = '#000000'; // Black dashed line
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
        }

        // Update the cumulative height for the next sheet
        currentCumulativeHeight += sheet.height * scale + 50; // Increased spacing between sheets
    });

    // Draw the legend
    drawLegend(canvas, ctx, colors);
}

function handleCanvasClick(event) {
    const canvas = document.getElementById('layout-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if any shape was clicked
    let shapeToggled = false;
    let sheets = JSON.parse(localStorage.getItem('sheets'));

    // Determine the maximum sheet dimension
    let maxDimension = 0;
    sheets.forEach(sheet => {
        maxDimension = Math.max(maxDimension, sheet.width, sheet.height);
    });

    // Calculate scaling factors
    const scale = (canvas.width - 200) / maxDimension; // Subtract space for legend

    sheets.forEach((sheet, sheetIndex) => {
        if (!shapeToggled) {
            // Calculate cumulative height for the current sheet
            let sheetCumulativeHeight = 0;
            for (let i = 0; i < sheetIndex; i++) {
                sheetCumulativeHeight += sheets[i].height * scale + 50; // Increased spacing
            }

            // Helper function to check and toggle shape category
            function toggleShapeCategory(shapesArray, targetArray) {
                shapesArray.forEach((shape, index) => {
                    const shapeX = 10 + shape.x * scale;
                    const shapeY = 10 + sheetCumulativeHeight + shape.y * scale;
                    const shapeWidth = shape.width * scale;
                    const shapeHeight = shape.height * scale;

                    if (shape.height === 0) {
                        // Check for circle click
                        const radius = shapeWidth / 2;
                        const centerX = shapeX + radius;
                        const centerY = shapeY + radius;
                        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

                        if (distance <= radius) {
                            // Move shape to the target array
                            targetArray.push(shape);
                            shapesArray.splice(index, 1);

                            // Update localStorage with the modified sheets data
                            localStorage.setItem('sheets', JSON.stringify(sheets));

                            // Redraw the canvas
                            drawLayoutOnCanvas();
                            shapeToggled = true; // Set flag to stop further processing
                        }
                    } else if (x >= shapeX && x <= shapeX + shapeWidth &&
                               y >= shapeY && y <= shapeY + shapeHeight) {
                        // Move shape to the target array
                        targetArray.push(shape);
                        shapesArray.splice(index, 1);

                        // Update localStorage with the modified sheets data
                        localStorage.setItem('sheets', JSON.stringify(sheets));

                        // Redraw the canvas
                        drawLayoutOnCanvas();
                        shapeToggled = true; // Set flag to stop further processing
                    }
                });
            }

            // Toggle between parts, stock, and scrap
            toggleShapeCategory(sheet.parts, sheet.keeps);
            if (shapeToggled) return; // Stop further processing if a shape was toggled
            toggleShapeCategory(sheet.keeps, sheet.scraps);
            if (shapeToggled) return; // Stop further processing if a shape was toggled
            toggleShapeCategory(sheet.scraps, sheet.parts);
        }
    });
}

function drawLegend(canvas, ctx, colors) {
    const legendX = canvas.width - 180; // Position the legend on the right side
    const legendY = 20;
    const boxSize = 20;
    const lineHeight = 30;

    // Define legend items
    const legendItems = [
        { label: 'Parts', color: colors.parts },
        { label: 'Stock', color: colors.keeps }, // Updated to "Stock"
        { label: 'Scrap', color: colors.scraps } // Updated to "Scrap"
    ];

    // Draw legend
    ctx.textAlign = 'left';
    ctx.font = '16px Arial';
    legendItems.forEach((item, index) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY + index * lineHeight, boxSize, boxSize);
        ctx.strokeRect(legendX, legendY + index * lineHeight, boxSize, boxSize);

        ctx.fillStyle = '#000';
        ctx.fillText(item.label, legendX + boxSize + 10, legendY + index * lineHeight + boxSize - 5);
    });
}