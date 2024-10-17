import * as THREE from "three";

export function initControls(
    renderer,
    camera,
    ledStrips,
    selectStrip,
    deselectStrip
) {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let isDragging = false;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener("mousedown", onMouseDown, false);
    renderer.domElement.addEventListener("mousemove", onMouseMove, false);
    renderer.domElement.addEventListener("mouseup", onMouseUp, false);
    renderer.domElement.addEventListener("click", onMouseClick, false);

    // Event handler per mousedown
    function onMouseDown(event) {
        isMouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
        isDragging = false;
    }

    // Event handler per mousemove
    function onMouseMove(event) {
        if (isMouseDown) {
            const dx = event.clientX - mouseX;
            const dy = event.clientY - mouseY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                isDragging = true;
            }
        }
    }

    // Event handler per mouseup
    function onMouseUp(event) {
        isMouseDown = false;
    }

    // Event handler per click del mouse (selezione della striscia)
    function onMouseClick(event) {
        // Se l'utente sta trascinando la scena, non fare nulla
        if (isDragging) return;

        // Calcola la posizione normalizzata del mouse
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x =
            ((event.clientX - rect.left) / renderer.domElement.clientWidth) *
                2 -
            1;
        mouse.y =
            -((event.clientY - rect.top) / renderer.domElement.clientHeight) *
                2 +
            1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(
            ledStrips.map(function (stripObj) {
                return stripObj.mesh;
            }),
            true // Includi gli oggetti figli
        );

        if (intersects.length > 0) {
            const intersectedMesh = intersects[0].object;
            const stripObj = ledStrips.find(function (stripObj) {
                return (
                    stripObj.mesh === intersectedMesh ||
                    stripObj.mesh === intersectedMesh.parent
                );
            });
            if (stripObj) {
                selectStrip(stripObj);
            }
        } else {
            // Deseleziona la striscia se si clicca su uno spazio vuoto
            deselectStrip();
        }
    }
}
