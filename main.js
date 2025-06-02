import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { VRButton } from "three/addons/webxr/VRButton.js"; // IMPORTANTE: Importa VRButton

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

// Algunos de nuestros elementos DOM, otros están dispersos en el archivo
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
const secondIconTwo = document(".second-icon-two");

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

// Lighting and Enviornment Stuff (sin cambios, ya definido)
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

// Posición inicial de la cámara en modo de escritorio.
// En VR, esta posición será ignorada y reemplazada por la del casco.
camera.position.set(
  character.spawnPosition.x - 13, // Ajusta estas posiciones para que la vista inicial sea buena
  character.spawnPosition.y + 39,
  character.spawnPosition.z - 67
);
camera.lookAt(character.spawnPosition); // Que la cámara mire al punto de inicio del personaje

// NO USAR OrthographicCamera en VR.

// Los OrbitControls son útiles para depuración en desktop, pero no para VR.
const controls = new OrbitControls(camera, canvas);
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
  const jumpHeight = 2;
  const jumpDuration = 0.5;
  const isSnorlax = meshID === "Snorlax";

  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

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

// Modificado para VR: El clic/interacción en VR será diferente
function onClick() {
    // Si estamos en VR, la interacción con el raycaster será diferente
    if (renderer.xr.isPresenting) {
        // En VR, las interacciones generalmente se manejan con controladores VR.
        // Aquí podrías agregar lógica para un "clic" en VR si tu raycaster
        // se actualiza en base a la dirección de la cabeza o de un controlador.
        // Por ahora, dejamos este clic de navegador para el modo desktop.
        // No se recomienda usar eventos de mouse directamente en VR.
        return; // Ignora clics de mouse en modo VR
    }
    // Lógica existente para el modo de escritorio
    if (touchHappened) return;
    handleInteraction();
}

// Modificado para VR: handleInteraction necesitará considerar la cámara VR
function handleInteraction() {
  if (!modal.classList.contains("hidden")) {
    return;
  }

  // Si estamos en VR, la raycaster debería basarse en la cámara VR o un controlador
  if (renderer.xr.isPresenting) {
    // Para VR, necesitas un raycaster que siga la mirada del usuario (headset)
    // o un controlador de mano. Para una interacción simple de "mirar y activar",
    // puedes usar la cámara VR.

    // Obtener la pose de la cámara VR actual
    const xrCamera = renderer.xr.getCamera(camera);
    raycaster.setFromCamera(new THREE.Vector2(0, 0), xrCamera); // El centro de la vista
  } else {
    // Modo de escritorio (mouse/touch)
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

// onMouseMove, onTouchEnd, onKeyDown, onKeyUp, mobileControls:
// Estos eventos de entrada de escritorio/móvil no se usarán directamente en VR.
// Manténgalos para el modo 2D, pero considera cómo manejar el movimiento en VR.
// Por ahora, en VR, tu personaje se quedará quieto hasta que implementes controles VR.

function onMouseMove(event) {
  if (renderer.xr.isPresenting) return; // Ignorar en VR
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  touchHappened = false;
}

function onTouchEnd(event) {
  if (renderer.xr.isPresenting) return; // Ignorar en VR
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  touchHappened = true;
  handleInteraction();
}

// Movement and Gameplay functions (estas funciones controlan el movimiento del personaje)
// En VR, necesitarás una forma diferente de mover al personaje,
// probablemente usando los controladores de VR (ej. teleportación o joysticks virtuales).
// Por ahora, el personaje se quedará en su posición de spawn si no hay controles VR implementados.
function respawnCharacter() {
  character.instance.position.copy(character.spawnPosition);

  playerCollider.start
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
  playerCollider.end
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));

  playerVelocity.set(0, 0, 0);
  character.isMoving = false;
}

function playerCollisions() {
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    if (playerOnFloor) {
      character.isMoving = false;
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function updatePlayer() {
  if (!character.instance) return;

  if (character.instance.position.y < -20) {
    respawnCharacter();
    return;
  }

  // --- Movimiento del personaje para VR ---
  // Si estamos en VR, la cámara del headset es el punto de vista del usuario.
  // Queremos que el *personaje* se mueva, y la cámara VR se adjuntará al personaje.
  // Esto requiere que el personaje sea un padre de la cámara, o que la cámara se mueva con el personaje.
  // Para simplificar, haremos que el `character.instance` (tu personaje) sea la cámara raíz en VR.
  // Esto significa que el personaje se moverá y la vista VR se moverá con él.

  // En modo VR, la posición del character.instance se convertirá en la posición
  // desde la cual se renderizará el mundo, es decir, será el "playerRig".
  // Si no tienes un "playerRig" explícito, puedes mover la escena o el propio character.instance.

  // Por ahora, el movimiento de la cápsula y la colisión se aplicará al character.instance.
  // La cámara VR de Three.js (renderer.xr.getCamera(camera)) se moverá con el character.instance.
  // Esto hará que el personaje sea el "cuerpo" del jugador en VR.

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035;
  }

  // Aplica la velocidad a la cápsula del jugador
  playerCollider.translate(playerVelocity.clone().multiplyScalar(0.035));

  playerCollisions();

  // Mueve la instancia del personaje a la posición de la cápsula
  character.instance.position.copy(playerCollider.start);
  character.instance.position.y -= CAPSULE_RADIUS; // Ajuste para que el personaje esté sobre el suelo

  // Rotación del personaje (solo si no estamos en VR, o si el movimiento es con joystick)
  if (!renderer.xr.isPresenting) {
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
  } else {
    // En VR, la rotación horizontal del personaje debería seguir la rotación del headset
    // para evitar que el mundo gire de forma independiente de la cabeza del usuario.
    // Opcionalmente, puedes permitir que el joystick gire el personaje.
    // Por ahora, simplemente evita que el personaje gire automáticamente como en 2D.
  }
}

// onKeyDown y onKeyUp: Controlan el movimiento con teclado.
// Estos eventos solo deben afectar el movimiento si NO estamos en VR.
function onKeyDown(event) {
  if (renderer.xr.isPresenting) return; // Ignorar en VR
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
  }
}

function onKeyUp(event) {
  if (renderer.xr.isPresenting) return; // Ignorar en VR
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
  if (!character.instance || !character.isMoving) return;

  const jumpDuration = 0.5;
  const jumpHeight = 2;

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
  // Solo permite movimiento con teclado/mobile si NO estamos en VR
  if (renderer.xr.isPresenting) {
    // Si estás en VR, aquí deberías manejar la entrada de los controladores VR
    // para mover al personaje. Por ejemplo, usando `renderer.xr.getController(0)`
    // y leyendo su `gamepad.axes` para joysticks.
    return;
  }

  if (!character.instance) return;

  if (
    Object.values(pressedButtons).some((pressed) => pressed) &&
    !character.isMoving
  ) {
    if (!isMuted) {
      playSound("jumpSFX");
    }
    if (pressedButtons.up) {
      playerVelocity.z += MOVE_SPEED;
      targetRotation = 0;
    }
    if (pressedButtons.down) {
      playerVelocity.z -= MOVE_SPEED;
      targetRotation = Math.PI;
    }
    if (pressedButtons.left) {
      playerVelocity.x += MOVE_SPEED;
      targetRotation = Math.PI / 2;
    }
    if (pressedButtons.right) {
      playerVelocity.x -= MOVE_SPEED;
      target.rotation = -Math.PI / 2;
    }

    playerVelocity.y = JUMP_HEIGHT;
    character.isMoving = true;
    handleJumpAnimation();
  }
}

Object.entries(mobileControls).forEach(([direction, element]) => {
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignorar en VR
    pressedButtons[direction] = true;
  });

  element.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignorar en VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignorar en VR
    pressedButtons[direction] = true;
  });

  element.addEventListener("mouseup", (e) => {
    e.preventDefault();
    if (renderer.xr.isPresenting) return; // Ignorar en VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("mouseleave", (e) => {
    if (renderer.xr.isPresenting) return; // Ignorar en VR
    pressedButtons[direction] = false;
  });

  element.addEventListener("touchcancel", (e) => {
    if (renderer.xr.isPresenting) return; // Ignorar en VR
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
document
  .getElementById("vr-button-container")
  .appendChild(VRButton.createButton(renderer));

// --- Bucle de Animación para VR ---
// Three.js se encargará de llamar a `animate` en el momento adecuado para VR.
function animate() {
  updatePlayer();
  handleContinuousMovement(); // Esto ahora solo afecta el modo desktop

  // La lógica de la cámara cambia dependiendo si estamos en VR o no
  if (!renderer.xr.isPresenting) {
    // Lógica de cámara para modo de escritorio
    if (character.instance) {
      const targetCameraPosition = new THREE.Vector3(
        character.instance.position.x + cameraOffset.x - 20,
        cameraOffset.y,
        character.instance.position.z + cameraOffset.z + 30
      );
      camera.position.copy(targetCameraPosition);
      camera.lookAt(
        character.instance.position.x + 10,
        character.instance.position.y, // Ajustado para que mire al personaje
        character.instance.position.z + 10
      );
    }
  } else {
    // Lógica para VR: La cámara del headset ya está siendo controlada por Three.js.
    // Necesitas adjuntar la cámara al personaje o mover el personaje según el headset.
    // Una forma común es que el `character.instance` sea el "rig" del jugador
    // y el `renderer.xr.getCamera(camera)` esté dentro de ese rig.

    // Si tu personaje (character.instance) se mueve en el mundo, la cámara VR
    // automáticamente se moverá con él si está adjunta.
    // Aquí, estamos moviendo el `character.instance` en `updatePlayer()`.
    // La cámara VR de Three.js (la que está siendo renderizada) se moverá con este `character.instance`.
    // Puedes también hacer que el `character.instance` rote con la rotación horizontal del headset.
    // Esto es un punto crucial para futuros controles de movimiento VR.
  }

  // El raycasting para interacción se llama en `handleInteraction()`
  // La visualización del cursor del mouse solo debe ocurrir en el modo de escritorio
  if (!renderer.xr.isPresenting) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(intersectObjects);

    if (intersects.length > 0) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "default";
      intersectObject = ""; // Restablecer cuando no hay intersecciones
    }
  } else {
    // En VR, no hay cursor de mouse. La retroalimentación de interacción sería visual (ej. un rayo láser desde el controlador)
    document.body.style.cursor = "default"; // Asegúrate de que el cursor no esté como "pointer" en VR
  }
}

// Este es el nuevo bucle de animación. ¡Reemplaza tu `renderer.setAnimationLoop(animate);`!
renderer.setAnimationLoop(animate);