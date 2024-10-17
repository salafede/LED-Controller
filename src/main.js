import * as THREE from "three";
import { GUI } from "dat.gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { saveProject, loadProject } from "./saveLoad.js";
import { initControls } from "./controls.js";

// Import textures using Vite's import system
import textureBackUrl from "./assets/b.jpg";
import textureFrontUrl from "./assets/f.jpg";
import textureLeftUrl from "./assets/l.jpg";
import textureRightUrl from "./assets/r.jpg";
import textureFloorUrl from "./assets/fl.jpg";

// Import postprocessing modules
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Import RectAreaLightUniformsLib
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// Initialization of global variables
let scene, camera, renderer, composer;
let room = null;
let roomEdges = null; // Room edges
let ledStrips = [];
let gui;
let beatSequence = [];
const beatCount = 16; // Number of beats per sequence

let isPlaying = false;
let currentBeat = 0;
let beatInterval = null; // Interval for playback

// Variables for strip selection
let selectedStrip = null;
let selectedStripOutline = null; // Outline of the selected strip
let stripEditFolder; // Folder for strip editing

// Object for BPM
const tempoParams = {
    tempo: 120, // Beats per minute
};

// Object for auto-rotation
const autoRotateParams = {
    autoRotate: false,
    rotateSpeed: 0.01, // Initial rotation speed
};

// New configuration parameters
const configParams = {
    glareIntensity: 0.5,
    roomBrightness: 1,
    ledPower: 3, // Default value adjusted to 3
};

let roomParams; // Declaration of roomParams
let tempoFolder; // Declaration of tempoFolder

// Variable for OrbitControls
let controls;

// Lights
let ambientLight, directionalLight;

function init() {
    // Create the scene
    scene = new THREE.Scene();

    // Initialize RectAreaLightUniformsLib
    RectAreaLightUniformsLib.init();

    // Set up the camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / (window.innerHeight - 240), // Height reduced for controls
        0.1,
        1000
    );
    camera.position.set(0, 5, 15);

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight - 240); // Height reduced for controls
    renderer.outputEncoding = THREE.sRGBEncoding; // Ensure correct color encoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById("container").appendChild(renderer.domElement);

    // Post-processing composer
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass for glare effect
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        configParams.glareIntensity,
        0.4,
        0.85
    );
    bloomPass.threshold = 0.0; // Adjusted to make glare visible at lower intensities
    composer.addPass(bloomPass);

    // Add ambient light
    ambientLight = new THREE.AmbientLight(
        0xffffff,
        0.5 * configParams.roomBrightness
    );
    scene.add(ambientLight);

    // Add directional light (central light)
    directionalLight = new THREE.DirectionalLight(
        0xffffff,
        0.8 * configParams.roomBrightness
    );
    directionalLight.position.set(0, 10, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);

    // Initialize OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Enable damping (inertia)
    controls.dampingFactor = 0.05;
    controls.minDistance = 5; // Minimum zoom distance
    controls.maxDistance = 50; // Maximum zoom distance

    // Create the GUI
    gui = new GUI({ autoPlace: false });
    document.getElementById("gui-container").appendChild(gui.domElement);

    // Room folder
    const roomFolder = gui.addFolder("Stanza");
    roomParams = {
        width: 10,
        height: 5,
        depth: 10,
        creaStanza: function () {
            // Remove existing room and edges
            if (room) scene.remove(room);
            if (roomEdges) scene.remove(roomEdges);

            const width = this.width;
            const height = this.height;
            const depth = this.depth;

            const geometry = new THREE.BoxGeometry(width, height, depth);

            const textureLoader = new THREE.TextureLoader();

            // Load textures
            const textureBack = textureLoader.load(textureBackUrl);
            const textureFront = textureLoader.load(textureFrontUrl);
            const textureLeft = textureLoader.load(textureLeftUrl);
            const textureRight = textureLoader.load(textureRightUrl);
            const textureFloor = textureLoader.load(textureFloorUrl);

            // Set texture encoding
            [
                textureBack,
                textureFront,
                textureLeft,
                textureRight,
                textureFloor,
            ].forEach((texture) => {
                texture.encoding = THREE.sRGBEncoding;
            });

            // For the ceiling, use a neutral color
            const ceilingMaterial = new THREE.MeshStandardMaterial({
                color: 0x121212,
                side: THREE.BackSide,
                metalness: 0,
                roughness: 1,
            });

            // Create materials for each face
            const materials = [
                new THREE.MeshStandardMaterial({
                    map: textureRight,
                    side: THREE.BackSide,
                    metalness: 0,
                    roughness: 1,
                }), // Right side (+X)
                new THREE.MeshStandardMaterial({
                    map: textureLeft,
                    side: THREE.BackSide,
                    metalness: 0,
                    roughness: 1,
                }), // Left side (-X)
                ceilingMaterial, // Top side (+Y)
                new THREE.MeshStandardMaterial({
                    map: textureFloor,
                    side: THREE.BackSide,
                    metalness: 0,
                    roughness: 1,
                }), // Bottom side (-Y)
                new THREE.MeshStandardMaterial({
                    map: textureFront,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0.5, // Semi-transparent to simulate deactivated wall
                    metalness: 0,
                    roughness: 1,
                }), // Front side (+Z)
                new THREE.MeshStandardMaterial({
                    map: textureBack,
                    side: THREE.BackSide,
                    metalness: 0,
                    roughness: 1,
                }), // Back side (-Z)
            ];

            room = new THREE.Mesh(geometry, materials);
            room.receiveShadow = true;
            scene.add(room);

            // Create room edges
            const edgesGeometry = new THREE.EdgesGeometry(geometry);
            const edgesMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
            });
            roomEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            scene.add(roomEdges);

            // Position at the center
            room.position.set(0, height / 2, 0);
            roomEdges.position.set(0, height / 2, 0);
        },
        eliminaStanza: function () {
            if (room) {
                scene.remove(room);
                room = null;
            }
            if (roomEdges) {
                scene.remove(roomEdges);
                roomEdges = null;
            }
        },
    };
    roomFolder.add(roomParams, "width", 5, 20).name("Larghezza").step(0.1);
    roomFolder.add(roomParams, "height", 3, 10).name("Altezza").step(0.1);
    roomFolder.add(roomParams, "depth", 5, 20).name("Profondità").step(0.1);
    roomFolder.add(roomParams, "creaStanza").name("Crea Stanza");
    roomFolder.add(roomParams, "eliminaStanza").name("Elimina Stanza");

    // LED strips folder
    const stripFolder = gui.addFolder("Strisce LED");
    const stripParams = {
        x: 0,
        y: 2,
        z: 0,
        rotationY: 0,
        length: 5,
        color: "#ff0000",
        aggiungiStriscia: function () {
            const geometry = new THREE.BoxGeometry(this.length, 0.1, 0.1);
            const material = new THREE.MeshStandardMaterial({
                color: this.color,
                emissive: new THREE.Color(this.color),
                emissiveIntensity: 0, // Initially off
            });
            const strip = new THREE.Mesh(geometry, material);
            strip.position.set(this.x, this.y, this.z);
            strip.rotation.y = (this.rotationY * Math.PI) / 180;
            strip.userData.originalColor = new THREE.Color(this.color);
            strip.userData.offColor = new THREE.Color(0x000000);
            strip.userData.length = this.length;
            strip.castShadow = true;
            strip.receiveShadow = true;

            // Create a RectAreaLight for the strip
            const rectLight = new THREE.RectAreaLight(
                this.color,
                0, // Intensity set to 0
                this.length,
                0.1
            );
            rectLight.position.set(0, 0, 0);
            rectLight.rotation.y = Math.PI + strip.rotation.y;
            rectLight.lookAt(new THREE.Vector3(0, 0, 1));
            strip.add(rectLight);
            strip.userData.light = rectLight;
            strip.userData.isActive = false; // To track if the strip is active

            scene.add(strip);
            ledStrips.push({ mesh: strip, color: this.color });

            // Add an empty beat sequence for the new strip
            beatSequence.push([]);

            // Update the beat grid
            updateBeatGrid();
        },
    };
    stripFolder.add(stripParams, "x", -10, 10).name("Posizione X").step(0.1);
    stripFolder.add(stripParams, "y", 0, 10).name("Posizione Y").step(0.1);
    stripFolder.add(stripParams, "z", -10, 10).name("Posizione Z").step(0.1);
    stripFolder
        .add(stripParams, "rotationY", 0, 360)
        .name("Rotazione Y")
        .step(1);
    stripFolder.add(stripParams, "length", 0.1, 10).name("Lunghezza").step(0.1);
    stripFolder.addColor(stripParams, "color").name("Colore");
    stripFolder.add(stripParams, "aggiungiStriscia").name("Aggiungi Striscia");

    // Configurations folder
    const configFolder = gui.addFolder("Configurazioni");

    // Tempo control (BPM)
    tempoFolder = configFolder.addFolder("Tempo");
    tempoFolder
        .add(tempoParams, "tempo", 60, 200)
        .name("BPM")
        .step(1)
        .onChange(function () {
            if (isPlaying) {
                // If playing, restart the interval with the new BPM
                clearInterval(beatInterval);
                playSequence();
            }
        });

    // Auto-rotation controls
    const autoRotateFolder = configFolder.addFolder("Auto-Rotazione");
    autoRotateFolder
        .add(autoRotateParams, "autoRotate")
        .name("Abilita Auto-Rotazione")
        .onChange(function (value) {
            controls.autoRotate = value;
        });
    autoRotateFolder
        .add(autoRotateParams, "rotateSpeed", -2, 1)
        .name("Velocità Rotazione")
        .step(0.01)
        .onChange(function (value) {
            controls.autoRotateSpeed = value;
        });

    // Glare control
    configFolder
        .add(configParams, "glareIntensity", 0, 2)
        .name("Intensità Glare")
        .step(0.01)
        .onChange(function (value) {
            bloomPass.strength = value;
        });

    // Room brightness control
    configFolder
        .add(configParams, "roomBrightness", 0, 1)
        .name("Luminosità Stanza")
        .step(0.01)
        .onChange(function (value) {
            ambientLight.intensity = 0.5 * value;
            directionalLight.intensity = 0.8 * value;
        });

    // LED strips power control
    configFolder
        .add(configParams, "ledPower", 3, 8) // Adjusted range
        .name("Potenza LED Strips")
        .step(0.01)
        .onChange(function (value) {
            ledStrips.forEach(function (stripObj) {
                if (stripObj.mesh.userData.isActive) {
                    stripObj.mesh.material.emissiveIntensity = value;
                    stripObj.mesh.userData.light.intensity = value;
                }
            });
        });

    // Folder for strip editing
    stripEditFolder = gui.addFolder("Modifica Striscia");
    stripEditFolder.domElement.style.display = "none"; // Hide until a strip is selected
    const editParams = {
        x: 0,
        y: 0,
        z: 0,
        rotationY: 0,
        length: 1,
        color: "#ffffff",
        clonaStriscia: function () {
            if (selectedStrip) {
                // Clone the selected strip
                deselectStrip(); // Deselect the original strip

                const clonedMesh = selectedStrip.mesh.clone();
                clonedMesh.material = selectedStrip.mesh.material.clone();
                clonedMesh.position.x += 1; // Slightly move the cloned strip

                // Clone the light
                const clonedLight = selectedStrip.mesh.userData.light.clone();
                clonedMesh.add(clonedLight);
                clonedMesh.userData.light = clonedLight;
                clonedMesh.userData.isActive =
                    selectedStrip.mesh.userData.isActive;
                clonedMesh.userData.length = selectedStrip.mesh.userData.length;
                clonedMesh.userData.originalColor =
                    selectedStrip.mesh.userData.originalColor.clone();
                clonedMesh.userData.offColor =
                    selectedStrip.mesh.userData.offColor.clone();

                scene.add(clonedMesh);
                const newStripObj = {
                    mesh: clonedMesh,
                    color: "#" + clonedMesh.material.color.getHexString(),
                };
                ledStrips.push(newStripObj);

                // Clone the beat sequence
                const selectedIndex = ledStrips.indexOf(selectedStrip);
                beatSequence.push([...beatSequence[selectedIndex]]);

                // Update the beat grid
                updateBeatGrid();

                // Select the new strip
                selectStrip(newStripObj);
            }
        },
        eliminaStriscia: function () {
            if (selectedStrip) {
                // Remove the strip from the scene and the array
                scene.remove(selectedStrip.mesh);
                const index = ledStrips.indexOf(selectedStrip);
                if (index > -1) {
                    ledStrips.splice(index, 1);
                    // Remove the corresponding beat sequence entry
                    beatSequence.splice(index, 1);
                    // Update the beat grid
                    updateBeatGrid();
                    deselectStrip();
                }
            }
        },
    };
    stripEditFolder
        .add(editParams, "x", -10, 10)
        .name("Posizione X")
        .step(0.01)
        .onChange(function (value) {
            if (selectedStrip) selectedStrip.mesh.position.x = value;
        });
    stripEditFolder
        .add(editParams, "y", 0, 10)
        .name("Posizione Y")
        .step(0.01)
        .onChange(function (value) {
            if (selectedStrip) selectedStrip.mesh.position.y = value;
        });
    stripEditFolder
        .add(editParams, "z", -10, 10)
        .name("Posizione Z")
        .step(0.01)
        .onChange(function (value) {
            if (selectedStrip) selectedStrip.mesh.position.z = value;
        });
    stripEditFolder
        .add(editParams, "rotationY", 0, 360)
        .name("Rotazione Y")
        .step(0.1)
        .onChange(function (value) {
            if (selectedStrip) {
                selectedStrip.mesh.rotation.y = (value * Math.PI) / 180;
                // Update light rotation
                selectedStrip.mesh.userData.light.rotation.y =
                    Math.PI + selectedStrip.mesh.rotation.y;
                selectedStrip.mesh.userData.light.lookAt(
                    new THREE.Vector3(0, 0, 1)
                );
            }
        });
    stripEditFolder
        .add(editParams, "length", 0.1, 10)
        .name("Lunghezza")
        .step(0.01)
        .onChange(function (value) {
            if (selectedStrip) {
                const scaleFactor = value / selectedStrip.mesh.userData.length;
                selectedStrip.mesh.scale.x = scaleFactor;
                selectedStrip.mesh.userData.length = value;

                // Update RectAreaLight size
                selectedStrip.mesh.userData.light.width = value;
            }
        });
    stripEditFolder
        .addColor(editParams, "color")
        .name("Colore")
        .onChange(function (value) {
            if (selectedStrip) {
                selectedStrip.mesh.material.color.set(value);
                selectedStrip.mesh.material.emissive.set(value);
                selectedStrip.mesh.userData.originalColor = new THREE.Color(
                    value
                );
                selectedStrip.mesh.userData.light.color.set(value);
            }
        });
    stripEditFolder.add(editParams, "clonaStriscia").name("Clona Striscia");
    stripEditFolder.add(editParams, "eliminaStriscia").name("Elimina Striscia");

    // Event listener for window resize
    window.addEventListener("resize", onWindowResize, false);

    // Event listeners for playback controls
    document.getElementById("play-btn").addEventListener("click", playSequence);
    document
        .getElementById("pause-btn")
        .addEventListener("click", pauseSequence);
    document.getElementById("stop-btn").addEventListener("click", stopSequence);

    // Initialize strip controls
    initControls(renderer, camera, ledStrips, selectStrip, deselectStrip);

    // Add save and load buttons
    document.getElementById("save-btn").addEventListener("click", () => {
        saveProject(roomParams, ledStrips, beatSequence, tempoParams);
    });
    document.getElementById("load-btn").addEventListener("change", (event) => {
        loadProject(
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
        );
    });

    // Initialize the beat grid
    initBeatGrid();

    // Start the animation
    animate();
}

// Function to handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / (window.innerHeight - 240); // Height reduced for controls
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight - 240); // Height reduced for controls
    composer.setSize(window.innerWidth, window.innerHeight - 240);
}

// Animation function
function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Render scene with composer
    composer.render();
}

// Function to play the sequence
function playSequence() {
    if (isPlaying) return; // Avoid multiple starts
    isPlaying = true;

    // Calculate the interval between beats in milliseconds
    const intervalDuration = ((60 / tempoParams.tempo) * 1000) / 4; // Divided by 4 for quarter notes

    beatInterval = setInterval(() => {
        // Update the LED strips
        updateLEDs();

        // Advance to the next beat
        currentBeat = (currentBeat + 1) % beatCount;
    }, intervalDuration);
}

// Function to pause the sequence
function pauseSequence() {
    if (!isPlaying) return;
    isPlaying = false;
    clearInterval(beatInterval);
}

// Function to stop the sequence
function stopSequence() {
    isPlaying = false;
    clearInterval(beatInterval);
    currentBeat = 0;
    // Turn off all LED strips
    ledStrips.forEach((stripObj) => {
        stripObj.mesh.material.emissiveIntensity = 0;
        stripObj.mesh.userData.light.intensity = 0;
        stripObj.mesh.userData.isActive = false;
    });
}

// Function to update the LED strips based on the current beat
function updateLEDs() {
    ledStrips.forEach((stripObj, stripIndex) => {
        const isActive = beatSequence[stripIndex][currentBeat];
        stripObj.mesh.userData.isActive = isActive;
        if (isActive) {
            stripObj.mesh.material.emissiveIntensity = configParams.ledPower;
            stripObj.mesh.userData.light.intensity = configParams.ledPower;
        } else {
            stripObj.mesh.material.emissiveIntensity = 0;
            stripObj.mesh.userData.light.intensity = 0;
        }
    });
}

// Function to initialize the beat grid
function initBeatGrid() {
    const beatGrid = document.getElementById("beat-grid");
    beatGrid.innerHTML = "";
}

// Function to update the beat grid
function updateBeatGrid() {
    const beatGrid = document.getElementById("beat-grid");
    beatGrid.innerHTML = ""; // Clear the current grid

    ledStrips.forEach((strip, stripIndex) => {
        const stripRow = document.createElement("div");
        stripRow.className = "strip-row";

        const stripLabel = document.createElement("div");
        stripLabel.className = "strip-label";
        stripLabel.textContent = `Striscia ${stripIndex + 1}`;
        stripRow.appendChild(stripLabel);

        // Add a row for each LED strip
        if (!beatSequence[stripIndex]) {
            beatSequence[stripIndex] = [];
        }

        for (let i = 0; i < beatCount; i++) {
            const beatCell = document.createElement("div");
            beatCell.className = "beat-cell";
            beatCell.dataset.stripIndex = stripIndex;
            beatCell.dataset.beatIndex = i;
            beatCell.addEventListener("click", toggleBeat);

            // If the beat is active, add the active class
            if (beatSequence[stripIndex][i]) {
                beatCell.classList.add("active");
            }

            stripRow.appendChild(beatCell);
        }

        beatGrid.appendChild(stripRow);
    });
}

// Function to handle click on a beat cell
function toggleBeat(event) {
    const stripIndex = event.currentTarget.dataset.stripIndex;
    const beatIndex = event.currentTarget.dataset.beatIndex;
    beatSequence[stripIndex][beatIndex] = !beatSequence[stripIndex][beatIndex];
    event.currentTarget.classList.toggle("active");
}

// Function to select a strip
function selectStrip(stripObj) {
    deselectStrip(); // Deselect the previous strip

    selectedStrip = stripObj;

    // Add blue outline to the selected strip
    const outlineGeometry = new THREE.EdgesGeometry(
        selectedStrip.mesh.geometry
    );
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    selectedStripOutline = new THREE.LineSegments(
        outlineGeometry,
        outlineMaterial
    );
    selectedStrip.mesh.add(selectedStripOutline);

    // Update values in the edit panel
    updateEditFolder(selectedStrip);
}

// Function to deselect the strip
function deselectStrip() {
    if (selectedStrip) {
        // Remove the blue outline
        if (selectedStripOutline) {
            selectedStrip.mesh.remove(selectedStripOutline);
            selectedStripOutline.geometry.dispose();
            selectedStripOutline.material.dispose();
            selectedStripOutline = null;
        }
        selectedStrip = null;
        stripEditFolder.domElement.style.display = "none";
    }
}

// Function to update the strip edit panel
function updateEditFolder(stripObj) {
    stripEditFolder.domElement.style.display = "";
    stripEditFolder.__controllers.forEach(function (controller) {
        switch (controller.property) {
            case "x":
                controller.setValue(stripObj.mesh.position.x);
                break;
            case "y":
                controller.setValue(stripObj.mesh.position.y);
                break;
            case "z":
                controller.setValue(stripObj.mesh.position.z);
                break;
            case "rotationY":
                controller.setValue((stripObj.mesh.rotation.y * 180) / Math.PI);
                break;
            case "length":
                controller.setValue(stripObj.mesh.userData.length);
                break;
            case "color":
                controller.setValue(
                    "#" + stripObj.mesh.material.color.getHexString()
                );
                break;
        }
    });
}

// Start the application
init();
