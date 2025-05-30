import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // Keep for non-VR desktop fallback
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
// Import the WebXRButton from Three.js examples
import { ARButton } from "three/addons/webxr/ARButton.js"; // We will use ARButton to create the "Enter VR" button

// --- VR Specific Imports and Variables ---
let vrEnabled = false; // Flag to check if we are in VR mode
let xrCamera; // This will be the VR camera provided by WebXR
let playerControls; // To handle movement in VR, we'll need a different approach than keyboard/mouse
const dummyCamera = new THREE.Object3D(); // A dummy object to represent the VR camera's position in the scene

// DECLARE hand1 and hand2 here, but DON'T initialize them yet
let hand1;
let hand2;

// Audio with Howler.js
// Make sure Howl is imported or defined globally (e.g., from a CDN script tag)
// For example, if using a CDN, you'd have something like:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
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

//three.js setup
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

// --- WebXR Enablement ---
renderer.xr.enabled = true; // Crucial step to enable WebXR
document.getElementById("vr-button-container").appendChild(
  ARButton.createButton(renderer, {
    sessionInit: {
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"], // Optional features for better VR experience
    },
  })
);

// Listen for VR session start and end
renderer.xr.addEventListener("sessionstart", () => {
  vrEnabled = true;
  // Hide UI elements not relevant in VR
  document.querySelector(".theme-mode-toggle-button").style.display = "none";
  document.querySelector(".audio-toggle-button").style.display = "none";
  document.querySelector(".mobile-control.up-arrow").style.display = "none";
  document.querySelector(".mobile-control.left-arrow").style.display = "none";
  document.querySelector(".mobile-control.right-arrow").style.display = "none";
  document.querySelector(".mobile-control.down-arrow").style.display = "none";

  // Get the XR camera which will be controlling the view
  // Note: 'camera' here usually refers to your desktop camera,
  // xr.getCamera will return a WebXRCamera that wraps the original camera.
  xrCamera = renderer.xr.getCamera(camera);

  // ******* FIX: Initialize hand controllers AFTER session starts *******
  hand1 = renderer.xr.getController(0); // For left hand controller
  hand2 = renderer.xr.getController(1); // For right hand controller

  // Add the controllers to the scene so their position and orientation are updated
  scene.add(hand1);
  scene.add(hand2);

  // Optional: Add visual models for controllers if you have them
  // You would typically define a function `buildController(data)` somewhere
  // that returns a mesh or object representing the controller.
  // hand1.addEventListener('connected', function (event) {
  //     this.add(buildController(event.data));
  // });
  // hand2.addEventListener('connected', function (event) {
  //     this.add(buildController(event.data));
  // });
  // hand1.addEventListener('disconnected', function () {
  //     this.remove(this.children[0]);
  // });
  // hand2.addEventListener('disconnected', function () {
  //     this.remove(this.children[0]);
  // });


  if (character.instance) {
    character.instance.position.set(0, 0, 0); // Reset character position relative to its new parent
    dummyCamera.position.copy(playerCollider.start); // Initialize dummy camera to player's current position
    scene.add(dummyCamera); // Add the dummy camera to the scene
    dummyCamera.add(character.instance);
  }

  // Hide the loading screen if it's still visible
  // Make sure `gsap` and `loadingScreen` are defined and accessible
  if (typeof gsap !== 'undefined' && loadingScreen) {
      gsap.to(loadingScreen, { opacity: 0, duration: 0, onComplete: () => { loadingScreen.remove(); } });
  }

  if (!isMuted) {
    playSound("backgroundMusic");
  }
});

renderer.xr.addEventListener("sessionend", () => {
  vrEnabled = false;
  // Show UI elements again
  document.querySelector(".theme-mode-toggle-button").style.display = "block";
  document.querySelector(".audio-toggle-button").style.display = "block";
  document.querySelector(".mobile-control.up-arrow").style.display = "block";
  document.querySelector(".mobile-control.left-arrow").style.display = "block";
  document.querySelector(".mobile-control.right-arrow").style.display = "block";
  document.querySelector(".mobile-control.down-arrow").style.display = "block";

  // Revert character parenting
  if (character.instance) {
    scene.add(character.instance);
    character.instance.position.copy(dummyCamera.position); // Restore character's global position
    scene.remove(dummyCamera); // Remove the dummy camera from the scene
  }
});

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
const secondIconTwo = document.querySelector(".second-icon-two");

// Modal stuff
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
const pointer = new THREE.Vector2();

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

// Loading screen and loading manager
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
  // Only hide loading screen if not in VR
  if (!vrEnabled) {
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
  }

  if (!isMuted) {
    playSound("projectsSFX");
    playSound("backgroundMusic");
  }
});

//Audio

// GLTF Loader
const loader = new GLTFLoader(manager);

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
        playerCollider.start
          .copy(child.position)
          .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
        playerCollider.end
          .copy(child.position)
          .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
      }
      if (child.name === "Ground_Collider") {
        colliderOctree.fromGraphNode(child);
        child.visible = false;
      }
    });
    scene.add(glb.scene);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

// Lighting and Enviornment Stuff
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

// Camera Stuff - This will be the desktop camera. In VR, xrCamera will be used.
const aspect = sizes.width / sizes.height;
const camera = new THREE.OrthographicCamera(
  -aspect * 50,
  aspect * 50,
  50,
  -50,
  1,
  1000
);

camera.position.x = -13;
camera.position.y = 39;
camera.position.z = -67;

const cameraOffset = new THREE.Vector3(-13, 39, -67);

camera.zoom = 2.2;
camera.updateProjectionMatrix();

const controls = new OrbitControls(camera, canvas); // Keep for desktop mode
controls.update();

// Handle when window resizes
function onResize() {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  const aspect = sizes.width / sizes.height;

  // Only update the perspective camera if not in VR
  if (!vrEnabled) {
    camera.left = -aspect * 50;
    camera.right = aspect * 50;
    camera.top = 50;
    camera.bottom = -50;
    camera.updateProjectionMatrix();
  }

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Interact with Objects and Raycaster
let isCharacterReady = true;

function jumpCharacter(meshID) {
  if (!isCharacterReady) return;

  const mesh = scene.getObjectByName(meshID);
  const jumpHeight = 2;
  const jumpDuration = 0.5;
  const isSnorlax = meshID === "Snorlax";

  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

  const t1 = gsap.timeline(); // Make sure gsap is included in your project

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
      onComplete: () => {
        isCharacterReady = true;
      },
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
}

function onClick() {
  if (touchHappened) return;
  handleInteraction();
}

function handleInteraction() {
  if (!modal.classList.contains("hidden")) {
    return;
  }

  // --- Interaction in VR vs Desktop ---
  let currentCamera = vrEnabled ? xrCamera : camera; // Use the appropriate camera
  raycaster.setFromCamera(pointer, currentCamera); // Raycast from the correct camera
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
        isCharacterReady = false;
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

function onMouseMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  touchHappened = false;
}

function onTouchEnd(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  touchHappened = true;
  handleInteraction();
}

// Movement and Gameplay functions
function respawnCharacter() {
  character.instance.position.copy(character.spawnPosition);

  playerCollider.start
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
  playerCollider.end
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));

  playerVelocity.set(0, 0, 0);
  playerOnFloor = false; // Reset playerOnFloor state
  character.isMoving = false;
}

function playerCollisions() {
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false; // Reset before checking

  if (result) {
    playerOnFloor = result.normal.y > 0;
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    if (playerOnFloor) {
      // character.isMoving = false; // This might be too aggressive, better let input decide
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function updatePlayer(delta) {
  // Pass delta for frame-rate independent movement
  if (!character.instance) return;

  if (character.instance.position.y < -20) {
    respawnCharacter();
    return;
  }

  // Apply gravity
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * delta;
  }

  // Update player collider based on velocity
  playerCollider.translate(playerVelocity.clone().multiplyScalar(delta));

  playerCollisions(); // Check for collisions after moving

  // Update character instance position from collider
  character.instance.position.copy(playerCollider.start);
  character.instance.position.y -= CAPSULE_RADIUS;

  // --- VR Movement Integration ---
  if (vrEnabled) {
    dummyCamera.position.copy(playerCollider.start);
    dummyCamera.position.y -= CAPSULE_RADIUS; // Adjust for capsule's base

    // Handle VR controller input for movement if playerControls is implemented
    // Example (conceptual):
    // if (hand1 && hand1.userData.isMovingForward) {
    //     // Move character forward based on hand1's orientation
    // }
  } else {
    // Existing desktop rotation logic
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
  }
}

function onKeyDown(event) {
  if (event.code.toLowerCase() === "keyr") {
    respawnCharacter();
    return;
  }

  // Only respond to keyboard input if not in VR
  if (!vrEnabled) {
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
      case "space": // Added spacebar for jump on desktop
        if (playerOnFloor) {
          playerVelocity.y = JUMP_HEIGHT;
          if (!isMuted) {
            playSound("jumpSFX");
          }
          character.isMoving = true;
          handleJumpAnimation();
        }
        break;
    }
  }
}

function onKeyUp(event) {
  // Only respond to keyboard input if not in VR
  if (!vrEnabled) {
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
}

// Toggle Theme Function
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

// Toggle Audio Function
function toggleAudio() {
  if (!isMuted) {
    // Only play sound if it's currently unmuted. If it's about to be muted, don't play.
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

// Mobile controls
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
  if (!character.instance || !character.isMoving) return;

  const jumpDuration = 0.5;
  // const jumpHeight = 2; // Jump height is now controlled by playerVelocity.y and JUMP_HEIGHT

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

// --- Modified handleContinuousMovement for VR considerations ---
function handleContinuousMovement() {
  if (!character.instance) return;

  if (vrEnabled) {
    // You would implement VR movement here, e.g., based on controller input
    // For example, if you want to move the player with the left controller's joystick/thumbpad:
    // if (hand1 && hand1.gamepad && hand1.gamepad.axes[2] !== 0) { // Check for joystick X-axis
    //     // Move character based on hand1's orientation and joystick input
    //     // This is a complex topic and would require more code for VR locomotion
    // }
  } else {
    // Original desktop/mobile movement logic
    if (Object.values(pressedButtons).some((pressed) => pressed)) {
      playerVelocity.set(0, playerVelocity.y, 0); // Reset horizontal velocity each frame to prevent compounding
      if (pressedButtons.up) {
        playerVelocity.z -= MOVE_SPEED;
        targetRotation = 0;
      }
      if (pressedButtons.down) {
        playerVelocity.z += MOVE_SPEED;
        targetRotation = Math.PI;
      }
      if (pressedButtons.left) {
        playerVelocity.x -= MOVE_SPEED;
        targetRotation = Math.PI / 2;
      }
      if (pressedButtons.right) {
        playerVelocity.x += MOVE_SPEED;
        targetRotation = -Math.PI / 2;
      }
      character.isMoving = true;
    } else {
      character.isMoving = false;
    }
  }
}

// Disable mobile controls for VR mode if active
Object.entries(mobileControls).forEach(([direction, element]) => {
  element.addEventListener("touchstart", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  element.addEventListener("touchend", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  element.addEventListener("mousedown", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  element.addEventListener("mouseup", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  element.addEventListener("mouseleave", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("touchcancel", (e) => {
    if (vrEnabled) return; // Ignore if in VR
    pressedButtons[direction] = false;
  });
});

window.addEventListener("blur", () => {
  Object.keys(pressedButtons).forEach((key) => {
    pressedButtons[key] = false;
  });
});

// Adding Event Listeners
if (modalExitButton) modalExitButton.addEventListener("click", hideModal);
if (modalbgOverlay) modalbgOverlay.addEventListener("click", hideModal);
if (themeToggleButton) themeToggleButton.addEventListener("click", toggleTheme);
if (audioToggleButton) audioToggleButton.addEventListener("click", toggleAudio);
window.addEventListener("resize", onResize);
window.addEventListener("click", onClick, { passive: false });
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("touchend", onTouchEnd, { passive: false });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

const clock = new THREE.Clock(); // For frame-rate independent physics

function animate() {
  const delta = Math.min(0.05, clock.getDelta()); // Limit delta to prevent physics glitches

  updatePlayer(delta); // Pass delta to physics update
  handleContinuousMovement(); // This will handle VR movement if vrEnabled is true

  // --- Camera Update Logic (Conditional) ---
  if (!vrEnabled) {
    // Only update the OrthographicCamera for desktop view
    if (character.instance) {
      const targetCameraPosition = new THREE.Vector3(
        character.instance.position.x + cameraOffset.x - 20,
        cameraOffset.y,
        character.instance.position.z + cameraOffset.z + 30
      );
      camera.position.copy(targetCameraPosition);
      camera.lookAt(
        character.instance.position.x + 10,
        camera.position.y - 39,
        character.instance.position.z + 10
      );
    }
  } else {
    // In VR, the renderer handles the camera position/rotation via xrCamera
    // You might want to update the character's position based on xrCamera if you have VR locomotion
  }

  // --- Raycasting for interaction ---
  if (!vrEnabled) {
    // Desktop interaction (mouse pointer)
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(intersectObjects);

    if (intersects.length > 0) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "default";
      intersectObject = "";
    }

    // This loop seems redundant if you only care about the first intersect.
    // The `if (intersects.length > 0)` block already sets `intersectObject`.
    // It's fine to keep, but just a note.
    for (let i = 0; i < intersects.length; i++) {
      intersectObject = intersects[0].object.parent.name;
    }
  } else {
    // In VR, you'd typically use controller raycasting for interaction
    // Example (conceptual, requires more setup for controller rays):
    // if (hand1 && hand1.isGamepad) {
    //     // Cast ray from hand1 and check for intersects
    // }
    document.body.style.cursor = "default"; // Cursor is not relevant in VR
  }
}

renderer.setAnimationLoop(animate);

// Placeholder for buildController if you plan to add visual models for your VR controllers
// This function would typically create and return a mesh to represent the controller.
function buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
            material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });
            return new THREE.Line(geometry, material);

        case 'gaze':
            geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
            material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
            return new THREE.Mesh(geometry, material);
    }
}