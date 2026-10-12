import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ===============================================================
// 1. EXHIBITION TEXT – edit the wording here
// ===============================================================
// Use "\n" inside a value for a line break, and a blank line ("\n\n") between paragraphs.
const SOLDIER_INFO = {
  kicker: "Centrepiece",
  title: "The Soldier",
  subtitle: "",
  meta: [
    ["Artist", "Muhit Abdullakh\nborn 2004 Ulaanbaatar, Mongolia; lives and works in Melbourne"],
    ["Medium", "Mixed media: toy soldier, digital photography, collage, printed posters, augmented reality"],
  ],
  description:
    "The green plastic toy soldier, a ready-made object of reproduction that is meant to repeat, arrange and exchange itself in the process of play. Known from childhood playtime, the soldier is linked with concepts as military force, discipline, masculinity and nostalgia, but its repeated green body deprives it of any individuality.\n\n" +
    "The question: do meanings and conceptions attributed to one particular object transform when the way they are presented also transforms?\n\n" +
    "In the course of this project, a picture of the toy is photographed, scanned, digitized and turned into posters through collage and type, cropping and repetition, distortion and manipulation with physical forms. Every new object contains some trace of the previous stage, changing its scale, surface, context and meaning. The toy turns into an image; the image – into a form; and posters – into an abstract virtual world.",
};

const POSTERS = [
  {
    file: "assets/poster-1.png",
    number: "01",
    title: "Friendship",
    subtitle: "The soldier as slogan",
    description:
      "Printed in a single black ink on propaganda red, the soldier stands like the hero of a recruitment poster. Behind him, ДРУЖБА – Russian for “friendship” – repeats six times until it reads less like a word and more like a chant. The toy now borrows the voice of political image-making, and the warm promise of the slogan sits uneasily beside the rifle in his hands.",
  },
  {
    file: "assets/poster-2.png",
    number: "02",
    title: "Heat Signature",
    subtitle: "The soldier as target",
    description:
      "Turned away from the viewer, the soldier glows in the burning oranges of a thermal camera against a dark screen grid. The green that once meant plastic becomes body heat – the way a figure appears when it is watched from a distance. Below, “The Soldier” is set in hollow blackletter, a typeface of monuments and old headlines, reduced to a faint outline that barely holds on.",
  },
  {
    file: "assets/poster-3.png",
    number: "03",
    title: "Resolution",
    subtitle: "The soldier as data",
    description:
      "The soldier is rebuilt from glassy pixel blocks, the way a screen approximates a body it cannot fully hold. A single band cuts across the chest and reveals another version underneath – a distorted, heat-coloured render of the torso and rifle, marked out by thin lines like a scan. Each layer is another copy, and none of them is the original toy.",
  },
];

// ===============================================================
// 2. SETTINGS – change these numbers to adjust the exhibition
// ===============================================================
const SOLDIER_FILE = "assets/toy-soldier.glb";
const SOLDIER_COLOUR = 0x4f7d3a;
const SOLDIER_HEIGHT = 0.8;            // the model is scaled to this height (posters are ~1.98 tall)
const SOLDIER_TURN_DEG = -30;          // which way the soldier faces (0 = towards the phone's opening view)

const PLINTH_HEIGHT = 0.6;
const PLINTH_RADIUS = 0.45;

const POSTER_WIDTH = 1.4;              // height follows each image's own proportions (A-series ≈ 1 : 1.414)
const RING_RADIUS = 3.2;               // distance from the soldier to every poster
const POSTER_CENTRE_Y = 1.7;
// Where each poster sits around the soldier, 120° apart (0° = in front of the soldier, towards the phone view).
// Poster 01 rises behind the soldier in the phone view; on wide screens 01 is left and 02 is right.
const POSTER_ANGLES_DEG = [180, 60, 300];
const FLOAT_AMOUNT = 0.06;             // how far the posters drift up and down

const FOCUS_DURATION = 850;            // camera move into / out of focus mode (milliseconds)
const TAP_MAX_MOVE = 10;               // a touch that moves further than this (px) is a drag, not a tap
const TAP_MAX_TIME = 700;              // a touch held longer than this (ms) is not a tap

const BACKGROUND = 0x1c1c1f;

// ===============================================================
// 3. SMALL HELPERS
// ===============================================================
const deg = THREE.MathUtils.degToRad;
const isPortrait = () => window.innerWidth / window.innerHeight <= 1;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Point on the ring at a given angle (0° = +z)
function ringPoint(angleDeg, radius, y) {
  const a = deg(angleDeg);
  return new THREE.Vector3(Math.sin(a) * radius, y, Math.cos(a) * radius);
}

// The direction exactly opposite the gap between Poster 01 and Poster 02.
// Standing here, Poster 01 is on the left and Poster 02 on the right.
const GAP_VIEW_ANGLE_DEG = (() => {
  const [a, b] = [deg(POSTER_ANGLES_DEG[0]), deg(POSTER_ANGLES_DEG[1])];
  const middle = Math.atan2(Math.sin(a) + Math.sin(b), Math.cos(a) + Math.cos(b));
  return THREE.MathUtils.radToDeg(middle) + 180;
})();

// Wider lens on narrow screens so the scene doesn't feel cramped
function fovForAspect(aspect) {
  if (aspect <= 1) return 66;
  const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(38)) / aspect));
  return THREE.MathUtils.clamp(needed, 50, 65);
}

// The view a visitor arrives at (and returns to with "Back to exhibition")
function getOpeningPose() {
  if (isPortrait()) {
    // Phone: the soldier centred, with Poster 01 rising behind it
    return {
      position: ringPoint(POSTER_ANGLES_DEG[0] + 180, 2.7, 2.35),
      target: new THREE.Vector3(0, 1.15, 0),
    };
  }
  // Wide screen: the soldier framed between Poster 01 (left) and Poster 02 (right)
  return {
    position: ringPoint(GAP_VIEW_ANGLE_DEG, 2.75, 1.85),
    target: new THREE.Vector3(0, 1.2, 0),
  };
}

// ===============================================================
// 4. PAGE ELEMENTS
// ===============================================================
const canvas = document.getElementById("scene");
const hint = document.getElementById("hint");
const loaderBar = document.getElementById("loader-bar");
const panel = document.getElementById("info-panel");
const panelScroll = document.getElementById("info-scroll");
const panelKicker = document.getElementById("info-kicker");
const panelTitle = document.getElementById("info-title");
const panelSubtitle = document.getElementById("info-subtitle");
const panelMeta = document.getElementById("info-meta");
const panelDescription = document.getElementById("info-description");
const backButton = document.getElementById("back-button");

// ===============================================================
// 5. SCENE, CAMERA, RENDERER
// ===============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND);
scene.fog = new THREE.Fog(BACKGROUND, 6, 14);   // fades the distance into the dark

const camera = new THREE.PerspectiveCamera(
  fovForAspect(window.innerWidth / window.innerHeight),
  window.innerWidth / window.innerHeight,
  0.1,
  50
);
const openingPose = getOpeningPose();
camera.position.copy(openingPose.position);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // sharp but affordable on phones
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

// ===============================================================
// 6. CONTROLS (drag to rotate, pinch/scroll to zoom)
// ===============================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(openingPose.target);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 3.0;                       // keeps the viewer inside the ring of posters
controls.maxPolarAngle = Math.PI / 2 - 0.05;      // never below the floor
controls.update();

controls.addEventListener("start", hideHint);

function hideHint() {
  hint.classList.add("hidden");
}

// Stops any leftover "glide" from a drag so it doesn't continue after focus mode
function stopOrbitMomentum() {
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
}

// ===============================================================
// 7. LIGHTS
// ===============================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const spotlight = new THREE.SpotLight(0xffffff, 90, 12, 0.3, 0.6, 2);
spotlight.position.set(1.5, 4, 1.5);
spotlight.target.position.set(0, PLINTH_HEIGHT + 0.4, 0);
spotlight.castShadow = true;
spotlight.shadow.mapSize.set(1024, 1024);
spotlight.shadow.bias = -0.0005;
scene.add(spotlight, spotlight.target);

// Three small floor uplights around the plinth, each aimed at the soldier's chest
const UPLIGHT_AIM = new THREE.Vector3(0, 1.0, 0);
const UPLIGHT_POSITIONS = [
  [0, 0.08, 0.75],
  [0.65, 0.08, -0.38],
  [-0.65, 0.08, -0.38],
];
const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.55, metalness: 0.3 });
const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xffe9cc });

UPLIGHT_POSITIONS.forEach(([x, y, z]) => {
  // The fixture: a slim body with a slightly wider head, pointing along its +z axis
  const fixture = new THREE.Group();
  fixture.position.set(x, y, z);
  fixture.lookAt(UPLIGHT_AIM);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 20), fixtureMaterial);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.05, 24), fixtureMaterial);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 24), lensMaterial);
  body.rotation.x = head.rotation.x = Math.PI / 2;   // lay the cylinders along +z
  body.position.z = -0.03;
  head.position.z = 0.045;
  lens.position.z = 0.0705;
  body.castShadow = body.receiveShadow = true;
  head.castShadow = head.receiveShadow = true;
  fixture.add(body, head, lens);
  scene.add(fixture);

  // Its light: soft, warm-neutral, no shadows. decay 0 = no fall-off, so the
  // nearby plinth isn't blown out while the soldier gets an even, gentle lift.
  const uplight = new THREE.SpotLight(0xfff1e0, 1.1, 3, deg(22), 0.6, 0);
  uplight.position.set(x, y, z);
  uplight.target.position.copy(UPLIGHT_AIM);
  scene.add(uplight, uplight.target);
});

// ===============================================================
// 8. FLOOR (invisible – only its shadows show) AND PLINTH
// ===============================================================
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.4 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const plinth = new THREE.Mesh(
  new THREE.CylinderGeometry(PLINTH_RADIUS, PLINTH_RADIUS, PLINTH_HEIGHT, 48),
  new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 })
);
plinth.position.y = PLINTH_HEIGHT / 2;
plinth.castShadow = true;
plinth.receiveShadow = true;
plinth.userData.pick = { type: "soldier" };      // tapping the plinth also selects the soldier
scene.add(plinth);

// ===============================================================
// 9. LOADING PROGRESS
// ===============================================================
const loading = {
  total: 1 + POSTERS.length,   // the soldier + each poster
  finished: 0,
  soldierFraction: 0,
  postersDone: 0,
};

function updateLoader() {
  const progress = loading.soldierFraction * 0.75 + (loading.postersDone / POSTERS.length) * 0.25;
  loaderBar.style.transform = `scaleX(${progress})`;
}

function assetFinished() {
  loading.finished += 1;
  updateLoader();
  if (loading.finished === loading.total) {
    // Small pause so the full progress line is seen before fading
    setTimeout(() => document.documentElement.classList.add("is-loaded"), 250);
  }
}

// ===============================================================
// 10. FLOATING POSTERS AND THEIR CAPTIONS
// ===============================================================
const CAPTION_WIDTH = POSTER_WIDTH;
const CAPTION_HEIGHT = POSTER_WIDTH / 4;          // matches the 1024 × 256 caption canvas
const CAPTION_GAP = 0.06;

const posterGeometry = new THREE.PlaneGeometry(1, 1);   // scaled to each image's size
const captionGeometry = new THREE.PlaneGeometry(CAPTION_WIDTH, CAPTION_HEIGHT);
const textureLoader = new THREE.TextureLoader();

const posters = POSTERS.map((info, index) => {
  const group = new THREE.Group();
  group.position.copy(ringPoint(POSTER_ANGLES_DEG[index], RING_RADIUS, POSTER_CENTRE_Y));
  group.lookAt(0, POSTER_CENTRE_Y, 0);            // face the soldier

  // MeshBasicMaterial ignores lights and fog, so the poster keeps its true colours
  const image = new THREE.Mesh(
    posterGeometry,
    new THREE.MeshBasicMaterial({ color: 0x2a2a2e, toneMapped: false, fog: false })
  );
  image.castShadow = true;
  image.userData.pick = { type: "poster", index };

  const caption = new THREE.Mesh(
    captionGeometry,
    new THREE.MeshBasicMaterial({
      map: makeCaptionTexture(info),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    })
  );
  caption.userData.pick = { type: "poster", index };

  group.add(image, caption);
  scene.add(group);

  const poster = {
    index,
    group,
    image,
    caption,
    height: POSTER_WIDTH * Math.SQRT2,
    speed: 0.45 + index * 0.13,   // each poster floats at its own pace…
    phase: index * 2.1,           // …and starts at a different point
    float: 1,                     // 1 = floating, 0 = held still (while inspected)
  };
  setPosterProportions(poster, Math.SQRT2);
  loadPosterImage(poster, info);
  return poster;
});

// Sizes the poster to its image so nothing is stretched or cropped, and keeps the caption just below it
function setPosterProportions(poster, heightOverWidth) {
  poster.height = POSTER_WIDTH * heightOverWidth;
  poster.image.scale.set(POSTER_WIDTH, poster.height, 1);
  poster.caption.position.y = -(poster.height / 2 + CAPTION_GAP + CAPTION_HEIGHT / 2);
}

function loadPosterImage(poster, info) {
  const useTexture = (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    poster.image.material.map = texture;
    poster.image.material.color.set(0xffffff);
    poster.image.material.needsUpdate = true;
    loading.postersDone += 1;
    assetFinished();
  };

  textureLoader.load(
    info.file,
    (texture) => {
      const { width, height } = texture.image;
      setPosterProportions(poster, height / width);
      useTexture(texture);
    },
    undefined,
    () => {
      console.warn(`Poster image could not be loaded: ${info.file} – showing a labelled placeholder instead.`);
      setPosterProportions(poster, Math.SQRT2);
      useTexture(makeFallbackPosterTexture(info));
    }
  );
}

// Draws text with wide letter-spacing, centred on x (works in every browser)
function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + spacing;
  });
}

function makeCaptionTexture(info) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(242, 242, 242, 0.55)";
  ctx.font = `400 30px ${FONT}`;
  drawSpacedText(ctx, info.number, 512, 52, 8);

  ctx.fillStyle = "rgba(242, 242, 242, 0.92)";
  ctx.font = `300 62px ${FONT}`;
  drawSpacedText(ctx, info.title.toUpperCase(), 512, 122, 14);

  ctx.fillStyle = "rgba(242, 242, 242, 0.6)";
  ctx.font = `400 30px ${FONT}`;
  drawSpacedText(ctx, info.subtitle.toUpperCase(), 512, 194, 6);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// A deliberate, labelled stand-in used when a poster image is missing
function makeFallbackPosterTexture(info) {
  const c = document.createElement("canvas");
  c.width = 724;
  c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2a2a2e";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(242, 242, 242, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, c.width - 72, c.height - 72);
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(242, 242, 242, 0.55)";
  ctx.font = `400 34px ${FONT}`;
  drawSpacedText(ctx, info.number, 362, 400, 10);

  ctx.fillStyle = "rgba(242, 242, 242, 0.9)";
  ctx.font = `300 64px ${FONT}`;
  drawSpacedText(ctx, info.title.toUpperCase(), 362, 480, 14);

  ctx.fillStyle = "rgba(242, 242, 242, 0.5)";
  ctx.font = `400 26px ${FONT}`;
  drawSpacedText(ctx, "IMAGE UNAVAILABLE", 362, 580, 7);
  ctx.font = `400 22px ${FONT}`;
  drawSpacedText(ctx, info.file, 362, 624, 2);

  return new THREE.CanvasTexture(c);
}

// ===============================================================
// 11. TOY SOLDIER
// ===============================================================
// The soldier sits in a "pivot" so it can be turned to face the visitor
const soldierPivot = new THREE.Group();
soldierPivot.rotation.y = deg(SOLDIER_TURN_DEG);
scene.add(soldierPivot);

const soldierMaterial = new THREE.MeshStandardMaterial({
  color: SOLDIER_COLOUR,
  roughness: 0.82,
  metalness: 0.0,
});

// An invisible, slightly larger shape around the soldier makes it easy to tap on a small screen
const soldierHitArea = new THREE.Mesh(
  new THREE.CylinderGeometry(0.3, 0.3, SOLDIER_HEIGHT + 0.1, 12),
  new THREE.MeshBasicMaterial({ visible: false })
);
soldierHitArea.position.y = PLINTH_HEIGHT + (SOLDIER_HEIGHT + 0.1) / 2;
soldierHitArea.userData.pick = { type: "soldier" };
scene.add(soldierHitArea);

new GLTFLoader().load(
  SOLDIER_FILE,
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = soldierMaterial;     // one matte green plastic for every part
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    standOnPlinth(model);
    soldierPivot.add(model);
    loading.soldierFraction = 1;
    assetFinished();
  },
  (event) => {
    if (event.lengthComputable) {
      loading.soldierFraction = event.loaded / event.total;
      updateLoader();
    }
  },
  (error) => {
    console.warn(`Soldier model could not be loaded (${SOLDIER_FILE}) – showing a simple stand-in.`, error);
    const stand = makePlaceholderSoldier();
    standOnPlinth(stand);
    soldierPivot.add(stand);
    loading.soldierFraction = 1;
    assetFinished();
  }
);

// Scales any object to SOLDIER_HEIGHT, centres it, and puts its feet on top of the plinth
function standOnPlinth(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(SOLDIER_HEIGHT / size.y);

  box.setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  object.position.x -= centre.x;
  object.position.z -= centre.z;
  object.position.y += PLINTH_HEIGHT - box.min.y;
}

// A simple figure (base, legs, body, head, helmet, rifle) – only used if the model fails
function makePlaceholderSoldier() {
  const figure = new THREE.Group();
  const add = (geometry, x, y, z, rotZ = 0) => {
    const part = new THREE.Mesh(geometry, soldierMaterial);
    part.position.set(x, y, z);
    part.rotation.z = rotZ;
    part.castShadow = true;
    part.receiveShadow = true;
    figure.add(part);
  };
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 24), 0, 0.015, 0);          // base
  add(new THREE.CapsuleGeometry(0.045, 0.26, 4, 12), -0.05, 0.2, 0);           // left leg
  add(new THREE.CapsuleGeometry(0.045, 0.26, 4, 12), 0.05, 0.2, 0);            // right leg
  add(new THREE.CapsuleGeometry(0.09, 0.22, 4, 16), 0, 0.5, 0);                // body
  add(new THREE.SphereGeometry(0.065, 16, 12), 0, 0.71, 0);                    // head
  add(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.73, 0); // helmet
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), 0.13, 0.5, 0.04, -0.2); // rifle
  return figure;
}

// ===============================================================
// 12. TAPPING ARTWORKS (Raycaster)
// ===============================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pickables = [soldierHitArea, plinth, ...posters.flatMap((p) => [p.image, p.caption])];

// Returns { type: "soldier" } or { type: "poster", index } for a screen point, or null
function pickAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.pick : null;
}

// A tap = one finger, released quickly, without moving. Anything else is left to OrbitControls.
const activePointers = new Set();
let tapStart = null;

canvas.addEventListener("pointerdown", (event) => {
  activePointers.add(event.pointerId);
  tapStart =
    activePointers.size === 1
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
      : null;   // a second finger means pinch, never a tap
});

canvas.addEventListener("pointermove", (event) => {
  if (tapStart && event.pointerId === tapStart.id) {
    const moved = Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y);
    if (moved > TAP_MAX_MOVE) tapStart = null;
  }
  // Mouse only: show a pointer cursor over artworks
  if (event.pointerType === "mouse" && event.buttons === 0 && mode === "exhibition") {
    canvas.style.cursor = pickAt(event.clientX, event.clientY) ? "pointer" : "grab";
  }
});

canvas.addEventListener("pointerup", (event) => {
  activePointers.delete(event.pointerId);
  if (!tapStart || event.pointerId !== tapStart.id) return;
  const quick = performance.now() - tapStart.time < TAP_MAX_TIME;
  const still = Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) <= TAP_MAX_MOVE;
  tapStart = null;
  if (quick && still && mode === "exhibition") {
    const pick = pickAt(event.clientX, event.clientY);
    if (pick) openFocus(pick);
  }
});

canvas.addEventListener("pointercancel", (event) => {
  activePointers.delete(event.pointerId);
  tapStart = null;
});

// Stop Safari's own page pinch-zoom from fighting the 3D pinch-zoom
document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });

// Keyboard access
document.querySelectorAll(".artwork-nav button").forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.artwork;
    openFocus(value === "soldier" ? { type: "soldier" } : { type: "poster", index: Number(value) });
  });
});
backButton.addEventListener("click", closeFocus);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFocus();
});

// ===============================================================
// 13. FOCUS MODE (inspecting one artwork)
// ===============================================================
let mode = "exhibition";        // "exhibition" | "moving" | "focus"
let focused = null;             // the artwork being inspected
let returning = false;
let tween = null;
const lookTarget = controls.target.clone();
const viewShift = { x: 0, y: 0 };   // moves the artwork off-centre to make room for the panel

function fillPanel(pick) {
  const info =
    pick.type === "soldier"
      ? SOLDIER_INFO
      : { ...POSTERS[pick.index], kicker: `Poster ${POSTERS[pick.index].number}`, meta: [] };

  panelKicker.textContent = info.kicker;
  panelTitle.textContent = info.title;
  panelSubtitle.textContent = info.subtitle || "";
  panelMeta.replaceChildren(
    ...info.meta.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;   // "\n" becomes a line break (see CSS)
      return [dt, dd];
    })
  );
  panelDescription.replaceChildren(
    ...info.description.split("\n\n").map((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    })
  );
  panelScroll.scrollTop = 0;
}

function setPanelOpen(open) {
  document.body.classList.toggle("is-focused", open);
  panel.inert = !open;
  panel.setAttribute("aria-hidden", String(!open));
}

// The part of the screen not covered by the panel (where the artwork should sit)
function getFreeArea(width, height) {
  const pad = 16;
  if (isPortrait()) {
    return { x: 0, y: pad, w: width, h: height - panel.offsetHeight - pad * 2 };
  }
  return { x: 0, y: 0, w: width - panel.offsetWidth, h: height };
}

// Works out where the camera should be to frame the chosen artwork in the free area
function computeFocusPose(pick) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const area = getFreeArea(width, height);
  let centre, direction, size, fill;

  if (pick.type === "soldier") {
    centre = new THREE.Vector3(0, PLINTH_HEIGHT + SOLDIER_HEIGHT / 2, 0);
    // A three-quarter view from slightly above, with empty space (not a poster) behind
    const a = deg(GAP_VIEW_ANGLE_DEG);
    const lift = deg(10);
    direction = new THREE.Vector3(
      Math.sin(a) * Math.cos(lift),
      Math.sin(lift),
      Math.cos(a) * Math.cos(lift)
    );
    size = { w: 0.5, h: SOLDIER_HEIGHT + 0.2 };
    fill = 0.85;
  } else {
    const poster = posters[pick.index];
    centre = new THREE.Vector3(poster.group.position.x, POSTER_CENTRE_Y, poster.group.position.z);
    direction = new THREE.Vector3(-centre.x, 0, -centre.z).normalize();   // straight in front of it
    size = { w: POSTER_WIDTH, h: poster.height };
    fill = isPortrait() ? 0.92 : 0.82;
  }

  // Distance at which the artwork fills `fill` of the free area (whichever side is tighter)
  const tanHalfFov = Math.tan(deg(camera.fov) / 2);
  let distance = Math.max(
    (size.h * height) / (2 * tanHalfFov * fill * area.h),
    (size.w * height) / (2 * tanHalfFov * fill * area.w)
  );
  if (pick.type === "poster") distance = Math.min(distance, RING_RADIUS - 0.2); // stay on this side of the soldier

  return {
    position: centre.clone().addScaledVector(direction, distance),
    target: centre,
    shiftX: width / 2 - (area.x + area.w / 2),
    shiftY: height / 2 - (area.y + area.h / 2),
  };
}

function applyViewShift(x, y) {
  viewShift.x = x;
  viewShift.y = y;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(width, height, x, y, width, height);
}

function startTween(to, onDone) {
  tween = {
    start: performance.now(),
    duration: reducedMotion ? 1 : FOCUS_DURATION,
    fromPosition: camera.position.clone(),
    fromTarget: lookTarget.clone(),
    fromShift: { ...viewShift },
    to,
    onDone,
  };
}

function updateTween(now) {
  const t = Math.min((now - tween.start) / tween.duration, 1);
  const k = easeInOutCubic(t);
  const { to } = tween;
  camera.position.lerpVectors(tween.fromPosition, to.position, k);
  lookTarget.lerpVectors(tween.fromTarget, to.target, k);
  camera.lookAt(lookTarget);
  applyViewShift(
    THREE.MathUtils.lerp(tween.fromShift.x, to.shiftX, k),
    THREE.MathUtils.lerp(tween.fromShift.y, to.shiftY, k)
  );
  if (t === 1) {
    const done = tween.onDone;
    tween = null;
    done();
  }
}

// Places the camera exactly on the focus view (used at the end of the move and after a resize)
function snapToFocus() {
  const pose = computeFocusPose(focused);
  camera.position.copy(pose.position);
  lookTarget.copy(pose.target);
  camera.lookAt(lookTarget);
  applyViewShift(pose.shiftX, pose.shiftY);
}

function openFocus(pick) {
  if (mode !== "exhibition") return;
  hideHint();
  stopOrbitMomentum();
  controls.enabled = false;            // the composition stays still while reading
  lookTarget.copy(controls.target);
  canvas.style.cursor = "default";

  focused = pick;
  mode = "moving";
  fillPanel(pick);                     // fill first so the panel's size can be measured
  setPanelOpen(true);

  startTween(computeFocusPose(pick), () => {
    mode = "focus";
    snapToFocus();
    panelTitle.focus({ preventScroll: true });
  });
}

function closeFocus() {
  if (mode === "exhibition" || returning) return;
  returning = true;
  mode = "moving";
  focused = null;                      // lets the poster start floating again
  setPanelOpen(false);

  const pose = getOpeningPose();
  startTween({ ...pose, shiftX: 0, shiftY: 0 }, () => {
    applyViewShift(0, 0);
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.enabled = true;
    controls.update();
    lookTarget.copy(controls.target);
    canvas.style.cursor = "grab";
    returning = false;
    mode = "exhibition";
  });
}

// ===============================================================
// 14. RESIZE (phone rotation, browser bars, desktop windows)
// ===============================================================
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = fovForAspect(camera.aspect);
  camera.updateProjectionMatrix();

  if (mode === "focus" && focused) snapToFocus();
  else applyViewShift(viewShift.x, viewShift.y);
});

// ===============================================================
// 15. ANIMATION LOOP
// ===============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const time = clock.elapsedTime;

  // Gentle floating; the poster being inspected eases to a stop
  posters.forEach((poster) => {
    const inspected = focused && focused.type === "poster" && focused.index === poster.index;
    poster.float += ((inspected ? 0 : 1) - poster.float) * Math.min(1, delta * 3);
    poster.group.position.y =
      POSTER_CENTRE_Y + Math.sin(time * poster.speed + poster.phase) * FLOAT_AMOUNT * poster.float;
  });

  if (tween) updateTween(performance.now());
  else if (mode === "exhibition") controls.update();

  renderer.render(scene, camera);
}

animate();
