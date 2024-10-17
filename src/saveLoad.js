// Funzione per salvare il progetto
export function saveProject(
    roomParams,
    ledStrips,
    beatSequence,
    tempoParams,
    configParams
) {
    const projectData = {
        roomParams: {
            width: roomParams.width,
            height: roomParams.height,
            depth: roomParams.depth,
        },
        ledStrips: ledStrips.map((stripObj) => ({
            position: stripObj.mesh.position.clone(),
            rotationY: stripObj.mesh.rotation.y,
            length: stripObj.mesh.userData.length,
            color: "#" + stripObj.mesh.material.color.getHexString(),
            name: stripObj.mesh.userData.name,
        })),
        beatSequence: beatSequence,
        tempoParams: {
            tempo: tempoParams.tempo,
        },
        configParams: {
            glareIntensity: configParams.glareIntensity,
            roomBrightness: configParams.roomBrightness,
            ledPower: configParams.ledPower,
        },
    };

    const json = JSON.stringify(projectData);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "project.vik";
    a.click();
    URL.revokeObjectURL(url);
}

// Funzione per caricare il progetto
export function loadProject(
    event,
    scene,
    roomParams,
    ledStrips,
    beatSequence,
    tempoParams,
    configParams,
    updateBeatGrid,
    tempoFolder,
    configFolder
) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const json = e.target.result;
        const projectData = JSON.parse(json);

        // Carica roomParams
        if (projectData.roomParams) {
            roomParams.width = projectData.roomParams.width || roomParams.width;
            roomParams.height =
                projectData.roomParams.height || roomParams.height;
            roomParams.depth = projectData.roomParams.depth || roomParams.depth;
            roomParams.creaStanza();
        }

        // Rimuovi le strisce LED esistenti
        ledStrips.forEach((stripObj) => {
            scene.remove(stripObj.mesh);
        });
        ledStrips.length = 0;
        beatSequence.length = 0;

        // Carica le strisce LED
        if (projectData.ledStrips) {
            projectData.ledStrips.forEach((stripData, index) => {
                const geometry = new THREE.BoxGeometry(
                    stripData.length,
                    0.1,
                    0.1
                );
                const material = new THREE.MeshStandardMaterial({
                    color: stripData.color,
                    emissive: new THREE.Color(stripData.color),
                    emissiveIntensity: 0, // Inizialmente spenta
                });
                const strip = new THREE.Mesh(geometry, material);
                strip.position.copy(stripData.position);
                strip.rotation.y = stripData.rotationY;
                strip.userData.originalColor = new THREE.Color(stripData.color);
                strip.userData.offColor = new THREE.Color(0x000000);
                strip.userData.length = stripData.length;
                strip.userData.name = stripData.name || `Striscia ${index + 1}`;
                strip.castShadow = true;
                strip.receiveShadow = true;

                // Crea una RectAreaLight per la striscia
                const rectLight = new THREE.RectAreaLight(
                    stripData.color,
                    0, // Intensità impostata a 0
                    stripData.length,
                    0.1
                );
                rectLight.position.set(0, 0, 0);
                rectLight.rotation.y = Math.PI + strip.rotation.y;
                rectLight.lookAt(new THREE.Vector3(0, 0, 1));
                strip.add(rectLight);
                strip.userData.light = rectLight;
                strip.userData.isActive = false; // Per tracciare se la striscia è attiva

                scene.add(strip);
                ledStrips.push({ mesh: strip, color: stripData.color });
            });
        }

        // Carica la beatSequence
        if (projectData.beatSequence) {
            projectData.beatSequence.forEach((sequence) => {
                beatSequence.push(sequence);
            });
        }

        // Carica tempoParams
        if (projectData.tempoParams) {
            tempoParams.tempo =
                projectData.tempoParams.tempo || tempoParams.tempo;
            tempoFolder.__controllers.forEach((controller) => {
                if (controller.property === "tempo") {
                    controller.setValue(tempoParams.tempo);
                }
            });
        }

        // Carica configParams
        if (projectData.configParams) {
            configParams.glareIntensity =
                projectData.configParams.glareIntensity ||
                configParams.glareIntensity;
            configParams.roomBrightness =
                projectData.configParams.roomBrightness ||
                configParams.roomBrightness;
            configParams.ledPower =
                projectData.configParams.ledPower || configParams.ledPower;

            // Aggiorna i controller di configFolder
            configFolder.__folders["Configurazioni"].__controllers.forEach(
                (controller) => {
                    switch (controller.property) {
                        case "glareIntensity":
                            controller.setValue(configParams.glareIntensity);
                            break;
                        case "roomBrightness":
                            controller.setValue(configParams.roomBrightness);
                            break;
                        case "ledPower":
                            controller.setValue(configParams.ledPower);
                            break;
                    }
                }
            );
        }

        // Aggiorna il beat grid
        updateBeatGrid();
    };

    reader.readAsText(file);
}
