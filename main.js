import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // Keep for non-VR desktop fallback
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
// Import the VRButton for VR experiences
import { VRButton } from "three/addons/webxr/VRButton.js"; // *** CAMBIO CLAVE: Usamos VRButton para Realidad Virtual ***

// --- VR Specific Imports and Variables ---
let vrEnabled = false; // Flag to check if we are in VR mode
let xrCamera; // This will be the VR camera provided by WebXR
let playerControls; // To handle movement in VR, we'll need a different approach than keyboard/mouse
const dummyCamera = new THREE.Object3D(); // A dummy object to represent the VR camera's position in the scene

// DECLARE hand1 and hand2 here, but DON'T initialize them yet
let hand1;
let hand2;

// Asegúrate de que Howl esté disponible globalmente o importado (si usas npm)
// Por ejemplo, si lo incluyes desde un CDN en tu HTML:
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
// *** CAMBIO CLAVE: Usa VRButton.createButton aquí ***
if (document.getElementById("vr-button-container")) {
  document.getElementById("vr-button-container").appendChild(
    VRButton.createButton(renderer, {
      sessionInit: {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"], // Características opcionales para una mejor experiencia VR
      },
    })
  );
}


// Listen for VR session start and end
renderer.xr.addEventListener("sessionstart", () => {
  vrEnabled = true;
  // Ocultar elementos de UI no relevantes en VR
  if (document.querySelector(".theme-mode-toggle-button")) document.querySelector(".theme-mode-toggle-button").style.display = "none";
  if (document.querySelector(".audio-toggle-button")) document.querySelector(".audio-toggle-button").style.display = "none";
  if (document.querySelector(".mobile-control.up-arrow")) document.querySelector(".mobile-control.up-arrow").style.display = "none";
  if (document.querySelector(".mobile-control.left-arrow")) document.querySelector(".mobile-control.left-arrow").style.display = "none";
  if (document.querySelector(".mobile-control.right-arrow")) document.querySelector(".mobile-control.right-arrow").style.display = "none";
  if (document.querySelector(".mobile-control.down-arrow")) document.querySelector(".mobile-control.down-arrow").style.display = "none";

  xrCamera = renderer.xr.getCamera(camera); // Get the XR camera which will be controlling the view

  // *** FIX: Inicializa los controladores de mano DESPUÉS de que la sesión VR comience ***
  hand1 = renderer.xr.getController(0); // Para el controlador de la mano izquierda
  hand2 = renderer.xr.getController(1); // Para el controlador de la mano derecha

  // Añade los controladores a la escena para que su posición y orientación se actualicen
  scene.add(hand1);
  scene.add(hand2);

  // Opcional: Añade modelos visuales para los controladores
  // La función `buildController` se define al final del archivo como un placeholder
  hand1.addEventListener('connected', function (event) {
      this.add(buildController(event.data));
  });
  hand2.addEventListener('connected', function (event) {
      this.add(buildController(event.data));
  });
  hand1.addEventListener('disconnected', function () {
      if (this.children[0]) this.remove(this.children[0]);
  });
  hand2.addEventListener('disconnected', function () {
      if (this.children[0]) this.remove(this.children[0]);
  });


  if (character.instance) {
    character.instance.position.set(0, 0, 0); // Reinicia la posición del personaje relativa a su nuevo padre
    dummyCamera.position.copy(playerCollider.start); // Inicializa la cámara dummy a la posición actual del jugador
    scene.add(dummyCamera); // Añade la cámara dummy a la escena
    dummyCamera.add(character.instance); // El personaje se convierte en un hijo de la cámara dummy
  }

  // Oculta la pantalla de carga si todavía está visible
  // Asegúrate de que `gsap` esté incluido en tu proyecto
  if (typeof gsap !== 'undefined' && loadingScreen) {
      gsap.to(loadingScreen, { opacity: 0, duration: 0, onComplete: () => { loadingScreen.remove(); } });
  }

  if (!isMuted) {
    playSound("backgroundMusic");
  }
});

renderer.xr.addEventListener("sessionend", () => {
  vrEnabled = false;
  // Mostrar elementos de UI de nuevo
  if (document.querySelector(".theme-mode-toggle-button")) document.querySelector(".theme-mode-toggle-button").style.display = "block";
  if (document.querySelector(".audio-toggle-button")) document.querySelector(".audio-toggle-button").style.display = "block";
  if (document.querySelector(".mobile-control.up-arrow")) document.querySelector(".mobile-control.up-arrow").style.display = "block";
  if (document.querySelector(".mobile-control.left-arrow")) document.querySelector(".mobile-control.left-arrow").style.display = "block";
  if (document.querySelector(".mobile-control.right-arrow")) document.querySelector(".mobile-control.right-arrow").style.display = "block";
  if (document.querySelector(".mobile-control.down-arrow")) document.querySelector(".mobile-control.down-arrow").style.display = "block";

  // Revertir la relación padre-hijo del personaje
  if (character.instance) {
    scene.add(character.instance); // Vuelve a añadir el personaje directamente a la escena
    character.instance.position.copy(dummyCamera.position); // Restaura la posición global del personaje
    scene.remove(dummyCamera); // Quita la cámara dummy de la escena
  }

  // Remueve los controladores de la escena al finalizar la sesión VR
  if (hand1) scene.remove(hand1);
  if (hand2) scene.remove(hand2);
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
    if (modalTitle) modalTitle.textContent = content.title;
    if (modalProjectDescription) modalProjectDescription.textContent = content.content;

    if (content.link) {
      if (modalVisitProjectButton) {
        modalVisitProjectButton.href = content.link;
        modalVisitProjectButton.classList.remove("hidden");
      }
    } else {
      if (modalVisitProjectButton) modalVisitProjectButton.classList.add("hidden");
    }
    if (modal) modal.classList.remove("hidden");
    if (modalbgOverlay) modalbgOverlay.classList.remove("hidden");
    isModalOpen = true;
  }
}

function hideModal() {
  isModalOpen = false;
  if (modal) modal.classList.add("hidden");
  if (modalbgOverlay) modalbgOverlay.classList.add("hidden");
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
  // Asegúrate de que gsap esté cargado
  if (typeof gsap !== 'undefined') {
    const t1 = gsap.timeline();

    t1.to(loadingText, {
      opacity: 0,
      duration: 0,
    });

    t1.to(enterButton, {
      opacity: 1,
      duration: 0,
    });
  } else {
    // Si gsap no está disponible, simplemente oculta/muestra directamente
    if (loadingText) loadingText.style.opacity = '0';
    if (enterButton) enterButton.style.opacity = '1';
  }
};

if (enterButton) {
  enterButton.addEventListener("click", () => {
    // Only hide loading screen if not in VR
    if (!vrEnabled) {
      if (typeof gsap !== 'undefined' && loadingScreen) {
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
      } else if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        if (instructions) instructions.style.opacity = '0';
        loadingScreen.remove();
      }
    }

    if (!isMuted) {
      playSound("projectsSFX");
      playSound("backgroundMusic");
    }
  });
}

// Audio

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
  if (!mesh) return; // Añadido: asegurar que el mesh existe
  const jumpHeight = 2;
  const jumpDuration = 0.5;
  const isSnorlax = meshID === "Snorlax";

  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

  if (typeof gsap === 'undefined') {
    console.warn("GSAP is not loaded. Jump animation will not play.");
    return;
  }

  const t1 = gsap.timeline();

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
  if (modal && !modal.classList.contains("hidden")) { // Añadido: asegurar que 'modal' existe
    return;
  }

  // --- Interaction in VR vs Desktop ---
  let currentCamera = vrEnabled ? xrCamera : camera; // Usa la cámara apropiada
  if (!currentCamera) return; // Asegurar que la cámara existe

  // *** Para interacción en VR, podrías querer usar raycasting desde los controladores de mano ***
  // Aquí se sigue usando el "pointer" de ratón/toque. En VR, podrías necesitar un raycaster diferente.
  raycaster.setFromCamera(pointer, currentCamera);
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
  // Para touch, event.changedTouches[0] es más fiable para obtener la posición del toque
  if (event.changedTouches && event.changedTouches.length > 0) {
    pointer.x = (event.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
  } else {
    // Fallback para otros eventos de puntero si es necesario
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  touchHappened = true;
  handleInteraction();
}

// Movement and Gameplay functions
function respawnCharacter() {
  if (!character.instance) return; // Asegurarse de que el personaje existe
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
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function updatePlayer(delta) {
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

  // --- VR Movement Integration (Conceptual) ---
  if (vrEnabled) {
    // En VR, la posición del jugador se mueve normalmente, pero la cámara de VR
    // se adjunta a la posición del visor. El "dummyCamera" se usa para
    // mantener la posición del personaje en el espacio de la escena.
    dummyCamera.position.copy(playerCollider.start);
    dummyCamera.position.y -= CAPSULE_RADIUS; // Ajusta para la base de la cápsula

    // *** Aquí es donde integrarías la lógica de movimiento específica para VR ***
    // Por ejemplo, usando los gamepads de los controladores:
    // if (hand1 && hand1.gamepad) {
    //    // Accede a hand1.gamepad.axes para joysticks (ej. movimiento)
    //    // Accede a hand1.gamepad.buttons para botones (ej. teletransporte o salto)
    //    // console.log("Hand 1 Axes:", hand1.gamepad.axes);
    //    // console.log("Hand 1 Buttons:", hand1.gamepad.buttons);
    // }
    // Podrías rotar el dummyCamera o mover playerCollider
    // en función de la entrada del controlador.

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

  if (firstIcon && secondIcon) { // Asegurarse de que los iconos existen
    if (firstIcon.style.display === "none") {
      firstIcon.style.display = "block";
      secondIcon.style.display = "none";
    } else {
      firstIcon.style.display = "none";
      secondIcon.style.display = "block";
    }
  }

  if (typeof gsap !== 'undefined') {
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
}

// Toggle Audio Function
function toggleAudio() {
  if (!isMuted) {
    playSound("projectsSFX"); // Suena al activar el botón, no al mutear
  }
  if (firstIconTwo && secondIconTwo) { // Asegurarse de que los iconos existen
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
  if (typeof gsap === 'undefined') {
    console.warn("GSAP is not loaded. Jump animation will not play.");
    return;
  }
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
    // *** Lógica de movimiento para VR ***
    // Aquí es donde implementarías el movimiento del jugador basado en la entrada de los controladores VR.
    // Podrías mover el playerCollider y, por lo tanto, el dummyCamera.
    // Esto es un tema complejo y dependerá del tipo de locomoción que quieras (teletransporte, movimiento con joystick, etc.).
    // Por ejemplo:
    // if (hand1 && hand1.gamepad) {
    //     const forward = new THREE.Vector3(0, 0, -1);
    //     forward.applyQuaternion(hand1.quaternion); // Obtén la dirección hacia adelante del controlador
    //     forward.y = 0; // Solo movimiento horizontal
    //     forward.normalize();

    //     // Asume que el eje Y del joystick es el movimiento adelante/atrás
    //     const joystickY = hand1.gamepad.axes[3]; // O el eje correspondiente en tu controlador
    //     if (Math.abs(joystickY) > 0.1) { // Pequeño deadzone
    //         playerCollider.translate(forward.multiplyScalar(joystickY * MOVE_SPEED * delta)); // delta viene de animate
    //         character.isMoving = true;
    //     } else {
    //         character.isMoving = false;
    //     }
    // }
  } else {
    // Original desktop/mobile movement logic
    if (Object.values(pressedButtons).some((pressed) => pressed)) {
      playerVelocity.set(0, playerVelocity.y, 0); // Reinicia la velocidad horizontal en cada frame
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
  if (element) { // Asegurarse de que el elemento existe
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
  }
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
    // En VR, el renderizador WebXR actualiza la cámara xrCamera automáticamente.
    // No necesitas manipular la 'camera' base aquí.
    // Si necesitas mover el mundo con respecto al jugador, ajustarías el 'dummyCamera' o el 'playerCollider'
    // en updatePlayer/handleContinuousMovement.
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

    for (let i = 0; i < intersects.length; i++) {
      intersectObject = intersects[0].object.parent.name;
    }
  } else {
    // En VR, normalmente usarías raycasting desde los controladores de mano
    // o un puntero de mirada fija para interactuar.
    // Ejemplo conceptual (necesita implementación):
    // if (hand1 && hand1.gamepad) {
    //     // Crea un rayo desde la posición y orientación del controlador
    //     // const controllerRay = new THREE.Raycaster();
    //     // controllerRay.setFromWorldAndDirection(hand1.position, hand1.getWorldDirection(new THREE.Vector3()));
    //     // const vrIntersects = controllerRay.intersectObjects(intersectObjects);
    //     // ... lógica de interacción VR
    // }
    document.body.style.cursor = "default"; // El cursor no es relevante en VR
  }
}

renderer.setAnimationLoop(animate);

// Placeholder for buildController if you plan to add visual models for your VR controllers
// This function would typically create and return a mesh to represent the controller.
function buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
            // Un puntero simple (una línea) que sigue la orientación del controlador
            geometry = new THREE.BufferGeometry();
            // Puntos para la línea: del origen del controlador a 1 unidad hacia adelante
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            // Colores para la línea (opcional, para visualización básica)
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
            material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });
            return new THREE.Line(geometry, material);

        case 'gaze':
            // Un círculo pequeño que se mueve con la mirada (para visores sin controladores o modo de mirada)
            geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1); // Crea un anillo en Z -1
            material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
            return new THREE.Mesh(geometry, material);

        case 'screen':
            // Para dispositivos móviles que no son AR, o si la sesión VR no tiene un "tracked-pointer"
            return new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshBasicMaterial({ color: 0xcccccc, opacity: 0.5, transparent: true }));
    }
    return new THREE.Object3D(); // Fallback
}