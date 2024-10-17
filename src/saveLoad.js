import * as THREE from "three";

export function saveProject(roomParams, ledStrips, beatSequence, tempoParams) {
    const projectData = {
        roomParams: {
            width: roomParams.width,
            height: roomParams.height,
            depth: roomParams.depth,
        },
        ledStrips: ledStrips.map(function (stripObj) {
            return {
                position: {
                    x: stripObj.mesh.position.x,
                    y: stripObj.mesh.position.y,
                    z: stripObj.mesh.position.z,
                },
                rotationY: stripObj.mesh.rotation.y,
                length: stripObj.mesh.userData.length,
                color:
                    "#" + stripObj.mesh.userData.originalColor.getHexString(), // Original color
            };
        }),
        beatSequence: beatSequence, // Save the beat sequence
        tempo: tempoParams.tempo, // Save BPM
    };

    const json = JSON.stringify(projectData);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = "progetto.vik";
    link.href = url;
    link.click();

    // Release the object URL after download
    URL.revokeObjectURL(url);
}

export function loadProject(
    event,
    scene,
    roomParams,
    room,
    roomEdges,
    ledStrips,
    beatSequence,
    tempoParams,
    updateBeatGrid,
    tempoFolder
) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const json = e.target.result;
        const projectData = JSON.parse(json);

        // Remove existing elements
        if (room) scene.remove(room);
        if (roomEdges) scene.remove(roomEdges);
        ledStrips.forEach(function (stripObj) {
            scene.remove(stripObj.mesh);
        });
        ledStrips.length = 0;

        // Clear the old beat sequence
        beatSequence.length = 0;

        // Load room parameters
        roomParams.width = projectData.roomParams.width;
        roomParams.height = projectData.roomParams.height;
        roomParams.depth = projectData.roomParams.depth;
        roomParams.creaStanza(); // Recreate the room

        // Load LED strips
        projectData.ledStrips.forEach(function (stripData, index) {
            const geometry = new THREE.BoxGeometry(stripData.length, 0.1, 0.1);
            const material = new THREE.MeshStandardMaterial({
                color: stripData.color,
                emissive: new THREE.Color(stripData.color),
                emissiveIntensity: 0, // Initially off
            });
            const strip = new THREE.Mesh(geometry, material);
            strip.position.set(
                stripData.position.x,
                stripData.position.y,
                stripData.position.z
            );
            strip.rotation.y = stripData.rotationY;
            strip.userData.originalColor = new THREE.Color(stripData.color); // Original color
            strip.userData.offColor = new THREE.Color(0x000000); // Off color
            strip.userData.length = stripData.length;
            strip.castShadow = true;
            strip.receiveShadow = true;

            // Create a RectAreaLight for the strip
            const rectLight = new THREE.RectAreaLight(
                stripData.color,
                0, // Intensity set to 0
                stripData.length,
                0.1
            );
            rectLight.position.set(0, 0, 0);
            rectLight.rotation.y = Math.PI + strip.rotation.y;
            rectLight.lookAt(new THREE.Vector3(0, 0, 1));
            strip.add(rectLight);
            strip.userData.light = rectLight;
            strip.userData.isActive = false;

            scene.add(strip);
            ledStrips.push({ mesh: strip, color: stripData.color });

            // Add the corresponding beat to the sequence
            beatSequence.push(projectData.beatSequence[index] || []);
        });

        // Load tempo (BPM)
        tempoParams.tempo = projectData.tempo;

        // Update the beat grid
        updateBeatGrid(); // Regenerate the grid

        // Update the tempo control
        tempoFolder.__controllers[0].setValue(tempoParams.tempo);
    };

    reader.readAsText(file);
}
