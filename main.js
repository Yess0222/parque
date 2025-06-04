import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { VRButton } from "three/addons/webxr/VRButton.js";

// --- Audio with Howler.js ---
const sounds = {
  backgroundMusic: new Howl({
    src: ["./sfx/music.ogg"],
    loop: true,
    volume: 0.3,
    preload: true,
  }),

  projectsSFX: new Howl({
    src: ["./sfx/projects.ogg"],
    volume: 0.5,
    preload: true,
  }),

  pokemonSFX: new Howl({
    src: ["./sfx/pokemon.ogg"],
    volume: 0.5,
    preload: true,
  }),

  jumpSFX: new Howl({
    src: ["./sfx/jumpsfx.ogg"],
    volume: 1.0,
    preload: true,
  }),
};

let touchHappened = false;
let isMuted = false;

function playSound(soundId) {
  if (!isMuted && sounds[soundId]) {
    sounds[soundId].play();
  }
}

function stopSound(soundId) {
  if (sounds[soundId]) {
    sounds[soundId].stop();
  }
}

// --- Three.js setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaec972);
const canvas = document.getElementById("experience-canvas");
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Physics stuff
const GRAVITY = 30;
const CAPSULE_RADIUS = 0.35;
const CAPSULE_HEIGHT = 1;
const JUMP_HEIGHT = 11;
const MOVE_SPEED = 7;

let character = {
  instance: null,
  isMoving: false,
  spawnPosition: new THREE.Vector3(),
};
let targetRotation = Math.PI / 2;

const colliderOctree = new Octree();
const playerCollider = new Capsule(
  new THREE.Vector3(0, CAPSULE_RADIUS, 0),
  new THREE.Vector3(0, CAPSULE_HEIGHT, 0),
  CAPSULE_RADIUS
);

let playerVelocity = new THREE.Vector3();
let playerOnFloor = false;

// Renderer Stuff
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;

// --- CONFIGURACIÓN PARA VR ---
renderer.xr.enabled = true; // ¡HABILITAR EL RENDERIZADOR PARA WEBXR!

// Some of our DOM elements, others are scattered in the file
let isModalOpen = false;
const modal = document.querySelector(".modal");
const modalbgOverlay = document.querySelector(".modal-bg-overlay");
const modalTitle = document.querySelector(".modal-title");
const modalProjectDescription = document.querySelector(
  ".modal-project-description"
);
const modalExitButton = document.querySelector(".modal-exit-button");
const modalVisitProjectButton = document.querySelector(
  ".modal-project-visit-button"
);
const themeToggleButton = document.querySelector(".theme-mode-toggle-button");
const firstIcon = document.querySelector(".first-icon");
const secondIcon = document.querySelector(".second-icon");

const audioToggleButton = document.querySelector(".audio-toggle-button");
const firstIconTwo = document.querySelector(".first-icon-two");
const secondIconTwo = document.querySelector(".second-icon-two"); // Corrected to use querySelector

// Modal stuff (sin cambios, ya definido)
const modalContent = {
  Project_1: {
    title: "🍜Recipe Finder👩🏻‍🍳",
    content:
      "Let's get cooking! This project uses TheMealDB API for some recipes and populates my React card components. This shows my skills in working with consistent design systems using components. There is also pagination to switch pages.",
    link: "https://example.com/",
  },
  Project_2: {
    title: "📋ToDo List✏️",
    content:
      "Keeping up with everything is really exhausting so I wanted to create my own ToDo list app. But I wanted my ToDo list to look like an actual ToDo list so I used Tailwind CSS for consistency and also did state management with React hooks like useState.",
    link: "https://example.com/",
  },
  Project_3: {
    title: "🌞Weather App😎",
    content:
      "Rise and shine as they say (but sometimes it's not all that shiny outside). Using a location-based API the user can automatically detect their location and my application will show them the weather near them. I also put some of my design skills to use using Figma.",
    link: "https://example.com/",
  },
  Chest: {
    title: "💁‍♀️ About Me",
    content:
      "Hi you found my chest👋, I'm Bella Xu and I am an aspiring creative developer and designer. I just started web development this year! In the signs, you will see some of my most recent projects that I'm proud of. I hope to add a lot more in the future. In my free time, I like to draw, watch TV shows (especially Pokémon), do clay sculpting and needle felting. Reach out if you wanna chat. Bella is OUT!!! 🏃‍♀️",
  },
  Picnic: {
    title: "🍷 Uggh yesss 🧺",
    content:
      " Picnics are my thanggg don't @ me. Lying down with some good grape juice inna wine glass and a nice book at a park is my total vibe. If this isn't max aura points 💯 idk what is.",
  },
};

function showModal(id) {
  const content = modalContent[id];
  if (content) {
    modalTitle.textContent = content.title;
    modalProjectDescription.textContent = content.content;

    if (content.link) {
      modalVisitProjectButton.href = content.link;
      modalVisitProjectButton.classList.remove("hidden");
    } else {
      modalVisitProjectButton.classList.add("hidden");
    }
    modal.classList.remove("hidden");
    modalbgOverlay.classList.remove("hidden");
    isModalOpen = true;
  }
}

function hideModal() {
  isModalOpen = false;
  modal.classList.add("hidden");
  modalbgOverlay.classList.add("hidden");
  if (!isMuted) {
    playSound("projectsSFX");
  }
}

// Our Intersecting objects
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(); // Usado para mouse/touch

let intersectObject = "";
const intersectObjects = [];
const intersectObjectsNames = [
  "Project_1",
  "Project_2",
  "Project_3",
  "Picnic",
  "Squirtle",
  "Chicken",
  "Pikachu",
  "Bulbasaur",
  "Charmander",
  "Snorlax",
  "Chest",
];

// Loading screen and loading manager (sin cambios, ya definido)
const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.querySelector(".loading-text");
const enterButton = document.querySelector(".enter-button");
const instructions = document.querySelector(".instructions");

const manager = new THREE.LoadingManager();

manager.onLoad = function () {
  const t1 = gsap.timeline();

  t1.to(loadingText, {
    opacity: 0,
    duration: 0,
  });

  t1.to(enterButton, {
    opacity: 1,
    duration: 0,
  });
};

enterButton.addEventListener("click", () => {
  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0,
  });
  gsap.to(instructions, {
    opacity: 0,
    duration: 0,
    onComplete: () => {
      loadingScreen.remove();
    },
  });

  if (!isMuted) {
    playSound("projectsSFX");
    playSound("backgroundMusic");
  }
});

// GLTF Loader (sin cambios, ya definido)
const loader = new GLTFLoader(manager);

// A parent object for the character and VR camera
// This will be the "player rig" that moves the whole VR experience
const playerRig = new THREE.Group();
scene.add(playerRig);

loader.load(
  "./Portfolio.glb",
  function (glb) {
    glb.scene.traverse((child) => {
      if (intersectObjectsNames.includes(child.name)) {
        intersectObjects.push(child);
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }

      if (child.name === "Character") {
        character.spawnPosition.copy(child.position);
        character.instance = child;
        playerRig.add(character.instance); // Attach character to playerRig
        character.instance.position.set(0, 0, 0); // Reset character's local position if it's part of the rig
        playerRig.position.copy(character.spawnPosition); // Move the rig to the spawn position

        playerCollider.start
          .copy(character.spawnPosition)
          .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
        playerCollider.end
          .copy(character.spawnPosition)
          .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
      }
      if (child.name === "Ground_Collider") {
        colliderOctree.fromGraphNode(child);
        child.visible = false;
      }
    });
    scene.add(glb.scene); // Add the rest of the scene elements normally
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

// Lighting and Environment Stuff (sin cambios, ya definido)
const sun = new THREE.DirectionalLight(0xffffff);
sun.castShadow = true;
sun.position.set(280, 200, -80);
sun.target.position.set(100, 0, -10);
sun.shadow.mapSize.width = 4096;
sun.shadow.mapSize.height = 4096;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -100;
sun.shadow.normalBias = 0.2;
scene.add(sun.target);
scene.add(sun);

const light = new THREE.AmbientLight(0x404040, 2.7);
scene.add(light);

// --- CÁMARA: CAMBIO CRÍTICO PARA VR ---
// La cámara de Three.js para VR es de tipo PerspectiveCamera.
// La posición y rotación son manejadas por el casco VR.
// Mantendremos una cámara "normal" para el modo de escritorio,
// pero el renderizador usará la cámara VR cuando la sesión esté activa.
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  1000
);

// Add camera to the player rig. This means the camera will move with the rig in VR.
// In desktop mode, we will still control the camera directly.
playerRig.add(camera);

// Posición inicial de la cámara en modo de escritorio.
// En VR, esta posición será ignorada y reemplazada por la del casco.
// When attached to playerRig, the camera position is relative to the rig.
// For desktop, we will manage the camera's world position directly.
const cameraOffset = new THREE.Vector3(-13, 39, -67); // Initial offset from character spawn

// Los OrbitControls son útiles para depuración en desktop, pero no para VR.
const controls = new OrbitControls(camera, canvas);
controls.enabled = false; // Disable by default, enable only for desktop debug if needed
controls.update();

// Handle when window resizes (modificado para WebXR)
function onResize() {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Ajusta la cámara solo si no estamos en una sesión XR
  if (!renderer.xr.isPresenting) {
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
  }

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Interact with Objects and Raycaster (sin cambios, ya definido)
let isCharacterReady = true;

function jumpCharacter(meshID) {
  if (!isCharacterReady) return;

  const mesh = scene.getObjectByName(meshID);
  if (!mesh) return; // Ensure mesh exists

  const jumpHeight = 2;
  const jumpDuration = 0.5;
  const isSnorlax = meshID === "Snorlax";

  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

  const t1 = gsap.timeline({
    onComplete: () => {
      isCharacterReady = true;
    },
  });

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1.2,
    y: isSnorlax ? currentScale.y * 0.8 : 0.8,
    z: isSnorlax ? currentScale.z * 1.2 : 1.2,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 0.8 : 0.8,
    y: isSnorlax ? currentScale.y * 1.3 : 1.3,
    z: isSnorlax ? currentScale.z * 0.8 : 0.8,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  t1.to(
    mesh.position,
    {
      y: mesh.position.y + jumpHeight,
      duration: jumpDuration * 0.5,
      ease: "power2.out",
    },
    "<"
  );

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1,
    y: isSnorlax ? currentScale.y * 1.2 : 1,
    z: isSnorlax ? currentScale.z * 1.2 : 1,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  t1.to(
    mesh.position,
    {
      y: mesh.position.y,
      duration: jumpDuration * 0.5,
      ease: "bounce.out",
    },
    ">"
  );

  if (!isSnorlax) {
    t1.to(mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: jumpDuration * 0.2,
      ease: "elastic.out(1, 0.3)",
    });
  }
  isCharacterReady = false; // Set to false when animation starts
}

// Global variable to store VR controller instances
const controllers = [];
const tempMatrix = new THREE.Matrix4(); // For controller raycasting

// --- VR Controller Setup ---
function setupVRControllers() {
  // Controller 0
  const controller0 = renderer.xr.getController(0);
  controller0.addEventListener("selectstart", onSelectStart);
  controller0.addEventListener("selectend", onSelectEnd);
  playerRig.add(controller0); // Add controller to player rig

  const controllerModel0 = renderer.xr.getControllerModel(0);
  controller0.add(controllerModel0);

  controllers.push(controller0);

  // Controller 1
  const controller1 = renderer.xr.getController(1);
  controller1.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectend", onSelectEnd);
  playerRig.add(controller1);

  const controllerModel1 = renderer.xr.getControllerModel(1);
  controller1.add(controllerModel1);

  controllers.push(controller1);
}

// Ray from controller
const controllerHelperGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1),
]);
const controllerHelperMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  linewidth: 2,
});

function onSelectStart(event) {
  const controller = event.target;
  // Trigger interaction when "select" (trigger) is pressed on a VR controller
  handleInteraction(controller);
}

function onSelectEnd(event) {
  // Handle any 'release' logic for VR controllers if needed
}

// Modificado para VR: handleInteraction necesitará considerar la cámara VR o controladores
function handleInteraction(controller = null) {
  if (!modal.classList.contains("hidden")) {
    return;
  }

  // If we are in VR, the raycaster should be based on the VR camera or a controller
  if (renderer.xr.isPresenting) {
    if (controller) {
      // Use controller's orientation for raycasting
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    } else {
      // Fallback: use VR camera (headset) gaze for raycasting if no controller is used
      // This happens if you interact via gaze (e.g., on some standalone headsets without controllers)
      const xrCamera = renderer.xr.getCamera(camera);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), xrCamera); // Center of the VR view
    }
  } else {
    // Desktop mode (mouse/touch)
    raycaster.setFromCamera(pointer, camera);
  }

  const intersects = raycaster.intersectObjects(intersectObjects);

  if (intersects.length > 0) {
    intersectObject = intersects[0].object.parent.name;
  } else {
    intersectObject = "";
  }

  if (intersectObject !== "") {
    if (
      [
        "Bulbasaur",
        "Chicken",
        "Pikachu",
        "Charmander",
        "Squirtle",
        "Snorlax",
      ].includes(intersectObject)
    ) {
      if (isCharacterReady) {
        if (!isMuted) {
          playSound("pokemonSFX");
        }
        jumpCharacter(intersectObject);
        // isCharacterReady is now set to false inside jumpCharacter via timeline
      }
    } else {
      if (intersectObject) {
        showModal(intersectObject);
        if (!isMuted) {
          playSound("projectsSFX");
        }
      }
    }
  }
}

// onMouseMove, onTouchEnd, onKeyDown, onKeyUp, mobileControls:
// These desktop/mobile input events will not be used directly in VR.
// Keep them for 2D mode, but consider how to handle movement in VR.

function onMouseMove(event) {
  if (renderer.xr.isPresenting) return; // Ignore in VR
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  touchHappened = false;
}

function onTouchEnd(event) {
  if (renderer.xr.isPresenting) return; // Ignore in VR
  // For touch, you might want to use event.changedTouches[0].clientX/Y
  // but for simplicity, using clientX/Y directly for now.
  pointer.x = (event.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.changedTouches[0].clientY / window.innerHeight) * 2 + 1;

  touchHappened = true;
  handleInteraction();
}

// Movement and Gameplay functions (estas funciones controlan el movimiento del personaje)
// In VR, you'll need a different way to move the character,
// probably using VR controllers (e.g., teleportation or virtual joysticks).
// For now, the character will stay at its spawn position if no VR controls are implemented.
function respawnCharacter() {
  playerRig.position.copy(character.spawnPosition); // Reset rig position
  playerVelocity.set(0, 0, 0);
  playerOnFloor = false; // Assume not on floor until collision check
  character.isMoving = false;

  // Recalculate playerCollider based on new playerRig position
  const tempPlayerRigPosition = new THREE.Vector3();
  playerRig.getWorldPosition(tempPlayerRigPosition);

  playerCollider.start
    .copy(tempPlayerRigPosition)
    .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
  playerCollider.end
    .copy(tempPlayerRigPosition)
    .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
}

function playerCollisions() {
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    if (playerOnFloor) {
      // character.isMoving = false; // Only if movement is based on impulse, not continuous
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

// VR movement variables
const vrMovementDirection = new THREE.Vector3();
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();

function updatePlayer() {
  if (!character.instance) return;

  // Apply gravity to playerVelocity
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035;
  }

  // --- VR Movement Logic ---
  if (renderer.xr.isPresenting) {
    // Get the head-mounted display's (HMD) current orientation
    const xrCamera = renderer.xr.getCamera(camera);
    xrCamera.getWorldDirection(forwardVector); // Get forward direction of the HMD
    forwardVector.y = 0; // Keep movement on the horizontal plane
    forwardVector.normalize();

    rightVector.crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)); // Get right direction
    rightVector.normalize();

    vrMovementDirection.set(0, 0, 0);

    // Basic VR controller movement (e.g., left thumbstick)
    // This is a simplified example. You'd typically check for `gamepad.axes`
    // from a specific controller (e.g., left controller).
    // For demonstration, let's assume moving forward based on HMD if no controller input.
    // ** You'll need to add proper controller input handling here **
    for (const controller of controllers) {
      if (controller.gamepad) {
        // Example for a left controller thumbstick (axes[2], axes[3])
        // Axes values are typically between -1 and 1
        const axes = controller.gamepad.axes;
        if (axes && axes.length >= 4) {
          const thumbstickX = axes[2]; // Horizontal axis (left/right)
          const thumbstickY = axes[3]; // Vertical axis (forward/backward)

          // Adjust movement based on thumbstick input relative to HMD orientation
          vrMovementDirection.addScaledVector(forwardVector, -thumbstickY); // Y-axis: forward/backward
          vrMovementDirection.addScaledVector(rightVector, thumbstickX); // X-axis: left/right
        }
      }
    }

    if (vrMovementDirection.lengthSq() > 0) {
      vrMovementDirection.normalize().multiplyScalar(MOVE_SPEED);
      playerVelocity.x = vrMovementDirection.x;
      playerVelocity.z = vrMovementDirection.z;
    } else {
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }

    // Adjust the character's rotation to match the HMD's horizontal rotation
    // This makes the character face the direction the user is looking.
    character.instance.rotation.y = Math.atan2(forwardVector.x, forwardVector.z);

  } else {
    // --- Desktop Movement Logic (existing) ---
    // Calculate movement for desktop mode
    const inputDirection = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement on horizontal plane
    cameraDirection.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
    right.normalize();

    if (pressedButtons.up) inputDirection.add(cameraDirection);
    if (pressedButtons.down) inputDirection.sub(cameraDirection);
    if (pressedButtons.left) inputDirection.add(right);
    if (pressedButtons.right) inputDirection.sub(right);

    if (inputDirection.lengthSq() > 0) {
      inputDirection.normalize().multiplyScalar(MOVE_SPEED);
      playerVelocity.x = inputDirection.x;
      playerVelocity.z = inputDirection.z;

      // Smoothly rotate character to face movement direction
      targetRotation = Math.atan2(playerVelocity.x, playerVelocity.z);
      let rotationDiff =
        ((((targetRotation - character.instance.rotation.y) % (2 * Math.PI)) +
          3 * Math.PI) %
          (2 * Math.PI)) -
        Math.PI;
      let finalRotation = character.instance.rotation.y + rotationDiff;
      character.instance.rotation.y = THREE.MathUtils.lerp(
        character.instance.rotation.y,
        finalRotation,
        0.4
      );
      character.isMoving = true;
      handleJumpAnimation(); // Trigger jump animation on desktop movement
    } else {
      playerVelocity.x = 0;
      playerVelocity.z = 0;
      character.isMoving = false;
    }
  }

  // --- Common physics updates (applies to both VR and Desktop) ---
  // Apply the velocity to the player capsule
  playerCollider.translate(playerVelocity.clone().multiplyScalar(0.035));

  playerCollisions();

  // Move the playerRig (which contains the character and camera in VR)
  // to the position of the capsule collider.
  playerRig.position.copy(playerCollider.start);
  playerRig.position.y -= CAPSULE_RADIUS; // Adjust for capsule's base

  // Respawn if character falls too far
  if (playerRig.position.y < -20) {
    respawnCharacter();
    return;
  }
}

// onKeyDown y onKeyUp: Controlan el movimiento con teclado.
// Estos eventos solo deben afectar el movimiento si NO estamos en VR.
function onKeyDown(event) {
  if (renderer.xr.isPresenting) return; // Ignore in VR
  if (event.code.toLowerCase() === "keyr") {
    respawnCharacter();
    return;
  }

  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = true;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = true;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = true;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = true;
      break;
    case "space": // Added space for jump in desktop
        if (playerOnFloor) {
            playerVelocity.y = JUMP_HEIGHT;
            if (!isMuted) {
                playSound("jumpSFX");
            }
        }
        break;
  }
}

function onKeyUp(event) {
  if (renderer.xr.isPresenting) return; // Ignore in VR
  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = false;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = false;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = false;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = false;
      break;
  }
}

// Toggle Theme Function (sin cambios, ya definido)
function toggleTheme() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  const isDarkTheme = document.body.classList.contains("dark-theme");
  document.body.classList.toggle("dark-theme");
  document.body.classList.toggle("light-theme");

  if (firstIcon.style.display === "none") {
    firstIcon.style.display = "block";
    secondIcon.style.display = "none";
  } else {
    firstIcon.style.display = "none";
    secondIcon.style.display = "block";
  }

  gsap.to(light.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.31,
    b: isDarkTheme ? 1.0 : 0.78,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(light, {
    intensity: isDarkTheme ? 0.8 : 0.9,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun, {
    intensity: isDarkTheme ? 1 : 0.8,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.41,
    b: isDarkTheme ? 1.0 : 0.88,
    duration: 1,
    ease: "power2.inOut",
  });
}

// Toggle Audio Function (sin cambios, ya definido)
function toggleAudio() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  if (firstIconTwo.style.display === "none") {
    firstIconTwo.style.display = "block";
    secondIconTwo.style.display = "none";
    isMuted = false;
    sounds.backgroundMusic.play();
  } else {
    firstIconTwo.style.display = "none";
    secondIconTwo.style.display = "block";
    isMuted = true;
    sounds.backgroundMusic.pause();
  }
}

// Mobile controls (sin cambios, pero solo afectarán el modo desktop)
const mobileControls = {
  up: document.querySelector(".mobile-control.up-arrow"),
  left: document.querySelector(".mobile-control.left-arrow"),
  right: document.querySelector(".mobile-control.right-arrow"),
  down: document.querySelector(".mobile-control.down-arrow"),
};

const pressedButtons = {
  up: false,
  left: false,
  right: false,
  down: false,
};

function handleJumpAnimation() {
  if (!character.instance || character.isMoving) return; // Only trigger if not already moving

  const jumpDuration = 0.5;
  const t1 = gsap.timeline();

  t1.to(character.instance.scale, {
    x: 1.08,
    y: 0.9,
    z: 1.08,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    x: 0.92,
    y: 1.1,
    z: 0.92,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  t1.to(character.instance.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: jumpDuration * 0.2,
  });
}

function handleContinuousMovement() {
  // Movement logic is now primarily within updatePlayer to integrate VR input
  // This function can be simplified or removed if all movement input is in updatePlayer
}

Object.entries(mobileControls).forEach(([direction, element]) => {
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = true;
  });

  element.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = true;
  });

  element.addEventListener("mouseup", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("mouseleave", (e) => {
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("touchcancel", (e) => {
    if (renderer.xr.isPresenting) return; // Ignore in VR
    pressedButtons[direction] = false;
  });
});

window.addEventListener("blur", () => {
  Object.keys(pressedButtons).forEach((key) => {
    pressedButtons[key] = false;
  });
});

// Adding Event Listeners
modalExitButton.addEventListener("click", hideModal);
modalbgOverlay.addEventListener("click", hideModal);
themeToggleButton.addEventListener("click", toggleTheme);
audioToggleButton.addEventListener("click", toggleAudio);
window.addEventListener("resize", onResize);
window.addEventListener("click", onClick, { passive: false });
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("touchend", onTouchEnd, { passive: false });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// --- INICIALIZACIÓN DEL BOTÓN VR ---
// Asegúrate de que el botón se cree DESPUÉS de que el renderer esté configurado
document.getElementById("vr-button-container").appendChild(VRButton.createButton(renderer));

// Handle VR session start/end
renderer.xr.addEventListener("sessionstart", () => {
  console.log("VR Session Started");
  // Hide desktop UI elements
  document.querySelectorAll(".ui-overlay").forEach(el => el.style.display = "none");
  // Set camera to be relative to playerRig for VR
  camera.position.set(0, 1.6, 0); // Typical standing height in VR
  camera.rotation.set(0, 0, 0); // Reset rotation (HMD will control)
  controls.enabled = false; // Disable OrbitControls in VR
  setupVRControllers(); // Set up VR controllers when session starts
});

renderer.xr.addEventListener("sessionend", () => {
  console.log("VR Session Ended");
  // Show desktop UI elements
  document.querySelectorAll(".ui-overlay").forEach(el => el.style.display = "block");
  // Reset camera for desktop mode
  camera.position.copy(playerRig.position).add(cameraOffset); // Re-apply desktop offset
  camera.lookAt(playerRig.position); // Look at the character's position
  controls.enabled = true; // Re-enable OrbitControls for desktop
  // Clean up controllers
  controllers.forEach(controller => {
    controller.removeEventListener("selectstart", onSelectStart);
    controller.removeEventListener("selectend", onSelectEnd);
    playerRig.remove(controller);
    controller.children.forEach(child => controller.remove(child)); // Remove models
  });
  controllers.length = 0; // Clear the array
});


// --- Bucle de Animación para VR ---
// Three.js se encargará de llamar a `animate` en el momento adecuado para VR.
function animate() {
  updatePlayer();
  // handleContinuousMovement(); // This is now integrated into updatePlayer for both modes

  // The camera logic changes depending on whether we are in VR or not
  if (!renderer.xr.isPresenting) {
    // Desktop camera logic
    // The camera is no longer a child of playerRig in desktop mode conceptually,
    // we set its world position directly.
    if (character.instance) {
      const targetCameraPosition = new THREE.Vector3().copy(playerRig.position).add(cameraOffset);
      camera.position.copy(targetCameraPosition);
      camera.lookAt(
        playerRig.position.x + 10,
        playerRig.position.y,
        playerRig.position.z + 10
      );
      controls.update(); // Update orbit controls if they are enabled for desktop
    }
  } else {
    // VR logic: Three.js handles the VR camera via the playerRig.
    // We just need to ensure the controllers are updated and their rays drawn.
    for (const controller of controllers) {
        // Update controller ray visual
        const ray = new THREE.Line(controllerHelperGeometry, controllerHelperMaterial);
        ray.scale.z = raycaster.ray.origin.distanceTo(raycaster.ray.intersectObjects(intersectObjects, true)[0]?.point || new THREE.Vector3().addVectors(raycaster.ray.origin, raycaster.ray.direction.multiplyScalar(10)));
        controller.add(ray); // Add ray to controller if not already present, or update existing one
    }
  }

  // The raycasting for interaction is called in `handleInteraction()`
  // The mouse cursor visualization should only occur in desktop mode
  if (!renderer.xr.isPresenting) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(intersectObjects);

    if (intersects.length > 0) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "default";
      intersectObject = ""; // Reset when no intersections
    }
  } else {
    // In VR, there is no mouse cursor. Interaction feedback would be visual (e.g., a laser ray from the controller)
    document.body.style.cursor = "default"; // Ensure cursor is not "pointer" in VR
  }

  // renderer.render(scene, camera); // This is implicitly called by renderer.setAnimationLoop
}

// This is the new animation loop. It replaces your `renderer.setAnimationLoop(animate);`!
renderer.setAnimationLoop(animate);