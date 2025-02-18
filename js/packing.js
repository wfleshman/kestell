// Function to perform bin packing using Python
function performBinPacking(template, inventory) {
    if (!pyodideReady) {
        console.error("Pyodide is not ready. Please wait for initialization to complete.");
        return;
    }

    // Run the bin packing algorithm in Python
    const packingResult = pyodide.runPython(`
        from rectpack import float2dec, newPacker, PackingBin, SORT_NONE

        template = ${JSON.stringify(template)}
        inventory = ${JSON.stringify(inventory)}
        
        def find_maximal_rectangles(sheet_width, sheet_height, placed_rectangles):
            """
            Find all maximal empty rectangles in the space around placed rectangles.
            
            Args:
                sheet_width: Width of the sheet (float)
                sheet_height: Height of the sheet (float)
                placed_rectangles: List of tuples (x, y, width, height) representing placed rectangles
                
            Returns:
                List of tuples (x, y, width, height) representing maximal empty rectangles
            """
            def is_point_empty(x, y):
                for rx, ry, rw, rh in placed_rectangles:
                    if rx <= x < rx + rw and ry <= y < ry + rh:
                        return False
                return True

            def get_max_width(x, y):
                """Find maximum width from point going right"""
                if x >= sheet_width:
                    return 0
                width = sheet_width - x
                for rx, ry, rw, rh in placed_rectangles:
                    if ry <= y < ry + rh and rx > x:
                        width = min(width, rx - x)
                return width

            def get_max_height(x, y, width):
                """Find maximum height for a given width"""
                if y >= sheet_height:
                    return 0
                height = sheet_height - y
                for rx, ry, rw, rh in placed_rectangles:
                    if rx < x + width and x < rx + rw and ry > y:
                        height = min(height, ry - y)
                return height

            # Generate all vertical and horizontal lines from rectangle boundaries
            x_coords = {0, sheet_width}
            y_coords = {0, sheet_height}
            
            for x, y, w, h in placed_rectangles:
                x_coords.update({x, x + w})
                y_coords.update({y, y + h})
            
            x_coords = sorted(list(x_coords))
            y_coords = sorted(list(y_coords))

            # Find all maximal rectangles
            maximal_rectangles = []
            seen_rectangles = set()  # To avoid duplicates

            for x in x_coords:
                for y in y_coords:
                    if not is_point_empty(x, y):
                        continue
                        
                    max_w = get_max_width(x, y)
                    if max_w <= 0:
                        continue
                        
                    h = get_max_height(x, y, max_w)
                    if h <= 0:
                        continue
                    
                    # Create rectangle with maximum possible dimensions
                    rect = (x, y, max_w, h)
                    
                    # Check if we've seen this rectangle before
                    rect_key = (x, y, max_w, h)
                    if rect_key in seen_rectangles:
                        continue
                        
                    seen_rectangles.add(rect_key)
                    
                    # Check if this rectangle is maximal
                    is_maximal = True
                    for mx, my, mw, mh in maximal_rectangles:
                        if (mx <= x and my <= y and 
                            mx + mw >= x + max_w and my + mh >= y + h):
                            is_maximal = False
                            break
                    
                    if is_maximal:
                        # Remove any existing rectangles that are contained within this one
                        maximal_rectangles = [r for r in maximal_rectangles 
                                            if not (x <= r[0] and y <= r[1] and 
                                                x + max_w >= r[0] + r[2] and 
                                                y + h >= r[1] + r[3])]
                        maximal_rectangles.append(rect)

            # Sort rectangles by area (largest first)
            return sorted(maximal_rectangles, key=lambda r: r[2] * r[3], reverse=True)

        def remove_overlapping_regions(rectangles):
            final_rectangles = []

            while rectangles:
                # Select the rectangle with the largest area
                largest_rectangle = max(rectangles, key=lambda r: r[2] * r[3])
                final_rectangles.append(largest_rectangle)

                # Remove the selected rectangle from the list
                rectangles.remove(largest_rectangle)

                # Remove overlapping regions from remaining rectangles
                remaining_rectangles = []
                for rect in rectangles:
                    remaining_rectangles.extend(subtract_rectangles(rect, largest_rectangle))

                rectangles = remaining_rectangles

            return final_rectangles

        def subtract_rectangles(rect1, rect2):
            # Unpack the rectangles
            x1, y1, w1, h1 = rect1
            x2, y2, w2, h2 = rect2

            # Calculate the coordinates of the right and top edges
            r1 = x1 + w1
            t1 = y1 + h1
            r2 = x2 + w2
            t2 = y2 + h2

            # Check if there is any overlap
            if x1 < r2 and x2 < r1 and y1 < t2 and y2 < t1:
                # There is overlap, calculate the new rectangles
                new_rectangles = []

                # Left of the overlap
                if x1 < x2:
                    new_rectangles.append((x1, y1, x2 - x1, h1))

                # Right of the overlap
                if r1 > r2:
                    new_rectangles.append((r2, y1, r1 - r2, h1))

                # Below the overlap
                if y1 < y2:
                    new_rectangles.append((max(x1, x2), y1, min(r1, r2) - max(x1, x2), y2 - y1))

                # Above the overlap
                if t1 > t2:
                    new_rectangles.append((max(x1, x2), t2, min(r1, r2) - max(x1, x2), t1 - t2))

                return new_rectangles
            else:
                # No overlap, return the original rectangle
                return [rect1]

        float_bins = [x for s in inventory for x in [(s['width'], s['height'])]*s['qty']]
        float_bins = sorted(float_bins, key=lambda x: x[0]*x[1])
        bins = [(float2dec(s[0], 3), float2dec(s[1],3)) for s in float_bins]

        float_rects = []
        float_circles = []
        for _ in range(int(template['qty'])):
            for shape in template['shapes']:
                if shape['type'] == 'rectangle':
                    float_rects.extend([(shape['width'], shape['height'])] * shape['qty'])
                else:
                    float_circles.extend([(shape['diameter'], shape['diameter'])] * shape['qty'])

        rectangles = [(float2dec(r[0], 3), float2dec(r[1], 3)) for r in float_rects+float_circles]

        packer = newPacker(bin_algo=PackingBin.Global, sort_algo=SORT_NONE)

        # Add the rectangles to packing queue (keep track of circles by rid)
        for i,r in enumerate(rectangles):
            packer.add_rect(*r, rid = 2*i if i < len(float_rects) else 2*i+1)

        # Add the bins where the rectangles will be placed
        for i,b in enumerate(bins):
            packer.add_bin(*b)

        # Start packing
        packer.pack()

        sheets = []
        for index, abin in enumerate(packer):
            bw, bh  = abin.width, abin.height
            sheet = {'width': float(bw), 'height': float(bh), 'parts': [], 'keeps': [], 'scraps': []}
            for rect in abin:
                x, y, w, h, id = rect.x, rect.y, rect.width, rect.height, rect.rid
                if id % 2 == 0:
                    sheet['parts'].append({'x': float(x), 'y': float(y), 'width': float(w), 'height': float(h)})
                else:
                    sheet['parts'].append({'x': float(x+w/2), 'y': float(y+h/2), 'width': float(w), 'height': 0})
                    sheet['scraps'].append({'x': float(x), 'y': float(y), 'width': float(w), 'height': float(h)})
        
            sheets.append(sheet)

        for i,sheet in enumerate(sheets):
            rects = [(shape['x'], shape['y'], shape['width'], shape['height']) for shape in sheet['parts']+sheet['scraps'] if shape['height'] != 0]
            remaining = remove_overlapping_regions(find_maximal_rectangles(sheet['width'], sheet['height'], rects))
            for (x,y,w,h) in remaining:
                shape = {'width':w, 'height':h, 'x':x, 'y':y}
                if min(w, h) >= 4.5 and max(w,h) >= 30:
                    sheets[i]['keeps'].append(shape)
                else:
                    sheets[i]['scraps'].append(shape)
        sheets
    `);
    const sheets = packingResult.toJs().map(map => Object.fromEntries(map));
    sheets.forEach((sheet, sheetIdx) => {
        sheets[sheetIdx].parts = sheet.parts.map(map => Object.fromEntries(map));
        sheets[sheetIdx].keeps = sheet.keeps.map(map => Object.fromEntries(map));
        sheets[sheetIdx].scraps = sheet.scraps.map(map => Object.fromEntries(map));
    });
    let total = 0;
    template.shapes.forEach(part => {
        total += (part.qty * template.qty);
    });
    let built = 0;
    sheets.forEach(sheet => {
        built += sheet.parts.length;
    });
    console.log(built);
    if (total === built) {
        return sheets;
    } else {return null;}
}