import * as THREE from "three";
import { GUI } from "dat.gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { saveProject } from "./saveLoad.js";
import { initControls } from "./controls.js";

// Import textures using Vite's import system
import textureBackUrl from "./assets/b.jpg";
import textureFrontUrl from "./assets/f.jpg";
import textureLeftUrl from "./assets/l.jpg";
import textureRightUrl from "./assets/r.jpg";
import textureFloorUrl from "./assets/fl.jpg";

// Import sample.vik using Vite's import system
import sampleVikUrl from "./assets/sample.vik?url";

// Import post-processing modules
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Import RectAreaLightUniformsLib
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// Import SortableJS for drag and drop
import Sortable from "sortablejs";

// Initialization of global variables
let scene, camera, renderer, composer;
let room = null;
let roomEdges = null; // Room edges
let ledStrips = [];
let gui;
let beatSequence = [];
const beatCount = 16; // Number of beats per sequence
let lastSentLEDState = [];

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
    ledPower: 3, // Default value set to 3
};

// Variables for resizing
let isResizing = false;
let initialMouseY = 0;
let initialHeight3D = 0;
let initialHeightGrid = 0;

let roomParams; // Declaration of roomParams
let tempoFolder; // Declaration of tempoFolder
let configFolder; // Declaration of configFolder

// Variable for OrbitControls
let controls;

// Lights
let ambientLight, directionalLight;

// DOM elements for rename modal
let renameModal, renameInput, renameConfirmBtn, renameCancelBtn;
let stripToRename = null;

// Variable to track if the mouse is over a strip label
let hoveredStrip = null;

// Variables for serial communication
let port = null;
let writer = null;
let reader = null;
let ledMapping = {}; // Mapping of strips to LED indices
let availableLEDs = 0; // Number of LEDs available on the Arduino

// Variable to hold the serial monitor window
let serialMonitorWindow = null;

function init() {
    // Create the scene
    scene = new THREE.Scene();

    // Initialize RectAreaLightUniformsLib
    RectAreaLightUniformsLib.init();

    // Set up the camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / document.getElementById("container").clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 15);

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        window.innerWidth,
        document.getElementById("container").clientHeight
    );
    renderer.outputEncoding = THREE.sRGBEncoding; // Ensure correct color encoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById("container").appendChild(renderer.domElement);

    // Composer for post-processing
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

    // Folder for the room
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
                    opacity: 0.5, // Semi-transparent to simulate a deactivated wall
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

    // Folder for LED strips
    const stripFolder = gui.addFolder("Strisce LED");
    const stripParams = {
        x: 0,
        y: 2,
        z: 0,
        rotationY: 0,
        length: 5,
        color: "#ff0000",
        name: `Striscia ${ledStrips.length + 1}`, // Default name
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
            strip.userData.name =
                this.name || `Striscia ${ledStrips.length + 1}`;
            strip.userData.mappedLED = null; // No mapping initially
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
    stripFolder.add(stripParams, "name").name("Nome Striscia");
    stripFolder.add(stripParams, "aggiungiStriscia").name("Aggiungi Striscia");

    // Folder for configurations
    configFolder = gui.addFolder("Configurazioni");

    // Tempo (BPM) control
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

    // LED strip power control
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
        name: "Striscia",
        mappedLED: null,
        rinominaStriscia: function () {
            if (selectedStrip) {
                stripToRename = selectedStrip;
                renameInput.value = stripToRename.mesh.userData.name || "";
                renameModal.style.display = "block";
            }
        },
        cambiaMappatura: function () {
            if (selectedStrip && availableLEDs > 0) {
                const newMapping = prompt(
                    `Inserisci il numero del LED da mappare (1 - ${availableLEDs}):`,
                    selectedStrip.mesh.userData.mappedLED || ""
                );
                if (newMapping !== null) {
                    const ledNumber = parseInt(newMapping);
                    if (ledNumber >= 1 && ledNumber <= availableLEDs) {
                        // Check if another strip is already mapped to this LED
                        for (const stripObj of ledStrips) {
                            if (
                                stripObj.mesh.userData.mappedLED ===
                                    ledNumber &&
                                stripObj !== selectedStrip
                            ) {
                                stripObj.mesh.userData.mappedLED = null;
                                break;
                            }
                        }
                        selectedStrip.mesh.userData.mappedLED = ledNumber;
                        updateBeatGrid();
                    } else {
                        alert("Numero LED non valido.");
                    }
                }
            } else {
                alert("Nessun dispositivo live connesso.");
            }
        },
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
                clonedMesh.userData.name =
                    selectedStrip.mesh.userData.name + " (clone)";
                clonedMesh.userData.mappedLED = null; // No mapping for clone

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
                // Remove the strip from the scene and array
                scene.remove(selectedStrip.mesh);
                const index = ledStrips.indexOf(selectedStrip);
                if (index > -1) {
                    ledStrips.splice(index, 1);
                    // Remove the corresponding entry in the beat sequence
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
                // Update the light's rotation
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

                // Update the RectAreaLight size
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
    stripEditFolder
        .add(editParams, "name")
        .name("Nome")
        .onChange(function (value) {
            if (selectedStrip) {
                selectedStrip.mesh.userData.name = value;
                updateBeatGrid();
            }
        });
    stripEditFolder
        .add(editParams, "rinominaStriscia")
        .name("Rinomina Striscia");
    stripEditFolder.add(editParams, "cambiaMappatura").name("Cambia Mappatura");
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
    document
        .getElementById("serial-monitor-btn")
        .addEventListener("click", openSerialMonitor);

    // Event listener for Live button
    document
        .getElementById("live-btn")
        .addEventListener("click", connectToSerial);

    // Initialize strip controls
    initControls(renderer, camera, ledStrips, selectStrip, deselectStrip);

    // Add save and load buttons
    document.getElementById("save-btn").addEventListener("click", () => {
        saveProject(
            roomParams,
            ledStrips,
            beatSequence,
            tempoParams,
            configParams
        );
    });
    document.getElementById("load-btn").addEventListener("change", (event) => {
        loadProject(event);
    });

    // Initialize the beat grid
    initBeatGrid();

    // Create the resize handle once
    const resizeHandle = document.createElement("div");
    resizeHandle.id = "resize-handle";
    document.getElementById("beat-grid").appendChild(resizeHandle);

    // Add event listener for resizing
    resizeHandle.addEventListener("mousedown", onResizeMouseDown);

    // Initialize the rename modal
    initRenameModal();

    // Load the sample.vik if present
    loadSampleProject();

    // Start the animation
    animate();
}

// Function to load sample.vik at startup
function loadSampleProject() {
    fetch(sampleVikUrl)
        .then((response) => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error("Sample file not found");
            }
        })
        .then((blob) => {
            const file = new File([blob], "sample.vik", {
                type: "application/json",
            });
            const event = { target: { files: [file] } };
            loadProject(event);
        })
        .catch((error) => {
            console.log("No sample file to load.");
        });
}

// Function to load the project
function loadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const json = e.target.result;
        let projectData;
        try {
            projectData = JSON.parse(json);
        } catch (error) {
            console.error("Error parsing project file:", error);
            return;
        }

        // Load roomParams
        if (projectData.roomParams) {
            roomParams.width = projectData.roomParams.width || roomParams.width;
            roomParams.height =
                projectData.roomParams.height || roomParams.height;
            roomParams.depth = projectData.roomParams.depth || roomParams.depth;
            roomParams.creaStanza();
        }

        // Remove existing LED strips
        ledStrips.forEach((stripObj) => {
            scene.remove(stripObj.mesh);
        });
        ledStrips.length = 0;
        beatSequence.length = 0;

        // Load LED strips
        if (projectData.ledStrips) {
            projectData.ledStrips.forEach((stripData, index) => {
                const geometry = new THREE.BoxGeometry(
                    stripData.length || 5,
                    0.1,
                    0.1
                );
                const material = new THREE.MeshStandardMaterial({
                    color: stripData.color || "#ffffff",
                    emissive: new THREE.Color(stripData.color || "#ffffff"),
                    emissiveIntensity: 0, // Initially off
                });
                const strip = new THREE.Mesh(geometry, material);
                strip.position.copy(stripData.position || new THREE.Vector3());
                strip.rotation.y = stripData.rotationY || 0;
                strip.userData.originalColor = new THREE.Color(
                    stripData.color || "#ffffff"
                );
                strip.userData.offColor = new THREE.Color(0x000000);
                strip.userData.length = stripData.length || 5;
                strip.userData.name = stripData.name || `Striscia ${index + 1}`;
                strip.userData.mappedLED = stripData.mappedLED || null;
                strip.castShadow = true;
                strip.receiveShadow = true;

                // Create a RectAreaLight for the strip
                const rectLight = new THREE.RectAreaLight(
                    stripData.color || "#ffffff",
                    0, // Intensity set to 0
                    stripData.length || 5,
                    0.1
                );
                rectLight.position.set(0, 0, 0);
                rectLight.rotation.y = Math.PI + strip.rotation.y;
                rectLight.lookAt(new THREE.Vector3(0, 0, 1));
                strip.add(rectLight);
                strip.userData.light = rectLight;
                strip.userData.isActive = false; // To track if the strip is active

                scene.add(strip);
                ledStrips.push({ mesh: strip, color: stripData.color });
            });
        }

        // Load the beatSequence
        if (projectData.beatSequence) {
            projectData.beatSequence.forEach((sequence) => {
                beatSequence.push(sequence);
            });
        }

        // Load tempoParams
        if (projectData.tempoParams) {
            tempoParams.tempo =
                projectData.tempoParams.tempo || tempoParams.tempo;
        } else if (projectData.tempo) {
            // For backward compatibility
            tempoParams.tempo = projectData.tempo;
        }
        tempoFolder.__controllers.forEach((controller) => {
            if (controller.property === "tempo") {
                controller.setValue(tempoParams.tempo);
            }
        });

        // Load configParams
        if (projectData.configParams) {
            configParams.glareIntensity =
                projectData.configParams.glareIntensity ??
                configParams.glareIntensity;
            configParams.roomBrightness =
                projectData.configParams.roomBrightness ??
                configParams.roomBrightness;
            configParams.ledPower =
                projectData.configParams.ledPower ?? configParams.ledPower;
        }

        // Update configFolder controllers
        configFolder.__controllers.forEach((controller) => {
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
        });

        // Update the beat grid
        updateBeatGrid();

        // Re-initialize strip controls
        initControls(renderer, camera, ledStrips, selectStrip, deselectStrip);
    };

    reader.readAsText(file);
}

// Function to handle window resize
function onWindowResize() {
    camera.aspect =
        window.innerWidth / document.getElementById("container").clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
        window.innerWidth,
        document.getElementById("container").clientHeight
    );
    composer.setSize(
        window.innerWidth,
        document.getElementById("container").clientHeight
    );
}

// Function for vertical resizing
function onResizeMouseDown(event) {
    isResizing = true;
    initialMouseY = event.clientY;
    initialHeight3D = document.getElementById("container").clientHeight;
    initialHeightGrid = document.getElementById("beat-grid").clientHeight;

    document.addEventListener("mousemove", onResizeMouseMove);
    document.addEventListener("mouseup", onResizeMouseUp);
}

function onResizeMouseMove(event) {
    if (!isResizing) return;

    const deltaY = event.clientY - initialMouseY;
    const newHeight3D = initialHeight3D + deltaY;
    const newHeightGrid = initialHeightGrid - deltaY;

    if (newHeight3D < 100 || newHeightGrid < 100) return;

    document.getElementById("container").style.height = `${newHeight3D}px`;
    document.getElementById("beat-grid").style.height = `${newHeightGrid}px`;

    // Update renderer and camera
    onWindowResize();
}

function onResizeMouseUp() {
    isResizing = false;
    document.removeEventListener("mousemove", onResizeMouseMove);
    document.removeEventListener("mouseup", onResizeMouseUp);
}

// Animation function
function animate() {
    requestAnimationFrame(animate);

    // Highlight the strip based on hover
    if (hoveredStrip && (!isPlaying || isPlaying === false)) {
        highlightStrip(hoveredStrip);
    } else {
        if (hoveredStrip) {
            unhighlightStrip(hoveredStrip);
            hoveredStrip = null;
        }
    }

    // Update controls
    controls.update();

    // Render the scene with the composer
    composer.render();
}

// Function to play the sequence
function playSequence() {
    if (isPlaying) return; // Avoid multiple starts
    isPlaying = true;

    // Calculate the interval between beats in milliseconds
    const intervalDuration = ((60 / tempoParams.tempo) * 1000) / 4; // Divided by 4 for quarter notes

    // Highlight the first beat before starting
    highlightCurrentBeat();

    beatInterval = setInterval(() => {
        // Update the LED strips
        updateLEDs();

        // Advance to the next beat
        currentBeat = (currentBeat + 1) % beatCount;

        // Update the highlight in the BeatGrid
        highlightCurrentBeat();
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

    // Send commands to turn off all LEDs
    if (writer && port.readable) {
        sendLEDCommands([]);
    }

    // Remove highlight from the BeatGrid
    const highlightedCells = document.querySelectorAll(".beat-cell.highlight");
    highlightedCells.forEach((cell) => {
        cell.classList.remove("highlight");
    });
}

// Function to update LED strips based on the current beat
function updateLEDs() {
    const activeLEDs = []; // Array per contenere i numeri dei LED attivi
    ledStrips.forEach((stripObj, stripIndex) => {
        const isActive = beatSequence[stripIndex][currentBeat];
        stripObj.mesh.userData.isActive = isActive;
        if (isActive) {
            stripObj.mesh.material.emissiveIntensity = configParams.ledPower;
            stripObj.mesh.userData.light.intensity = configParams.ledPower;
            if (stripObj.mesh.userData.mappedLED) {
                activeLEDs.push(stripObj.mesh.userData.mappedLED);
            }
        } else {
            stripObj.mesh.material.emissiveIntensity = 0;
            stripObj.mesh.userData.light.intensity = 0;
        }
    });

    // Invia comandi all'Arduino solo se c'è un cambiamento
    if (writer && port.readable) {
        sendLEDCommands(activeLEDs);
    }
}

// Function to initialize the beat grid
function initBeatGrid() {
    const beatGrid = document.getElementById("beat-grid");
    beatGrid.innerHTML = "";
}

// Function to update the beat grid
function updateBeatGrid() {
    const beatGrid = document.getElementById("beat-grid");
    beatGrid.innerHTML = ""; // Clear current content

    // Create a container for the strip rows
    const stripsContainer = document.createElement("div");
    stripsContainer.id = "strips-container";

    ledStrips.forEach((strip, stripIndex) => {
        const stripRow = document.createElement("div");
        stripRow.className = "strip-row";
        stripRow.dataset.stripIndex = stripIndex;

        // Create the strip label
        const stripLabel = document.createElement("div");
        stripLabel.className = "strip-label";
        stripLabel.dataset.stripIndex = stripIndex;

        // Create the edit icon
        const editIcon = document.createElement("span");
        editIcon.className = "edit-icon";
        editIcon.innerHTML = "&#9998;"; // Unicode character for pencil
        stripLabel.appendChild(editIcon);

        // Add the strip name
        const stripName = document.createElement("span");
        stripName.textContent =
            strip.mesh.userData.name || `Striscia ${stripIndex + 1}`;
        stripLabel.appendChild(stripName);

        // Add mapping info if mapped
        if (strip.mesh.userData.mappedLED) {
            const mappingInfo = document.createElement("span");
            mappingInfo.className = "mapping-info";
            mappingInfo.textContent = ` Mapped ${strip.mesh.userData.mappedLED}`;
            stripLabel.appendChild(mappingInfo);
        }

        stripLabel.title = "Clicca per rinominare";

        stripLabel.addEventListener("click", () => {
            stripToRename = strip;
            renameInput.value = strip.mesh.userData.name || "";
            renameModal.style.display = "block";
        });

        stripRow.appendChild(stripLabel);

        // Hover events
        stripRow.addEventListener("mouseenter", () => {
            if (!isPlaying) {
                hoveredStrip = strip;
                // Se la striscia è mappata e la porta è connessa, invia il comando
                if (writer && port.readable && strip.mesh.userData.mappedLED) {
                    sendLEDCommands([strip.mesh.userData.mappedLED]);
                }
            }
        });

        stripRow.addEventListener("mouseleave", () => {
            if (hoveredStrip) {
                unhighlightStrip(hoveredStrip);
                // Se la striscia è mappata e la porta è connessa, spegni il LED
                if (
                    writer &&
                    port.readable &&
                    hoveredStrip.mesh.userData.mappedLED
                ) {
                    sendLEDCommands([]);
                }
                hoveredStrip = null;
            }
        });

        // Add a row for each LED strip
        if (!beatSequence[stripIndex]) {
            beatSequence[stripIndex] = [];
        }

        for (let i = 0; i < beatCount; i++) {
            const beatCell = document.createElement("div");
            beatCell.className = "beat-cell";
            beatCell.dataset.stripIndex = stripIndex;
            beatCell.dataset.beatIndex = i;
            beatCell.dataset.beatColumn = i; // Add this attribute
            beatCell.addEventListener("click", toggleBeat);

            // If the beat is active, add the "active" class
            if (beatSequence[stripIndex][i]) {
                beatCell.classList.add("active");
            }

            stripRow.appendChild(beatCell);
        }

        stripsContainer.appendChild(stripRow);
    });

    // Add the strips container to the BeatGrid
    beatGrid.appendChild(stripsContainer);

    // Re-add the resize handle if it doesn't exist
    let resizeHandle = document.getElementById("resize-handle");
    if (!resizeHandle) {
        resizeHandle = document.createElement("div");
        resizeHandle.id = "resize-handle";
        beatGrid.appendChild(resizeHandle);
        resizeHandle.addEventListener("mousedown", onResizeMouseDown);
    } else {
        // Ensure it's the last element in the beatGrid
        beatGrid.appendChild(resizeHandle);
    }

    // Initialize SortableJS for drag and drop
    new Sortable(stripsContainer, {
        animation: 150,
        onEnd: function (evt) {
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            // Update the ledStrips array
            const movedStrip = ledStrips.splice(oldIndex, 1)[0];
            ledStrips.splice(newIndex, 0, movedStrip);
            // Update the beatSequence array
            const movedSequence = beatSequence.splice(oldIndex, 1)[0];
            beatSequence.splice(newIndex, 0, movedSequence);
            // Update the strip-row indices
            updateBeatGrid();
        },
    });
}

// Function to highlight the current beat
function highlightCurrentBeat() {
    // Remove highlight from previous columns
    const previousHighlightedCells = document.querySelectorAll(
        ".beat-cell.highlight"
    );
    previousHighlightedCells.forEach((cell) => {
        cell.classList.remove("highlight");
    });

    // Add highlight to the current column
    const currentBeatCells = document.querySelectorAll(
        `.beat-cell[data-beat-column='${currentBeat}']`
    );
    currentBeatCells.forEach((cell) => {
        cell.classList.add("highlight");
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

    // Add a blue outline to the selected strip
    const outlineGeometry = new THREE.EdgesGeometry(
        selectedStrip.mesh.geometry
    );
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    selectedStripOutline = new THREE.LineSegments(
        outlineGeometry,
        outlineMaterial
    );
    selectedStrip.mesh.add(selectedStripOutline);

    // Update the values in the edit panel
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

// Function to update the strip editing panel
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
            case "name":
                controller.setValue(stripObj.mesh.userData.name);
                break;
            case "mappedLED":
                controller.setValue(stripObj.mesh.userData.mappedLED || "");
                break;
        }
    });
}

// Function to open the serial monitor in a popup window
function openSerialMonitor() {
    if (serialMonitorWindow && !serialMonitorWindow.closed) {
        serialMonitorWindow.focus();
    } else {
        serialMonitorWindow = window.open(
            "./src/serialMonitor.html",
            "Monitor Seriale",
            "width=600,height=700"
        );
    }
}

// Function to initialize the rename modal
function initRenameModal() {
    renameModal = document.getElementById("rename-modal");
    renameInput = document.getElementById("rename-input");
    renameConfirmBtn = document.getElementById("rename-confirm-btn");
    renameCancelBtn = document.getElementById("rename-cancel-btn");

    renameConfirmBtn.addEventListener("click", () => {
        if (stripToRename) {
            stripToRename.mesh.userData.name = renameInput.value;
            updateBeatGrid();
            renameModal.style.display = "none";
            stripToRename = null;
        }
    });

    renameCancelBtn.addEventListener("click", () => {
        renameModal.style.display = "none";
        stripToRename = null;
    });
}

// Function to highlight the strip in the 3D environment
function highlightStrip(strip) {
    strip.mesh.material.emissiveIntensity = configParams.ledPower * 1.5;

    // If strip is mapped and port is connected, send command
    if (writer && port.readable && strip.mesh.userData.mappedLED) {
        sendLEDCommands([strip.mesh.userData.mappedLED]);
    }
}

// Function to remove the highlight from the strip in the 3D environment
function unhighlightStrip(strip) {
    if (!strip.mesh.userData.isActive) {
        strip.mesh.material.emissiveIntensity = 0;
        strip.mesh.userData.light.intensity = 0;
    } else {
        strip.mesh.material.emissiveIntensity = configParams.ledPower;
        strip.mesh.userData.light.intensity = configParams.ledPower;
    }

    // If strip is mapped and port is connected, turn off LED
    if (writer && port.readable && strip.mesh.userData.mappedLED) {
        sendLEDCommands([]);
    }
}

// Function to connect to the serial port
async function connectToSerial() {
    if ("serial" in navigator) {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 }); // Baud rate aumentato

            // Open the serial monitor window
            openSerialMonitor();

            // Set up the TextEncoder and writer
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(
                port.writable
            );
            writer = textEncoder.writable.getWriter();

            // Set up the TextDecoder and reader
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(
                textDecoder.writable
            );
            reader = textDecoder.readable.getReader();

            // Set up communication with serial monitor window
            window.addEventListener("message", handleSerialMonitorMessage);

            // Read until we get "READY"
            let initialData = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    initialData += value;
                    if (initialData.includes("READY")) {
                        // Log to serial monitor
                        sendToSerialMonitor("READY", "rx");
                        break;
                    }
                }
            }

            // Send the handshake command
            await writer.write("HELLO\n");
            // Log to serial monitor
            sendToSerialMonitor("HELLO", "tx");

            // Read the response
            let response = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    response += value;
                    if (response.includes("\n")) {
                        break;
                    }
                }
            }

            response = response.trim();
            // Log to serial monitor
            sendToSerialMonitor(response, "rx");

            // Extract LEDCOUNT from response
            const ledCountMatch = response.match(/LEDCOUNT(\d+)/);
            if (ledCountMatch) {
                availableLEDs = parseInt(ledCountMatch[1]);
                alert(
                    `Dispositivo connesso con ${availableLEDs} LED disponibili.`
                );

                // Map the strips to LEDs
                mapStripsToLEDs();
                updateBeatGrid();
            } else {
                alert("Risposta non valida dal dispositivo.");
            }
        } catch (error) {
            console.error("Errore durante la connessione seriale:", error);
            alert("Errore durante la connessione seriale.");
        }
    } else {
        alert("API seriale non supportata dal browser.");
    }
}

// Function to handle messages from the serial monitor window
function handleSerialMonitorMessage(event) {
    if (event.data && event.data.type === "customCommand") {
        const command = event.data.command;
        // Send the custom command to the Arduino
        if (writer) {
            writer.write(command + "\n");
            // Log to serial monitor
            sendToSerialMonitor(command, "tx");
        }
    }
}

// Function to send messages to the serial monitor window
function sendToSerialMonitor(message, direction) {
    // direction: "rx" or "tx"
    if (serialMonitorWindow && !serialMonitorWindow.closed) {
        serialMonitorWindow.postMessage(
            {
                type: "serialData",
                message: message,
                direction: direction,
            },
            "*"
        );
    }
}

// Function to map strips to LEDs
function mapStripsToLEDs() {
    // Clear existing mappings
    ledStrips.forEach((strip) => {
        strip.mesh.userData.mappedLED = null;
    });

    // Map strips in order up to the number of available LEDs
    for (let i = 0; i < Math.min(ledStrips.length, availableLEDs); i++) {
        ledStrips[i].mesh.userData.mappedLED = i + 1;
    }
}

// Function to send LED commands to Arduino
async function sendLEDCommands(activeLEDs) {
    if (writer) {
        // Confronta l'ultimo stato con il nuovo stato
        const isStateChanged =
            lastSentLEDState.length !== activeLEDs.length ||
            lastSentLEDState.some((led, index) => led !== activeLEDs[index]);

        if (!isStateChanged) {
            // Se lo stato non è cambiato, non inviare nulla
            return;
        }

        // Aggiorna lo stato precedente
        lastSentLEDState = [...activeLEDs];

        let commands = "";

        // Costruisci i comandi per tutti i LED
        for (let i = 1; i <= availableLEDs; i++) {
            if (activeLEDs.includes(i)) {
                commands += `LED${i}ON,`;
            } else {
                commands += `LED${i}OFF,`;
            }
        }

        commands += "STOP\n"; // Fine sequenza comandi

        // Invia i comandi
        await writer.write(commands);
        // Log nel monitor seriale
        sendToSerialMonitor(commands.trim(), "tx");
    }
}

// Start the application
init();
