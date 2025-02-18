function approveBuild() {
    // stuff to do while waiting
    let button = document.getElementById("approve-button");
    button.disabled = true;
    let div = document.createElement('div');
    div.style = "position: fixed; z-index:1000; top:0; left:0; bottom:0; right:0; background:rgba(0,0,0,0.5); display:block"
    div.innerHTML = "";
    document.body.appendChild(div);

    let buildDone = false;
    const transaction = db.transaction(["inventory"], "readwrite");
    const objectStore = transaction.objectStore("inventory");
    const request = objectStore.getAll();
    let dxfs = [];
    request.onsuccess = () => {
        let inventoryData = request.result || [];
        // get sheets
        let sheets = JSON.parse(localStorage.getItem('sheets'));
        sheets.forEach((sheet, sheetIdx) => {
            // create dfx file
            console.log("Running python...");
            const dxf = pyodide.runPython(`
                import ezdxf
                from ezdxf import units
                import io
                
                def add_rect(msp, layer, x, y, w ,h):
                    points = [(x,y),(x+w,y),(x+w,y+h),(x,y+h),(x,y)]
                    msp.add_lwpolyline(points, dxfattribs={"layer": layer, "linetype": 'CONTINUOUS', "lineweight": 35})
                    
                def add_circle(msp, layer, center, diameter):
                    msp.add_circle(center, radius=diameter/2, dxfattribs={"layer": layer, "linetype": 'CONTINUOUS', "lineweight": 35})
                
                def add_line(msp, layer, start, end):
                    msp.add_line(start, end, dxfattribs={"layer": layer, "linetype": 'CONTINUOUS', "lineweight": 35})
                
                doc = ezdxf.new('AC1021')
                doc.layers.add(name="Sheet", color=0)
                doc.layers.add(name="Remnants", color=47)
                doc.layers.add(name="Stock", color=4)
                doc.layers.add(name="Panels", color=5)
                doc.layers.add(name="Cuts", color=1)
                doc.units = units.IN

                msp = doc.modelspace()
                sheet = ${JSON.stringify(sheets)}[${sheetIdx}]
                add_rect(msp, "Sheet", 0, 0, sheet['width'], sheet['height'])
                cuts = set()
                for (shapes,layer) in [('parts','Panels'),('keeps','Stock'),('scraps','Remnants')]:
                    for part in sheet[shapes]:
                        if part['height'] == 0:
                            add_circle(msp, layer, (part['x'], part['y']), part['width'])
                            add_circle(msp, 'Cuts', (part['x'], part['y']), part['width'])
                        else:
                            add_rect(msp, layer, part['x'], part['y'], part['width'], part['height'])
                            path1 = (part['x'], part['y'], part['x']+part['width'], part['y'])
                            path2 = (part['x']+part['width'], part['y'], part['x']+part['width'], part['y']+part['height'])
                            path3 = (part['x'], part['y']+part['height'], part['x']+part['width'], part['y']+part['height'])
                            path4 = (part['x'], part['y'],part['x'], part['y']+part['height'])
                            for path in [path1, path2, path3, path4]:
                                # vertical path
                                if path[0] == path[2]:
                                    if path[0] != 0 and path[0] != sheet['width']:
                                        cuts.add(path)
                                elif path[1] != 0 and path[1] != sheet['height']:
                                        cuts.add(path)
                for cut in cuts:
                    add_line(msp, 'Cuts', (cut[0], cut[1]), (cut[2], cut[3]))
                
                out = io.StringIO()
                doc.write(out)
                content = out.getvalue()
                data = doc.encode(content)
                data
            `)
            dxfs.push(dxf.toJs());

            // add keeps to inventory
            sheet.keeps.forEach(shape => {
                // enforce width > height
                if (shape.height > shape.width){
                    let tmp = shape.height;
                    shape.height = shape.width;
                    shape.width = tmp;
                }
                let existingItem = inventoryData.find(existing => existing.width === shape.width && existing.height === shape.height);

                if (existingItem) {
                    existingItem.qty += 1;
                } else {
                    inventoryData.push({ 'width': shape.width, 'height': shape.height, 'qty': 1 });
                }
            });

            // remove sheet from inventory
            function check_existing(item){
                let existingItem = inventoryData.find(existing => existing.width === item.width && existing.height === item.height);
                return existingItem;
            }
            let idx = inventoryData.findIndex(check_existing);
            inventoryData[idx].qty -= 1;
            if (inventoryData[idx].qty === 0){
                inventoryData.splice(idx, 1);
            };
        });
        const transaction = db.transaction(["inventory"], "readwrite");
        const objectStore = transaction.objectStore("inventory");
        objectStore.clear(); // Clear existing data
        inventoryData.forEach(item => {
            objectStore.add(item);
        });
        localStorage.removeItem('sheets'); // clear storage
        buildDone = true;
        download_dxfs(dxfs);
    };
}

function download_dxfs(dxfs) {
    var zip = new JSZip();
    dxfs.forEach((dxf, idx) => {
        zip.file(idx+'.dxf', dxf);
    });
    zip.generateAsync({type:"blob"})
    .then(function(content) {
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let name = localStorage.getItem('template-name');
        if (name){
            a.download = name+'.zip'
        } else{a.download = 'dxfs.zip';}
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.location.href = 'index.html';
    });
}