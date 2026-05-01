import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const viewport = document.querySelector('#viewport');
const equipmentName = document.querySelector('#equipmentName');
const equipmentBody = document.querySelector('#equipmentBody');
const toggleFlow = document.querySelector('#toggleFlow');
const toggleMezzanine = document.querySelector('#toggleMezzanine');
const toggleLabels = document.querySelector('#toggleLabels');
const toggleItems = document.querySelector('#toggleItems');
const resetCamera = document.querySelector('#resetCamera');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11171d);
scene.fog = new THREE.Fog(0x11171d, 42, 92);

const camera = new THREE.PerspectiveCamera(46, viewport.clientWidth / viewport.clientHeight, 0.1, 180);
camera.position.set(9, 10, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
viewport.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.15, 3.75, 1.1);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.53;
controls.minDistance = 11;
controls.maxDistance = 64;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];
const flowMarkers = [];
const labels = [];
const animated = [];
const itemGroups = [];
let flowRunning = true;
let itemsVisible = true;
let mezzanineGroup;
let mezzanineLabel;

const anisotropy = renderer.capabilities.getMaxAnisotropy();

const mats = {
  floor: mat(0x687079, 0.58, 0.04, { map: makeNoiseTexture(0x6a737b, 0x555d64, 220, 0.18) }),
  wall: mat(0xd5dde2, 0.48, 0.0, { map: makeStripeTexture(0xdbe2e6, 0xc4cdd3, 128, 10) }),
  roof: mat(0xaeb8bf, 0.38, 0.24),
  steel: mat(0x8f9aa3, 0.32, 0.72),
  darkSteel: mat(0x45525c, 0.42, 0.64),
  stainless: mat(0xcbd4db, 0.16, 0.86, { envMapIntensity: 0.8 }),
  brushed: mat(0xb7c0c7, 0.2, 0.8, { map: makeStripeTexture(0xc8d0d6, 0x9faab2, 96, 5) }),
  acid: mat(0x224c63, 0.35, 0.35),
  frp: mat(0x2d6e80, 0.48, 0.12),
  silo: mat(0xded8c9, 0.34, 0.28),
  yellow: mat(0xf0b52d, 0.48, 0.12),
  pipeBlue: mat(0x4197d5, 0.28, 0.34),
  pipeRed: mat(0xb83f3f, 0.36, 0.24),
  pipeGreen: mat(0x4cae78, 0.34, 0.24),
  product: mat(0xe9ecef, 0.82, 0.0),
  rubber: mat(0x20252a, 0.72, 0.0),
  concrete: mat(0x444e55, 0.78, 0.0),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x9bd2ff,
    roughness: 0.05,
    transmission: 0.25,
    transparent: true,
    opacity: 0.42,
    metalness: 0.0
  }),
  liquid: new THREE.MeshPhysicalMaterial({
    color: 0x65b7d9,
    roughness: 0.06,
    transparent: true,
    opacity: 0.52,
    transmission: 0.2
  })
};

for (const material of Object.values(mats)) {
  if (material.map) {
    material.map.anisotropy = anisotropy;
    material.map.wrapS = THREE.RepeatWrapping;
    material.map.wrapT = THREE.RepeatWrapping;
  }
}

addLighting();
addBuilding();
addEquipment();
addPipeRuns();
addSafetyAndWarehouse();
syncLabelVisibility();
animate();

function addLighting() {
  scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x2d2620, 1.5));

  const sun = new THREE.DirectionalLight(0xfff1d3, 3.7);
  sun.position.set(-15, 28, 15);
  sun.castShadow = true;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.mapSize.set(4096, 4096);
  scene.add(sun);

  for (let x = -7.5; x <= 7.5; x += 5) {
    for (let z = -4.7; z <= 5.3; z += 5) {
      const light = new THREE.PointLight(0xe8f6ff, 34, 13, 2);
      light.position.set(x, 6.9, z);
      scene.add(light);
      scene.add(cylinder('LED high-bay lamp', 0.18, 0.12, [x, 6.55, z], mats.steel, Math.PI / 2));
    }
  }
}

function addBuilding() {
  const floor = box('acid-resistant epoxy floor', [12, 0.18, 12], [0, -0.09, 0], mats.floor);
  floor.receiveShadow = true;
  addSceneItem(floor);
  addGridLines();

  addSceneItem(box('rear insulated wall', [12, 5.2, 0.14], [0, 2.6, -6], mats.wall));
  addSceneItem(box('left insulated wall', [0.14, 5.2, 12], [-6, 2.6, 0], mats.wall));
  addSceneItem(box('partial right service wall', [0.14, 5.0, 4.2], [6, 2.5, -3.9], mats.wall));
  addSceneItem(box('small roof canopy over feed deck', [6.5, 0.14, 3.8], [-1.0, 7.1, -2.4], mats.roof));

  for (let x = -7.5; x <= 7.5; x += 5) {
    for (let z = -5; z <= 5; z += 5) {
      structuralColumn([x, 3.25, z], 6.5);
    }
  }

  addPipeRack([-5.4, 5.1, -4.4], [2.1, 5.1, -2.0], 1.5);
  addPipeRack([-2.5, 6.15, -2.5], [1.8, 6.15, 0.4], 1.6);
  addVerticalProcessStructure();
}

function addGridLines() {
  const lineMat = new THREE.LineBasicMaterial({ color: 0x39434b, transparent: true, opacity: 0.7 });
  const points = [];
  for (let x = -6; x <= 6; x += 2) points.push(new THREE.Vector3(x, 0.02, -6), new THREE.Vector3(x, 0.02, 6));
  for (let z = -6; z <= 6; z += 2) points.push(new THREE.Vector3(-6, 0.025, z), new THREE.Vector3(6, 0.025, z));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), lineMat));
}

function addVerticalProcessStructure() {
  const tower = new THREE.Group();
  tower.name = 'compact vertical process tower';
  tower.position.set(0.1, 0, 0.55);

  tower.add(supportFrame([5.2, 6.45, 5.6], [0, 0.05, 0], 0.09));
  tower.add(gratingDeck([4.9, 0.16, 5.25], [0, 1.15, 0]));
  tower.add(gratingDeck([4.6, 0.16, 4.7], [0, 2.25, -0.15]));
  tower.add(gratingDeck([4.25, 0.16, 4.2], [-0.1, 3.35, -0.35]));
  tower.add(gratingDeck([3.85, 0.16, 3.55], [-0.2, 4.55, -0.65]));
  tower.add(gratingDeck([3.4, 0.16, 2.8], [-0.65, 5.75, -2.05]));

  addGuardRails(tower, [4.9, 5.25], [0, 1.42, 0]);
  addGuardRails(tower, [4.6, 4.7], [0, 2.52, -0.15]);
  addGuardRails(tower, [4.25, 4.2], [-0.1, 3.62, -0.35]);
  addGuardRails(tower, [3.85, 3.55], [-0.2, 4.82, -0.65]);
  addGuardRails(tower, [3.4, 2.8], [-0.65, 6.02, -2.05]);

  tower.add(stair([2.62, 0.06, 2.4], 0.92));
  const stairA = stair([2.15, 1.22, 1.25], 0.92);
  stairA.rotation.y = -0.2;
  tower.add(stairA);
  const stairB = stair([1.75, 2.45, 0.2], 0.92);
  stairB.rotation.y = -0.2;
  tower.add(stairB);
  const stairC = stair([1.35, 3.72, -0.95], 0.92);
  stairC.rotation.y = -0.2;
  tower.add(stairC);

  addLevelTag(tower, 'L5 FEED', [-2.1, 5.95, -3.3]);
  addLevelTag(tower, 'L4 REACTION', [-2.25, 4.75, -2.3]);
  addLevelTag(tower, 'L3 EVAPORATION', [-2.45, 3.55, -1.25]);
  addLevelTag(tower, 'L2 CRYSTALS', [-2.55, 2.45, 0.15]);
  addLevelTag(tower, 'L1 DRY + PACK', [-2.65, 1.25, 1.75]);

  addLabel('Compact vertical process tower', new THREE.Vector3(0.0, 6.9, -0.4));
  addSceneItem(tower);
}

function addEquipment() {
  addUnit('T-101/T-102 H2SO4 Storage', 'Existing 30 m3 acid tanks from the study. HDPE/FRP lining, bund wall, PMI and thickness inspection required before operation; 30% H2SO4 feed is pumped upward to the reaction deck.', [-4.45, 1.35, -4.8], () => {
    const g = new THREE.Group();
    g.add(storageTank('T-101', [-0.9, 0, 0], mats.acid, 0.76, 2.7));
    g.add(storageTank('T-102', [0.9, 0, 0], mats.acid, 0.76, 2.7));
    g.add(bund([3.75, 0.42, 2.45], [0, -1.37, 0]));
    g.add(pumpSkid('P-101 acid feed pump', [1.78, -1.18, 0.88], mats.pipeRed));
    g.add(pipeSegment([1.45, -0.72, 0.55], [2.15, -0.72, 0.55], mats.pipeRed, 0.045));
    return g;
  }, [-0.1, 1.85, -0.25]);

  addUnit('T-103 MgO Silo + C-101', '20 m3 MgO silo with screw conveyor C-101 rated 2 t/hour. It is raised to the top feed deck so dry MgO can gravity-drop into the neutralization platform.', [-1.65, 4.95, -2.25], () => {
    const g = new THREE.Group();
    g.add(siloMesh('T-103 MgO silo A', [-0.62, 0, 0]));
    g.add(siloMesh('T-104 MgO silo B', [0.62, 0, 0]));
    g.add(supportFrame([2.8, 2.6, 1.9], [0, -1.32, 0]));
    g.add(servicePlatform([3.0, 0.14, 2.05], [0, -1.35, 0]));
    g.add(screwConveyor([0.95, -2.05, 0.72], 2.55, 0.16, Math.PI * 0.5));
    g.add(pumpSkid('P-102 dry-feed drive', [1.75, -2.02, 0.2], mats.steel));
    return g;
  }, [0, 2.2, -0.35]);

  addUnit('R-101/R-102 Neutralization', 'Primary 15 m3 and secondary 10 m3 SS316L/FRP reactors on the upper process deck. Study limits: 35-45 C, pH 6.5-7.5, 60-90 minute reaction, jacket cooling below 48 C.', [-1.15, 3.5, -1.25], () => {
    const g = new THREE.Group();
    g.add(reactor('R-101 15 m3', [-0.92, 0, 0], 0.82, 3.25));
    g.add(reactor('R-102 10 m3', [0.98, -0.2, 0], 0.68, 2.85));
    g.add(servicePlatform([3.4, 0.12, 1.95], [0, 1.08, 0]));
    g.add(heatExchanger('HX-101 cooling exchanger', [1.86, -1.28, -0.52]));
    return g;
  }, [-0.2, 2.15, -0.48]);

  addUnit('CL-101 + F-101 Filtration', '8 m3 clarifier and existing 25 m2 filter press on the middle deck below reaction. Gravity transfer reduces horizontal slurry piping before vacuum evaporation.', [-0.95, 2.35, -0.25], () => {
    const g = new THREE.Group();
    g.add(clarifier([-0.82, 0.1, 0]));
    g.add(filterPress([0.85, -0.18, 0.08]));
    g.add(bagFilter([1.95, -0.26, -0.58]));
    return g;
  }, [-0.35, 1.68, -0.35]);

  addUnit('EV-101 Vacuum Evaporator', '3 m3/hour SS316L vacuum evaporator set in the central high-bay tower, with condenser EV-102 and VP-101 below the shell. Operates at 0.2-0.3 bar absolute and 60-70 C.', [0.95, 3.05, 0.25], () => {
    const g = new THREE.Group();
    g.add(evaporator([0, 0.34, 0]));
    g.add(heatExchanger('EV-102 condenser', [-1.1, -1.12, -0.45], 1.25));
    g.add(pumpSkid('VP-101 vacuum pump', [1.22, -1.2, -0.58], mats.pipeGreen));
    g.add(servicePlatform([2.35, 0.12, 1.8], [0, 1.74, 0]));
    return g;
  }, [0.35, 2.6, -0.48]);

  addUnit('Crystallization Train', 'Cooling crystallizers sit one tier below the evaporator discharge so concentrated liquor drops into controlled cooling with short vertical transfer.', [1.4, 2.0, 1.18], () => {
    const g = new THREE.Group();
    g.add(crystallizer('CR-101', [-0.74, 0, 0]));
    g.add(crystallizer('CR-102', [0.74, 0, 0]));
    g.add(servicePlatform([2.35, 0.1, 1.48], [0, 0.92, 0]));
    g.add(pumpSkid('slurry transfer pump', [1.48, -0.74, 0.75], mats.pipeBlue));
    return g;
  }, [0.0, 1.68, -0.52]);

  addUnit('CF-101 Centrifuge Bay', 'SS316 centrifuge rated 2 t/hour separates crystals from mother liquor on a lower vibration-isolated deck directly below crystallization.', [1.35, 1.1, 2.35], () => {
    const g = new THREE.Group();
    g.add(centrifuge('CF-101A', [-0.62, 0, 0]));
    g.add(centrifuge('CF-101B', [0.72, 0, 0]));
    g.add(pipeSegment([-1.05, 0.62, -0.55], [1.2, 0.62, -0.55], mats.pipeBlue, 0.04));
    return g;
  }, [-0.32, 1.35, 0.42]);

  addUnit('FBD-101 Fluid Bed Dryer', '500 kg/hour SS316 fluid-bed dryer placed at the bottom product tier below centrifuges. BL-101 and HT-101 keep drying air at 40-45 C and final moisture below 1%.', [1.45, 0.95, 3.65], () => {
    const g = new THREE.Group();
    g.add(fluidBedDryer([0, 0, 0]));
    g.add(baghouse([1.7, 0.42, -0.02]));
    g.add(airHeater([-1.7, -0.02, -0.05]));
    return g;
  }, [0.25, 1.35, 0.52]);

  addUnit('PK-101 Screening + Bagging', 'Final screen, product hoppers, and automatic 25 kg bagger stay at grade under the vertical train discharge, beside dispatch pallets.', [1.6, 1.0, 5.25], () => {
    const g = new THREE.Group();
    g.add(vibratingScreen([-1.05, -0.08, 0]));
    g.add(productBin('SC-101 screen hopper', [0.08, 0.42, 0], 0.44, 1.75));
    g.add(productBin('PK-101 surge hopper', [1.08, 0.42, 0], 0.44, 1.75));
    g.add(baggingMachine([0.62, -0.58, 1.03]));
    g.add(conveyorBelt([-0.62, -0.7, 1.18], 2.35));
    return g;
  }, [-0.48, 1.65, 0.6]);

  addUnit('Utilities Yard', 'Utilities from the facility sheet: cooling water, compressed air, gas heating, 500 kVA electrical service, process water, and fire systems are grouped at the service side.', [4.5, 1.24, -4.45], () => {
    const g = new THREE.Group();
    g.add(coolingTower([0, 0, 0]));
    g.add(boilerRoom([-1.72, -0.34, 0.05]));
    g.add(airReceiver([-1.72, -0.35, 1.28]));
    g.add(waterTank([1.35, -0.2, 1.25]));
    return g;
  });

  addMezzanine();
  mezzanineGroup.visible = toggleMezzanine.checked;
}

function addMezzanine() {
  mezzanineGroup = new THREE.Group();
  mezzanineGroup.position.set(-4.35, 3.15, 4.0);
  mezzanineGroup.add(supportFrame([5.6, 3.0, 3.4], [0, -1.5, 0], 0.07));
  mezzanineGroup.add(gratingDeck([5.65, 0.18, 3.45], [0, 0, 0]));
  mezzanineGroup.add(box('control room glazing', [2.05, 1.42, 1.55], [-1.42, 0.82, -0.62], mats.glass));
  mezzanineGroup.add(box('QC laboratory envelope', [2.1, 1.42, 1.55], [1.02, 0.82, -0.62], mats.wall));
  mezzanineGroup.add(box('office and storage block', [2.45, 1.18, 1.05], [-0.1, 0.7, 1.1], mats.wall));
  mezzanineGroup.add(stair([2.78, -1.2, 1.52], 1.2));
  addGuardRails(mezzanineGroup, [5.65, 3.45], [0, 0.45, 0]);
  mezzanineLabel = addLabel('80 m2 mezzanine: PLC, lab, office', new THREE.Vector3(-4.35, 4.75, 4.0));
  addSceneItem(mezzanineGroup);
}

function addPipeRuns() {
  const processRoute = [
    [-4.25, 2.82, -4.7], [-1.65, 6.35, -2.25], [-1.15, 5.15, -1.25],
    [-0.95, 3.75, -0.25], [0.95, 5.35, 0.25], [1.4, 3.38, 1.18],
    [1.35, 2.2, 2.35], [1.45, 1.82, 3.65], [1.6, 1.62, 5.25]
  ];
  routePipe(processRoute, mats.pipeBlue, 0.075, true);

  routePipe([[-4.45, 1.55, -4.25], [-4.45, 5.95, -4.25], [-1.45, 5.65, -1.65]], mats.pipeRed, 0.055, true);
  routePipe([[-1.65, 6.25, -2.25], [-1.45, 5.58, -1.85], [-1.1, 5.1, -1.2]], mats.silo, 0.06, true);
  routePipe([[4.25, 2.05, -4.45], [3.3, 4.65, -1.2], [0.85, 4.7, 0.15]], mats.pipeGreen, 0.05, false);

  routePipe([[-0.8, 5.1, -1.0], [-0.8, 3.8, -0.15]], mats.pipeBlue, 0.045, true);
  routePipe([[0.92, 5.0, 0.35], [1.2, 3.35, 1.12]], mats.pipeBlue, 0.045, true);
  routePipe([[1.35, 3.15, 1.42], [1.35, 2.05, 2.22]], mats.pipeBlue, 0.045, true);
  routePipe([[1.42, 2.0, 2.72], [1.45, 1.62, 3.45]], mats.pipeBlue, 0.045, true);
}

function addSafetyAndWarehouse() {
  addSceneItem(box('finished goods marked zone', [3.5, 0.04, 1.8], [2.6, 0.04, 5.05], mat(0x26313a, 0.85, 0.0)));
  for (let i = 0; i < 18; i++) {
    const x = 1.25 + (i % 4) * 0.58;
    const z = 4.45 + Math.floor(i / 4) * 0.34;
    const bag = box('25 kg MgSO4 bags on pallet', [0.54, 0.18, 0.34], [x, 0.18 + Math.floor(i / 8) * 0.16, z], mats.product);
    bag.rotation.y = (i % 2) * 0.08;
    addSceneItem(bag);
  }
  addSceneItem(safetyShower([-5.15, 0.0, -1.1]));
  addSceneItem(box('lined trench drain', [8.2, 0.035, 0.12], [0.2, 0.035, 0.8], mat(0x252a2f, 0.7, 0.0)));
  addSceneItem(box('maintenance aisle coating', [9.2, 0.035, 0.82], [-0.1, 0.04, 2.15], mat(0x34404a, 0.86, 0.0)));
  addSceneItem(box('emergency exit stripe', [0.08, 0.04, 2.4], [5.86, 0.05, 2.8], mats.yellow));
}

function addUnit(name, description, position, builder, labelOffset = [0, 1.9, 0]) {
  const group = builder();
  group.position.set(...position);
  group.userData = { name, description };
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.unit = group.userData;
      clickable.push(child);
    }
  });
  addLabel(name, new THREE.Vector3(position[0] + labelOffset[0], position[1] + labelOffset[1], position[2] + labelOffset[2]));
  addSceneItem(group);
}

function addSceneItem(object) {
  object.userData.isPlantItem = true;
  itemGroups.push(object);
  scene.add(object);
  return object;
}

function addLabel(text, worldPos) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  const label = new CSS2DObject(div);
  label.position.copy(worldPos);
  labels.push(label);
  scene.add(label);
  return label;
}

function storageTank(name, pos, material, radius, height) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(`${name} cylindrical shell`, radius, height, [0, 0, 0], material));
  g.add(sphereCap(`${name} domed top`, radius, [0, height * 0.5, 0], material, false));
  g.add(sphereCap(`${name} dished bottom`, radius, [0, -height * 0.5, 0], material, true));
  g.add(cylinder(`${name} manway`, radius * 0.22, 0.1, [0.34, height * 0.58, 0], mats.steel, Math.PI / 2));
  g.add(cylinder(`${name} level gauge`, 0.035, height * 0.82, [radius + 0.07, 0, 0.18], mats.glass));
  addLadder(g, [-radius - 0.07, -height * 0.4, 0.22], height * 0.95);
  addBands(g, radius, height, material === mats.acid ? mats.frp : mats.steel);
  return g;
}

function siloMesh(name, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(`${name} shell`, 0.48, 3.15, [0, 0.25, 0], mats.silo));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.85, 64), mats.silo);
  cone.position.y = -1.78;
  g.add(cone);
  g.add(cylinder(`${name} top vent`, 0.16, 0.32, [0, 2.02, 0], mats.steel));
  g.add(cylinder(`${name} fill pipe`, 0.055, 2.15, [-0.38, 0.7, -0.38], mats.steel));
  addBands(g, 0.49, 3.1, mats.steel);
  addLadder(g, [0.58, -1.25, 0.06], 3.2);
  return g;
}

function reactor(name, pos, radius, height) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(`${name} SS316L shell`, radius, height, [0, 0, 0], mats.stainless));
  g.add(sphereCap(`${name} dished top`, radius, [0, height * 0.5, 0], mats.stainless, false));
  g.add(sphereCap(`${name} jacket bottom`, radius, [0, -height * 0.5, 0], mats.stainless, true));
  g.add(cylinder(`${name} cooling jacket band`, radius + 0.035, height * 0.56, [0, -0.18, 0], mats.glass));
  g.add(cylinder(`${name} agitator shaft`, 0.045, height + 0.65, [0, 0.35, 0], mats.darkSteel));
  const motor = motorBlock(`${name} agitator motor`, [0, height * 0.62 + 0.28, 0]);
  g.add(motor);
  g.add(cylinder(`${name} pH probe`, 0.025, 0.9, [-radius * 0.45, height * 0.46, radius * 0.38], mats.yellow, 0.55));
  g.add(pipeNozzle([radius + 0.05, 0.7, 0], 0.36, mats.pipeBlue));
  addBands(g, radius, height, mats.darkSteel);
  addLadder(g, [-radius - 0.08, -height * 0.38, -0.1], height * 0.92);
  animated.push({ mesh: motor, speed: 0.0016 });
  return g;
}

function clarifier(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('CL-101 clarifier shell', 0.78, 1.52, [0, 0.08, 0], mats.frp));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.55, 64), mats.frp);
  cone.position.y = -0.95;
  g.add(cone);
  g.add(cylinder('slow rake drive', 0.22, 0.18, [0, 0.95, 0], mats.steel, Math.PI / 2));
  g.add(pipeNozzle([0.86, 0.35, 0], 0.35, mats.pipeBlue));
  return g;
}

function filterPress(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('F-101 filter press frame left', [1.75, 0.12, 0.1], [0, 0.42, -0.48], mats.darkSteel));
  g.add(box('F-101 filter press frame right', [1.75, 0.12, 0.1], [0, 0.42, 0.48], mats.darkSteel));
  g.add(box('F-101 hydraulic end', [0.18, 0.84, 0.9], [-0.9, 0.02, 0], mats.steel));
  g.add(box('F-101 fixed end', [0.18, 0.84, 0.9], [0.9, 0.02, 0], mats.steel));
  for (let i = 0; i < 12; i++) {
    g.add(box('filter press plate stack', [0.055, 0.78, 0.84], [-0.58 + i * 0.1, 0.02, 0], i % 2 ? mats.wall : mats.product));
  }
  g.add(cylinder('filtrate manifold', 0.045, 2.0, [0, -0.48, 0.56], mats.pipeBlue, Math.PI / 2));
  return g;
}

function bagFilter(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('F-102 standby bag filter housing', 0.26, 0.95, [0, 0.05, 0], mats.frp));
  g.add(sphereCap('F-102 clamp lid', 0.26, [0, 0.52, 0], mats.steel, false));
  g.add(pipeNozzle([0.3, 0.2, 0], 0.28, mats.pipeBlue));
  g.add(box('F-102 small skid frame', [0.68, 0.12, 0.44], [0, -0.48, 0], mats.darkSteel));
  return g;
}

function evaporator(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('EV-101 vapor body polished shell', 0.72, 4.2, [0, 0.34, 0], mats.stainless));
  g.add(sphereCap('EV-101 upper vapor dome', 0.72, [0, 2.44, 0], mats.stainless, false));
  g.add(cylinder('EV-101 lower calandria', 0.54, 1.2, [0, -1.95, 0], mats.brushed));
  g.add(cylinder('sight glass', 0.04, 1.05, [0.76, -0.35, 0.12], mats.glass));
  g.add(cylinder('vapor outlet elbow riser', 0.07, 1.25, [0.0, 2.92, 0.58], mats.pipeGreen));
  g.add(pipeNozzle([0.75, 0.8, 0], 0.38, mats.pipeBlue));
  addBands(g, 0.73, 4.2, mats.darkSteel);
  addLadder(g, [-0.86, -1.58, -0.05], 4.3);
  return g;
}

function crystallizer(name, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(`${name} cooled crystallizer`, 0.62, 2.05, [0, 0, 0], mats.stainless));
  g.add(sphereCap(`${name} dished cover`, 0.62, [0, 1.03, 0], mats.stainless, false));
  g.add(cylinder(`${name} cooling coil`, 0.66, 1.2, [0, -0.15, 0], mats.glass));
  g.add(motorBlock(`${name} slow mixer`, [0, 1.32, 0], 0.78));
  addBands(g, 0.62, 2.05, mats.darkSteel);
  return g;
}

function centrifuge(name, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box(`${name} inertia base`, [1.0, 0.18, 0.74], [0, -0.52, 0], mats.concrete));
  g.add(cylinder(`${name} horizontal basket`, 0.43, 1.0, [0, 0.0, 0], mats.stainless, Math.PI / 2));
  g.add(cylinder(`${name} dark tire ring`, 0.46, 0.12, [-0.55, 0, 0], mats.rubber, Math.PI / 2));
  g.add(cylinder(`${name} drive coupling`, 0.22, 0.42, [0.72, 0, 0], mats.darkSteel, Math.PI / 2));
  g.add(box(`${name} motor cover`, [0.58, 0.42, 0.46], [0.96, -0.08, 0], mats.steel));
  return g;
}

function fluidBedDryer(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('FBD-101 perforated bed housing', [2.72, 0.72, 1.08], [0, 0, 0], mats.brushed));
  g.add(box('FBD-101 plenum chamber', [2.55, 0.35, 0.96], [0, -0.52, 0], mats.darkSteel));
  g.add(cylinder('FBD-101 exhaust hood', 0.34, 1.2, [0.78, 0.72, 0], mats.stainless));
  g.add(cylinder('FBD-101 inspection window', 0.16, 0.04, [-0.68, 0.16, 0.57], mats.glass, Math.PI / 2));
  g.add(conveyorBelt([-1.56, -0.42, 0.0], 1.15));
  return g;
}

function baghouse(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('dust collector bag filter', 0.45, 1.62, [0, 0, 0], mats.steel));
  g.add(sphereCap('baghouse top cap', 0.45, [0, 0.82, 0], mats.steel, false));
  for (let x = -0.32; x <= 0.32; x += 0.32) {
    g.add(cylinder('filter cartridge detail', 0.055, 1.0, [x, -0.08, 0.47], mats.product));
  }
  return g;
}

function airHeater(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('BL-101 hot air blower', 0.27, 0.72, [0, -0.05, 0], mats.pipeGreen, Math.PI / 2));
  g.add(box('HT-101 air heater', [0.78, 0.52, 0.58], [-0.78, -0.05, 0], mats.steel));
  g.add(pipeSegment([0.38, 0.05, 0], [1.28, 0.05, 0], mats.pipeGreen, 0.1));
  return g;
}

function vibratingScreen(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const screen = box('SC-101 vibrating screen deck', [1.28, 0.34, 0.78], [0, 0, 0], mats.stainless);
  screen.rotation.z = -0.08;
  g.add(screen);
  g.add(cylinder('screen drive motor', 0.18, 0.45, [0.72, -0.05, 0], mats.darkSteel, Math.PI / 2));
  return g;
}

function productBin(name, pos, radius, height) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(name, radius, height, [0, 0, 0], mats.silo));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, 0.62, 48), mats.silo);
  cone.position.y = -height * 0.5 - 0.28;
  g.add(cone);
  addBands(g, radius, height, mats.steel);
  return g;
}

function baggingMachine(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('PK-101 bagging frame', [1.0, 1.0, 0.82], [0, 0, 0], mats.steel));
  g.add(box('weighing head', [0.42, 0.28, 0.42], [0, 0.62, 0.08], mats.yellow));
  g.add(box('filled bag station', [0.46, 0.42, 0.28], [0, -0.46, 0.48], mats.product));
  return g;
}

function coolingTower(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('cooling tower basin', [1.34, 0.34, 1.12], [0, -0.56, 0], mats.pipeGreen));
  g.add(box('cooling tower louvered body', [1.18, 1.7, 0.98], [0, 0.45, 0], mats.glass));
  for (let y = -0.05; y <= 0.85; y += 0.18) {
    g.add(box('cooling tower louvers', [1.22, 0.035, 1.02], [0, y, 0], mats.darkSteel));
  }
  g.add(cylinder('fan stack', 0.38, 0.32, [0, 1.48, 0], mats.steel));
  return g;
}

function boilerRoom(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('gas boiler skid', [1.38, 0.9, 0.95], [0, 0, 0], mats.pipeRed));
  g.add(cylinder('boiler stack', 0.11, 1.5, [0.4, 0.92, -0.22], mats.darkSteel));
  return g;
}

function airReceiver(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('compressed air receiver', 0.34, 1.18, [0, 0, 0], mats.steel, Math.PI / 2));
  g.add(box('receiver saddles', [0.98, 0.12, 0.12], [0, -0.36, 0], mats.darkSteel));
  return g;
}

function waterTank(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('50 m3 process water tank', 0.5, 1.35, [0, 0, 0], mats.glass));
  g.add(sphereCap('water tank top', 0.5, [0, 0.68, 0], mats.glass, false));
  return g;
}

function pumpSkid(name, pos, material) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box(`${name} base`, [0.78, 0.12, 0.42], [0, -0.22, 0], mats.darkSteel));
  g.add(cylinder(`${name} casing`, 0.18, 0.32, [-0.16, 0, 0], material, Math.PI / 2));
  g.add(box(`${name} motor`, [0.38, 0.28, 0.3], [0.25, 0, 0], mats.steel));
  return g;
}

function heatExchanger(name, pos, scale = 1) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder(name, 0.22 * scale, 1.18 * scale, [0, 0, 0], mats.brushed, Math.PI / 2));
  g.add(cylinder(`${name} channel head A`, 0.24 * scale, 0.12 * scale, [-0.64 * scale, 0, 0], mats.steel, Math.PI / 2));
  g.add(cylinder(`${name} channel head B`, 0.24 * scale, 0.12 * scale, [0.64 * scale, 0, 0], mats.steel, Math.PI / 2));
  for (let z = -0.12; z <= 0.12; z += 0.12) {
    g.add(pipeSegment([-0.45 * scale, z, 0.25 * scale], [0.45 * scale, z, 0.25 * scale], mats.pipeGreen, 0.018 * scale));
  }
  return g;
}

function bund(size, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('acid bund floor', [size[0], 0.12, size[2]], [0, -0.12, 0], mats.concrete));
  g.add(box('acid bund front wall', [size[0], size[1], 0.14], [0, size[1] * 0.5 - 0.12, size[2] * 0.5], mats.pipeRed));
  g.add(box('acid bund rear wall', [size[0], size[1], 0.14], [0, size[1] * 0.5 - 0.12, -size[2] * 0.5], mats.pipeRed));
  g.add(box('acid bund side wall', [0.14, size[1], size[2]], [-size[0] * 0.5, size[1] * 0.5 - 0.12, 0], mats.pipeRed));
  g.add(box('acid bund side wall', [0.14, size[1], size[2]], [size[0] * 0.5, size[1] * 0.5 - 0.12, 0], mats.pipeRed));
  return g;
}

function supportFrame(size, pos, member = 0.06) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const [w, h, d] = size;
  for (const x of [-w / 2, w / 2]) {
    for (const z of [-d / 2, d / 2]) {
      g.add(box('structural steel column', [member, h, member], [x, h / 2, z], mats.darkSteel));
    }
  }
  for (const y of [0.08, h]) {
    g.add(box('structural steel beam', [w + member, member, member], [0, y, -d / 2], mats.darkSteel));
    g.add(box('structural steel beam', [w + member, member, member], [0, y, d / 2], mats.darkSteel));
    g.add(box('structural steel beam', [member, member, d + member], [-w / 2, y, 0], mats.darkSteel));
    g.add(box('structural steel beam', [member, member, d + member], [w / 2, y, 0], mats.darkSteel));
  }
  return g;
}

function structuralColumn(pos, height) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('I-column web', [0.07, height, 0.28], [0, 0, 0], mats.darkSteel));
  g.add(box('I-column flange', [0.25, height, 0.055], [0, 0, -0.15], mats.darkSteel));
  g.add(box('I-column flange', [0.25, height, 0.055], [0, 0, 0.15], mats.darkSteel));
  scene.add(g);
}

function addPipeRack(a, b, height) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const count = Math.max(2, Math.floor(dir.length() / 2.4));
  for (let i = 0; i <= count; i++) {
    const p = start.clone().lerp(end, i / count);
    scene.add(box('pipe rack support', [0.1, height, 0.1], [p.x, p.y - height / 2, p.z - 0.6], mats.darkSteel));
    scene.add(box('pipe rack cross beam', [0.1, 0.1, 1.35], [p.x, p.y, p.z], mats.darkSteel));
  }
  scene.add(pipeSegment(a, b, mats.pipeBlue, 0.055));
  scene.add(pipeSegment([a[0], a[1] + 0.18, a[2] - 0.3], [b[0], b[1] + 0.18, b[2] - 0.3], mats.pipeRed, 0.045));
}

function gratingDeck(size, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('steel grating deck frame', size, [0, 0, 0], mats.steel));
  const [w, , d] = size;
  for (let x = -w / 2 + 0.25; x <= w / 2 - 0.25; x += 0.35) {
    g.add(box('deck grating ribs', [0.025, 0.04, d], [x, 0.12, 0], mats.darkSteel));
  }
  return g;
}

function servicePlatform(size, pos) {
  const g = gratingDeck(size, pos);
  addGuardRails(g, [size[0], size[2]], [0, 0.28, 0]);
  return g;
}

function addGuardRails(group, size, pos) {
  const [w, d] = size;
  const railY = pos[1] + 0.52;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.55) {
    group.add(cylinder('platform rail post', 0.022, 0.7, [pos[0] + x, pos[1] + 0.3, pos[2] - d / 2], mats.yellow));
    group.add(cylinder('platform rail post', 0.022, 0.7, [pos[0] + x, pos[1] + 0.3, pos[2] + d / 2], mats.yellow));
  }
  for (let z = -d / 2; z <= d / 2 + 0.01; z += 0.55) {
    group.add(cylinder('platform rail post', 0.022, 0.7, [pos[0] - w / 2, pos[1] + 0.3, pos[2] + z], mats.yellow));
    group.add(cylinder('platform rail post', 0.022, 0.7, [pos[0] + w / 2, pos[1] + 0.3, pos[2] + z], mats.yellow));
  }
  group.add(pipeSegment([pos[0] - w / 2, railY, pos[2] - d / 2], [pos[0] + w / 2, railY, pos[2] - d / 2], mats.yellow, 0.025));
  group.add(pipeSegment([pos[0] - w / 2, railY, pos[2] + d / 2], [pos[0] + w / 2, railY, pos[2] + d / 2], mats.yellow, 0.025));
  group.add(pipeSegment([pos[0] - w / 2, railY, pos[2] - d / 2], [pos[0] - w / 2, railY, pos[2] + d / 2], mats.yellow, 0.025));
  group.add(pipeSegment([pos[0] + w / 2, railY, pos[2] - d / 2], [pos[0] + w / 2, railY, pos[2] + d / 2], mats.yellow, 0.025));
}

function addLevelTag(group, text, pos) {
  const tag = box(text, [1.18, 0.08, 0.34], pos, mats.yellow);
  tag.name = text;
  group.add(tag);
}

function stair(pos, width) {
  const g = new THREE.Group();
  g.position.set(...pos);
  for (let i = 0; i < 9; i++) {
    g.add(box('mezzanine stair tread', [width, 0.08, 0.28], [0, i * 0.16, i * -0.24], mats.darkSteel));
  }
  g.add(pipeSegment([-width / 2, 0.1, 0.1], [-width / 2, 1.58, -2.1], mats.yellow, 0.025));
  g.add(pipeSegment([width / 2, 0.1, 0.1], [width / 2, 1.58, -2.1], mats.yellow, 0.025));
  return g;
}

function conveyorBelt(pos, length) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(box('product conveyor belt', [length, 0.12, 0.38], [0, 0, 0], mats.rubber));
  g.add(cylinder('conveyor roller', 0.12, 0.42, [-length / 2, 0, 0], mats.steel, Math.PI / 2));
  g.add(cylinder('conveyor roller', 0.12, 0.42, [length / 2, 0, 0], mats.steel, Math.PI / 2));
  return g;
}

function screwConveyor(pos, length, radius, rotationZ) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const tube = cylinder('C-101 screw conveyor trough', radius, length, [0, 0, 0], mats.stainless, rotationZ);
  tube.rotation.x = 0.18;
  g.add(tube);
  for (let i = 0; i < 9; i++) {
    const blade = box('screw flight detail', [0.04, 0.24, 0.24], [-length / 2 + i * length / 8, 0, 0], mats.darkSteel);
    blade.rotation.x = i * 0.75;
    g.add(blade);
  }
  return g;
}

function safetyShower(pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('safety shower riser', 0.04, 1.8, [0, 0.9, 0], mats.yellow));
  g.add(pipeSegment([0, 1.75, 0], [0.45, 1.75, 0], mats.yellow, 0.035));
  g.add(cylinder('safety shower head', 0.16, 0.08, [0.52, 1.75, 0], mats.steel, Math.PI / 2));
  return g;
}

function addLadder(group, pos, height) {
  group.add(pipeSegment([pos[0], pos[1], pos[2] - 0.12], [pos[0], pos[1] + height, pos[2] - 0.12], mats.yellow, 0.018));
  group.add(pipeSegment([pos[0], pos[1], pos[2] + 0.12], [pos[0], pos[1] + height, pos[2] + 0.12], mats.yellow, 0.018));
  for (let y = pos[1] + 0.18; y < pos[1] + height; y += 0.28) {
    group.add(pipeSegment([pos[0], y, pos[2] - 0.12], [pos[0], y, pos[2] + 0.12], mats.yellow, 0.014));
  }
}

function addBands(group, radius, height, material) {
  for (const y of [-height * 0.28, 0, height * 0.28]) {
    group.add(cylinder('reinforcing shell band', radius + 0.018, 0.035, [0, y, 0], material));
  }
}

function pipeNozzle(pos, length, material) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.add(cylinder('equipment nozzle neck', 0.07, length, [length * 0.5, 0, 0], material, Math.PI / 2));
  g.add(cylinder('equipment nozzle flange', 0.13, 0.055, [length + 0.02, 0, 0], mats.darkSteel, Math.PI / 2));
  return g;
}

function routePipe(points, material, radius, hasFlow) {
  for (let i = 0; i < points.length - 1; i++) {
    scene.add(pipeSegment(points[i], points[i + 1], material, radius));
    addFlange(points[i], material, radius);
    addFlange(points[i + 1], material, radius);
    if (hasFlow) addFlowMarker(points[i], points[i + 1], material.color?.getHex?.() ?? 0x4da3ff);
  }
}

function pipeSegment(a, b, material, radius = 0.055) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(end, start).normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addFlange(point, material, radius) {
  const flange = cylinder('pipe flange pair', radius * 1.75, 0.055, point, mats.darkSteel, Math.PI / 2);
  scene.add(flange);
}

function addFlowMarker(a, b, color = 0x4da3ff) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.4 })
  );
  marker.userData = {
    start: new THREE.Vector3(...a),
    end: new THREE.Vector3(...b),
    offset: Math.random()
  };
  flowMarkers.push(marker);
  scene.add(marker);
}

function box(name, size, pos, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  return mesh;
}

function cylinder(name, radius, height, pos, material, rotateZ = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64), material);
  mesh.name = name;
  mesh.position.set(...pos);
  if (rotateZ) mesh.rotation.z = rotateZ;
  return mesh;
}

function sphereCap(name, radius, pos, material, bottom) {
  const geo = new THREE.SphereGeometry(radius, 64, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.scale.y = 0.32;
  mesh.rotation.x = bottom ? Math.PI : 0;
  return mesh;
}

function motorBlock(name, pos, scale = 1) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.name = name;
  g.add(box(`${name} gearbox`, [0.42 * scale, 0.26 * scale, 0.42 * scale], [0, 0, 0], mats.steel));
  g.add(cylinder(`${name} cooling fan`, 0.2 * scale, 0.12 * scale, [0, 0.22 * scale, 0], mats.darkSteel, Math.PI / 2));
  return g;
}

function mat(color, roughness, metalness, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function makeNoiseTexture(a, b, size, variance) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  for (let i = 0; i < image.data.length; i += 4) {
    const t = Math.random() * variance;
    const c = ca.clone().lerp(cb, t);
    image.data[i] = c.r * 255;
    image.data[i + 1] = c.g * 255;
    image.data[i + 2] = c.b * 255;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(6, 5);
  return texture;
}

function makeStripeTexture(a, b, size, stripeWidth) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${a.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = `#${b.toString(16).padStart(6, '0')}`;
  for (let y = 0; y < size; y += stripeWidth * 2) ctx.fillRect(0, y, size, stripeWidth);
  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(2, 8);
  return texture;
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable, false)[0];
  if (!hit?.object?.userData?.unit) return;
  const { name, description } = hit.object.userData.unit;
  equipmentName.textContent = name;
  equipmentBody.textContent = description;
}

function resize() {
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  labelRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  controls.update();

  animated.forEach(({ mesh, speed }) => {
    mesh.rotation.y = time * speed;
  });

  if (flowRunning) {
    flowMarkers.forEach((marker, index) => {
      const t = ((time * 0.00018) + marker.userData.offset + index * 0.06) % 1;
      marker.position.lerpVectors(marker.userData.start, marker.userData.end, t);
    });
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

toggleFlow.addEventListener('click', () => {
  flowRunning = !flowRunning;
  toggleFlow.textContent = flowRunning ? 'Pause Flow' : 'Resume Flow';
});

toggleMezzanine.addEventListener('change', () => {
  mezzanineGroup.visible = itemsVisible && toggleMezzanine.checked;
  syncLabelVisibility();
});

toggleLabels.addEventListener('change', () => {
  syncLabelVisibility();
});

toggleItems.addEventListener('click', () => {
  itemsVisible = !itemsVisible;
  toggleItems.textContent = itemsVisible ? 'Hide Items' : 'Show Items';
  scene.traverse((object) => {
    if (object.isMesh || object.isLine || object.isLineSegments) {
      object.visible = itemsVisible;
    }
  });
  if (mezzanineGroup) {
    mezzanineGroup.visible = itemsVisible && toggleMezzanine.checked;
  }
  syncLabelVisibility();
});

resetCamera.addEventListener('click', () => {
  camera.position.set(9, 10, 18);
  controls.target.set(0.15, 3.75, 1.1);
});

function syncLabelVisibility() {
  labels.forEach((label) => {
    const isMezzanine = label === mezzanineLabel || label.element.textContent.toLowerCase().includes('mezzanine');
    const show = itemsVisible && toggleLabels.checked && (!isMezzanine || toggleMezzanine.checked);
    label.visible = show;
    label.element.style.display = show ? 'block' : 'none';
  });
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);
