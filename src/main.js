import './style.css';
import * as THREE from 'three';
import { createStation } from './world.js';
import { createDistricts } from './districts.js';
import { createFirstPersonControls } from './controls.js';
import { createAmbientAudio } from './audio.js';
import { createAtmosphere } from './atmosphere.js';
import { createFurnishings } from './furnishings.js';
import { createPopulation } from './population.js';
import { createCommerce } from './commerce.js';
import { createStationLife } from './station-life.js';
import { createImportedModels, prefetchImportedModels } from './imported-models.js';
import { createLighting } from './lighting.js';
import { createGlow } from './glow.js';
import { createRenderGovernor } from './render-governor.js';
import { createNavigation, sectorAt } from './navigation.js';
import { createStationPlan } from './station-plan.js';
import { createPublicLifts } from './public-lifts.js';
import {createEscalators} from './escalators.js';
import { CONCOURSE_LEVELS, PUBLIC_LIFT_SHAFTS, concourseLevelAt } from './concourse-levels.js';
import { box, panelMaterial, glowMaterial } from './kit.js';
import { createSignage } from './signage.js';
import { createSectorVisibility } from './visibility.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#station');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch-device', isTouch);
$('#motion-setting').checked = prefersReducedMotion.matches;

const sectors = {
  concourse: { name: 'The concourse', description: 'Street-level transfers. A city above.', position: [0, 1.75, 48], yaw: 0 },
  observation: { name: 'Observation gallery', description: 'Take the long ramp toward infinity.', position: [75, 1.75, -20], yaw: -Math.PI / 2 },
  market: { name: 'The exchange', description: 'Follow the cloth roofs. Find something strange.', position: [-62, 1.75, 30], yaw: Math.PI / 2 },
  docks: { name: 'Transit docks', description: 'Clear customs. Find your next world.', position: [0, 1.75, -154], yaw: 0 },
  promenade: {name:'Public promenade',description:'Concourse / Deck 02 trade walks',position:[-24,9.375,48],yaw:.2},
  galleries: {name:'Lantern galleries',description:'Concourse / Deck 03',position:[-24,19.375,-52],yaw:-Math.PI/2},
  express: {name:'Express overlook',description:'Concourse / Deck 04',position:[-27,25.11,-58],yaw:-Math.PI/2},
};
const terminalData = [
  { x: -10, z: 18, code: 'PFC—001 / PUBLIC ARRIVALS', title: 'Welcome to the in-between.', text: [
    'Port FreeCommerce recognizes all valid transit credentials and no particular allegiance. Please keep your belongings, your contracts, and your opinions close.',
    'The <strong>Exchange</strong> winds west of the concourse. The <strong>Observation Gallery</strong> rises east toward the rings. Departures branch into three boarding piers at the far end. Long amber ramps near Arrivals lead to the <strong>Deck 02 public promenade</strong>. Three <strong>escalator pairs</strong> connect Decks 01 and 02 at Arrivals, Interchange, and Departures: west goes up, east goes down. The <strong>lantern lifts</strong> beside the northern rest bays serve all four concourse decks, including the Lantern Galleries and Express Overlook.',
    'Station notice: the security feed is functioning normally. It has always been functioning normally.',
  ] },
  { x: 89, z: -20, code: 'PFC—029 / ORBITAL OBSERVATION', title: 'Everything keeps moving.', text: [
    'The gas giant below is designated <strong>Pelagos</strong> by local navigators. Its upper cloud bands travel faster than most commercial freighters. You are currently watching a storm larger than a continent.',
    'The gallery is a quiet zone. Recording, thinking, and doing absolutely nothing are permitted. For once, none of these activities carries a fee.',
    'An automated cleaning drone would like you to know that the glass has just been cleaned.',
  ] },
  { x: -72, z: 30, code: 'PFC—103 / COMMERCIAL DIRECTORY', title: 'Anything, for a price.', text: [
    '<strong>Salt + Static</strong> — preserved delicacies from places you have never been. <strong>Second Orbit</strong> — pre-owned equipment with a convincingly blank history.',
    '<strong>Hot Noodles</strong> — open throughout all recognized station cycles. No questions. Actual noodles. The stall owner considers both facts equally important.',
    'All transactions are final unless you know someone. Management cannot confirm whether you know someone.',
  ] },
  { x: 5, z: -164, code: 'PFC—407 / TRANSIT AUTHORITY', title: 'There is always another ship.', text: [
    '<strong>Dock 07 · Long-haul transport</strong><br>Status: cargo transfer in progress. Passenger boarding will begin when cargo transfer ends. Cargo transfer will end when it is finished.',
    '<strong>Gate 06</strong> branches west for the orbital shuttle. <strong>Gate 07</strong> continues ahead to the liner. <strong>Gate 08</strong> branches east for the freight tender. Passenger routing ends at the sealed locks.',
    'Please do not follow unaccompanied service units into maintenance corridors. The service units have their own problems.',
    'Your next destination can wait a little longer. Take the long way back.',
  ] },
];
const interactables = [...terminalData];
const conversations = [
  {sector: 'concourse', x: 0, z: 36, radius: 29, speaker: 'PASSING TRAVELERS', lines: ['The departure time is local. The delay is universal.', 'I booked the quiet compartment. Apparently that was a suggestion.', 'Same station next orbit? If the contract lets us.']},
  {sector: 'concourse', x: -17.5, z: 42, radius: 18, speaker: 'TEA CARAVAN / TRANSLATED', lines: ['If it remembers rain, it is real tea.', 'One cup for the journey. Another for the person you were before it.']},
  {sector: 'concourse', x: 17.5, z: -76, radius: 19, speaker: 'SPECIMEN BROKER', lines: ['It only glows when it is homesick.', 'The permit says ornamental. Please do not ask what it eats.']},
  {sector: 'market', x: -61, z: 30, radius: 32, speaker: 'A STALLHOLDER', lines: ['Warm food. Clean air. Two things still worth paying for.', 'The blue spice is mild. The label is a separate problem.', 'A fair price in three currencies. An unfair price in all the others.']},
  {sector: 'market', x: -79, z: 35, radius: 14, speaker: 'SALVAGE TECHNICIAN', lines: ['That is a diagnostic chirp. If it starts singing, step back.', 'Rebuilt twice. Loved at least once. Still has the original opinions.']},
  {sector: 'observation', x: 75, z: -20, radius: 32, speaker: 'BY THE GLASS', lines: ['Third ring. There. That is where the dust catches the light.', 'We have crossed six systems. This is the first time they have put their bag down.', 'Keep looking. Nothing this large is ever really still.']},
  {sector: 'docks', x: 0, z: -155, radius: 28, speaker: 'DOCK CREW / LOCAL CHANNEL', lines: ['The little crate is heavier. The large crate is angry.', 'Boarding group seven: please stop rejoining boarding group six.', 'The next ship is somebody’s way home. Treat it accordingly.']},
];

let scene, camera, renderer, lighting, governor, glowLayer, signage, visibility, station, districts, controls, audio, atmosphere, furnishings, population, commerce, stationLife, importedModels, navigation, journeyNavigation, stationPlan, publicLifts, escalators;
let mode = 'arrival';
let activeSector = '';
let elapsed = 0;
let currentTerminal = null;
let toastTimer;
let animationFrame;
let transitTimer;
let intentionalUnlock = false;
let ready = false;
let reducedMotion = prefersReducedMotion.matches;
const visited = new Set();
const terminalScreens = [];
const colliders = [];
const effectContext = {reducedMotion};
const roomAtmospheres = {
  concourse:{color:new THREE.Color('#1a2a2e'),density:.004},
  observation:{color:new THREE.Color('#14272e'),density:.0028},
  market:{color:new THREE.Color('#302a24'),density:.0065},
  docks:{color:new THREE.Color('#15232d'),density:.0036},
};
let lastDeckLabel='';
let disposed=false;
let lastSceneRender=-Infinity;
const terminalGroups=[];
let pixelRatioQuery=null;
const interactionHint = $('#interaction-hint');
const touchInteract = $('#touch-interact');
const compassHeading = $('#compass-heading');
let lastHeading = '';
let chatterEnabled = true;
let nextChatterAt = 0;
let chatterUntil = 0;
let chatterTick = 0;
let chatterSector = '';
let shownConversations = 0;
let audioToggleRequest = 0;
let audioVolume = .55;
let footstepsEnabled = true;
let selectedLift = null;
let lastLiftRide = false;
let lastInteractionLabel = '';
try {
  const storedVolume = localStorage.getItem('pfc-audio-volume');
  if (storedVolume !== null && Number.isFinite(Number(storedVolume))) audioVolume = Math.max(0,Math.min(1,Number(storedVolume)));
  footstepsEnabled = localStorage.getItem('pfc-audio-footsteps') !== 'false';
} catch { /* Settings remain available when browser storage is unavailable. */ }
const chatter = $('#station-chatter');
const chatterSpeaker = $('#chatter-speaker');
const chatterLine = $('#chatter-line');
const interactionLabel = $('#interaction-label');

function syncAudioControls() {
  const enabled = audio?.enabled ?? false;
  document.body.classList.toggle('sound-enabled',enabled);
  $('#sound-button').setAttribute('aria-label',enabled ? 'Mute station sound' : 'Enable station sound');
  $('#sound-button').setAttribute('aria-pressed',String(enabled));
  $('#audio-enabled-setting').checked = enabled;
  $('#audio-volume').value = String(Math.round(audioVolume*100));
  $('#audio-volume-value').textContent = `${Math.round(audioVolume*100)}%`;
  $('#footsteps-setting').checked = footstepsEnabled;
}

async function toggleAudio(enabled) {
  if (!audio) return;
  const request = ++audioToggleRequest;
  const started = await audio.setEnabled(enabled);
  if (request !== audioToggleRequest || disposed) return;
  syncAudioControls();
  toast(enabled && !started && !audio.enabled ? 'Sound could not start. Tap the sound control to try again.' : audio.enabled ? 'STATION SOUNDS / On' : 'STATION SOUNDS / Off');
}

function updateConversations(dt) {
  chatterTick += dt;
  if (chatterTick < .25) return;
  chatterTick = 0;
  const now = performance.now() / 1000;
  if (mode !== 'exploring' || !chatterEnabled || currentTerminal || $('#toast').classList.contains('visible')) {
    chatter.classList.remove('visible');
    return;
  }
  if (activeSector !== chatterSector) {
    chatterSector = activeSector;
    chatterUntil = 0;
    nextChatterAt = now + 5;
    chatter.classList.remove('visible');
  }
  if (now < chatterUntil) return;
  chatter.classList.remove('visible');
  if (now < nextChatterAt) return;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const spot of conversations) {
    if (spot.sector !== activeSector) continue;
    const distance = (spot.x - camera.position.x) ** 2 + (spot.z - camera.position.z) ** 2;
    if (distance < spot.radius ** 2 && distance < nearestDistance) { nearest = spot; nearestDistance = distance; }
  }
  if (!nearest) return;
  nearest.turn = (nearest.turn ?? -1) + 1;
  chatterSpeaker.textContent = nearest.speaker;
  const line = nearest.lines[nearest.turn % nearest.lines.length];
  chatterLine.textContent = nearest.notice ? line : `“${line}”`;
  chatter.classList.add('visible');
  chatterUntil = now + 6.5;
  nextChatterAt = now + 23;
  shownConversations++;
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}

function showError(error) {
  console.error(error);
  $('#loading').hidden = true;
  $('#error').hidden = false;
  $('#enter-button').disabled = true;
}

function canWalk(x, z, feet) {
  if(!navigation?.canWalk(x,z,feet))return false;
  // People are solid to a visitor on foot, though never a trap: a step that
  // moves away from someone is always allowed.
  if(mode==='exploring'&&camera) {
    const fromX=camera.position.x,fromZ=camera.position.z;
    if(population?.obstructs(x,z,feet,fromX,fromZ)||districts?.obstructs(x,z,feet,fromX,fromZ))return false;
  }
  return true;
}

function updateNearbyInteractable() {
  let next=null;
  if(mode==='exploring'&&!publicLifts?.riding){
    next=publicLifts?.getInteraction(camera.position)||null;
    if(!next){
      let nearest=Infinity;
      for(const terminal of interactables){
        const distance=(terminal.x-camera.position.x)**2+(terminal.z-camera.position.z)**2+((terminal.y||0)-(camera.position.y-1.75))**2;
        if(distance<(terminal.radius??3.8)**2&&distance<nearest){next=terminal;nearest=distance;}
      }
    }
  }
  const hint=next?.hint||'Read terminal';
  if(currentTerminal===next&&lastInteractionLabel===hint)return;
  currentTerminal=next;
  lastInteractionLabel=hint;
  interactionHint.hidden=!next;
  touchInteract.hidden=!next;
  interactionLabel.textContent=hint;
  touchInteract.setAttribute('aria-label',hint);
}

function liftStateChanged() {
  if(!publicLifts||!camera||disposed)return;
  const riding=publicLifts.riding;
  if(lastLiftRide&&!riding&&mode==='exploring')toast(`LANTERN LIFT / ${concourseLevelAt(camera.position.y-1.75).label.toUpperCase()}`);
  lastLiftRide=riding;
  currentTerminal=null;
  if(ready)updateNearbyInteractable();
}

function cancelPublicRide() {
  selectedLift=null;lastLiftRide=false;
  publicLifts?.cancelRide(controls);
}

function useLift(interaction) {
  if(interaction.action==='call') {
    const result=publicLifts.call(interaction.shaftId,interaction.levelId,{reducedMotion});
    toast(result.message);
    return;
  }
  selectedLift={shaftId:interaction.shaftId,levelId:interaction.levelId};
  $('#lift-title').textContent=PUBLIC_LIFT_SHAFTS.find(shaft=>shaft.id===interaction.shaftId)?.name||'Lantern lift';
  $('#lift-current').textContent=`YOU ARE ON DECK ${String(CONCOURSE_LEVELS.find(level=>level.id===interaction.levelId)?.number||1).padStart(2,'0')}`;
  for(const button of document.querySelectorAll('[data-lift-level]')){
    const current=button.dataset.liftLevel===interaction.levelId;
    button.disabled=current;
    if(current)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
  }
  openDialog('#lift-dialog');
}

function resizeViewport() {
  if(disposed||!renderer||!camera)return;
  const width=Math.max(1,innerWidth),height=Math.max(1,innerHeight);
  // The device sets the ceiling; the governor may hold a lower ratio beneath it.
  const ratio=governor.setLimit(Math.min(devicePixelRatio||1,isTouch?1.25:1.6));
  if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
  renderer.setSize(width,height);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  governor.reset();
  lastSceneRender=-Infinity;
}

/** The sign typeface must be in before any sign is drawn: a canvas silently falls back. */
async function signTypeReady() {
  if(!document.fonts?.load)return;
  try {
    await Promise.race([
      document.fonts.load('600 48px "Space Grotesk"'),
      new Promise(resolve=>setTimeout(resolve,1500)),
    ]);
  } catch { /* The local fallback face still gives readable signs. */ }
}

/** Last resort once the lowest resolution still misses the frame budget. */
function relieveLighting() {
  if(disposed||!lighting)return;
  lighting.setDetail(false);
  effectContext.shadows=lighting.detail;
}

function watchPixelRatio() {
  pixelRatioQuery?.removeEventListener('change',handlePixelRatioChange);
  if(disposed)return;
  pixelRatioQuery=matchMedia(`(resolution: ${devicePixelRatio||1}dppx)`);
  pixelRatioQuery.addEventListener('change',handlePixelRatioChange);
}

function handlePixelRatioChange() {resizeViewport();watchPixelRatio();}

function disposeTerminals() {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  // Markers are lettered on the shared sheet, which the signage releases.
  for(const marker of terminalScreens)marker.removeFromParent();
  for(const group of terminalGroups){
    group.traverse(node=>{if(!node.isMesh)return;geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    group.removeFromParent();
  }
  geometries.forEach(resource=>resource.dispose());
  materials.forEach(resource=>resource.dispose());
  textures.forEach(resource=>resource.dispose());
  terminalGroups.length=terminalScreens.length=0;
}

function buildTerminals({importedComputer = false} = {}) {
  const base = panelMaterial({color: '#5b6861', metalness: .5});
  const dark = panelMaterial({color: '#1b2b2e'});
  const glow = glowMaterial('#d9b27d');
  for (const [index, data] of terminalData.entries()) {
    const group = new THREE.Group();
    data.y = navigation.heightAt(data.x,data.z);
    group.position.set(data.x, data.y, data.z);
    if (data.x > 32) group.rotation.y = -Math.PI / 2;
    if (data.x < -32) group.rotation.y = Math.PI / 2;
    const usesImportedComputer = importedComputer && index < 2;
    if (!usesImportedComputer) {
      box(group, base, 0, .55, 0, 1.15, 1.1, .8);
      box(group, dark, 0, 1.4, 0, 1.65, 1.1, .32);
      // The lamp bar overhangs the housing: at the same width their ends shared a plane.
      box(group, glow, 0, 1.95, .05, 1.7, .04, .35);
      // The screen is a fixed sign, read at arm's length; the terminal only turns it.
      const turn = group.rotation.y;
      // It stands 3 cm proud of the housing: at 1 cm the two fought from the far end of the hall.
      signage.add('STATION / INFO', {x: data.x + Math.sin(turn) * .19, y: data.y + 1.43, z: data.z + Math.cos(turn) * .19, width: 1.43, height: .61, yaw: turn,
        scale: 55, density: 360, color: '#d0d8b7', background: '#263e3d', layer: sectorAt(data.x, data.z)});
    }
    const marker = signage.sprite('+', {width: .5, height: .5, density: 256, color: '#e7b37e'});
    marker.position.set(0, 2.8, 0);
    group.add(marker);
    terminalScreens.push(marker);
    marker.userData.inverseParent = group.quaternion.clone().invert();
    scene.add(group);
    terminalGroups.push(group);
    if (!usesImportedComputer) colliders.push({minX: data.x - .7, maxX: data.x + .7, minZ: data.z - .6, maxZ: data.z + .6,minY:data.y,maxY:data.y+2.1});
  }
}

function releaseMouse() {
  intentionalUnlock = true;
  controls.setActive(false);
  setTimeout(() => { intentionalUnlock = false; }, 150);
}

function updateSector(announce = true) {
  const {x, z} = camera.position;
  const id = sectorAt(x,z);
  if (id === activeSector) return;
  activeSector = id;
  effectContext.sector = id;
  const sector = sectors[id];
  $('#zone-name').textContent = sector.name;
  $('#zone-description').textContent = sector.description;
  $('#map-current').textContent = `YOU ARE IN ${sector.name.toUpperCase()}`;
  if (!visited.has(id)) {
    visited.add(id);
    $('#discovered-count').textContent = String(visited.size).padStart(2, '0');
    $(`[data-sector="${id}"]`).classList.add('visited');
    if (announce && visited.size > 1) toast(`SECTOR DISCOVERED / ${sector.name.toUpperCase()}`);
    if (visited.size === 4) setTimeout(() => toast('ALL FOUR SECTORS EXPLORED / Take the long way back.'), 4500);
  }
}

function beginExploring() {
  if (!ready) return;
  clearTimeout(transitTimer);
  $('#transition').classList.remove('active');
  closeAllDialogs(false);
  mode = 'exploring';
  cancelPublicRide();
  document.body.classList.add('exploring');
  $('#arrival').hidden = true;
  $('#exploration').hidden = false;
  controls.teleport(sectors.concourse.position, 0);
  controls.requestLock();
  updateSector(false);
  updateNearbyInteractable();
  if (!isTouch) toast('WASD to move · Shift to move faster · E to inspect and read');
}

function returnToArrival() {
  clearTimeout(transitTimer);
  $('#transition').classList.remove('active');
  mode = 'arrival';
  cancelPublicRide();
  effectContext.sector='concourse';
  closeAllDialogs(false);
  releaseMouse();
  $('#exploration').hidden = true;
  $('#arrival').hidden = false;
  document.body.classList.remove('exploring');
  updateNearbyInteractable();
  chatter.classList.remove('visible');
}

function resume() {
  if (mode === 'arrival') return;
  closeAllDialogs(false);
  mode = 'exploring';
  controls.requestLock();
}

function closeAllDialogs(resumeAfter = true) {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  if (resumeAfter && mode !== 'arrival') {
    mode = 'exploring';
    controls.setActive(true);
  }
}

function openDialog(id) {
  if (mode === 'arrival' || mode === 'transit' || !ready) return;
  mode = 'paused';
  releaseMouse();
  closeAllDialogs(false);
  if (id === '#map-dialog') stationPlan?.update(camera.position,activeSector);
  $(id).showModal();
}

function interact() {
  if (mode !== 'exploring' || !currentTerminal) return;
  if(currentTerminal.shaftId){useLift(currentTerminal);return;}
  $('#terminal-code').textContent = currentTerminal.code;
  $('#terminal-title').textContent = currentTerminal.title;
  $('#terminal-body').innerHTML = currentTerminal.text.map(p => `<p>${p}</p>`).join('');
  openDialog('#terminal-dialog');
}

async function init() {
  // Reversed depth: where the browser stores depth as floats (Apple GPUs), layers millimetres apart stop
  // flickering at the far end of the hall. Without EXT_clip_control, or with fixed-point depth, nothing changes.
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', reversedDepthBuffer: true});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#17272d');
  scene.fog = new THREE.FogExp2('#1a2a2e', .004);
  camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .1, 2000);
  governor = createRenderGovernor({limit:Math.min(devicePixelRatio||1,isTouch?1.25:1.6),onRatio:resizeViewport,onRelief:relieveLighting});
  window.addEventListener('resize',resizeViewport);
  resizeViewport();
  watchPixelRatio();
  effectContext.camera = camera;
  // Touch hardware starts without the shadow map and probes; contact shadows stand in.
  lighting = createLighting({scene, renderer, detail:!isTouch});
  effectContext.shadows = lighting.detail;
  // Model downloads and the sign typeface overlap the wait, then the build.
  const modelFiles = prefetchImportedModels();
  await signTypeReady();
  if(disposed)return;

  const glow = createGlow();
  // One sheet letters every sign: the builders add to it, then it is drawn once.
  signage = createSignage({maxSize: renderer.capabilities.maxTextureSize});
  station = createStation({glow, signage});
  districts = createDistricts({glow, signage});
  publicLifts=createPublicLifts({onStateChange:liftStateChanged});
  escalators=createEscalators();
  colliders.push(...publicLifts.colliders,...escalators.colliders);
  const districtSurfaces=districts.layouts.flatMap(layout=>layout.surfaces.map(surface=>({...surface,sector:layout.id})));
  navigation = createNavigation({surfaces:[...station.surfaces,...publicLifts.surfaces,...escalators.surfaces,...districtSurfaces],colliders});
  journeyNavigation=createNavigation({surfaces:[...(station.journeySurfaces||station.surfaces),...districtSurfaces],colliders});
  for (const layout of districts.layouts) {
    if(layout.spawn)Object.assign(sectors[layout.id],layout.spawn);
    if(layout.terminal)Object.assign(terminalData[layout.id==='market'?2:layout.id==='docks'?3:1],layout.terminal);
  }
  importedModels = await createImportedModels({renderer, camera, floorHeight:navigation.heightAt, prefetched:modelFiles});
  if(disposed){importedModels.dispose();return;}
  furnishings = createFurnishings({importedTrees: importedModels.loaded.tree, glow});
  atmosphere = createAtmosphere({renderer, camera, reducedMotion});
  commerce = createCommerce({importedTree: importedModels.loaded.tree, importedPot: importedModels.loaded.pot, glow});
  stationLife = createStationLife();
  glowLayer = glow.build();
  for (const event of stationLife.events) {
    const divider = event.caption.indexOf(' / ');
    conversations.push({
      x: event.x, z: event.z, radius: event.radius, notice: true,
      sector: sectorAt(event.x,event.z),
      speaker: event.caption.slice(0, divider), lines: [event.caption.slice(divider + 3)],
    });
  }
  scene.add(station.group, districts.group, furnishings.group, atmosphere.group, commerce.group, stationLife.group, importedModels.group, publicLifts.group, escalators.group, glowLayer.group);
  colliders.push(...station.colliders, ...districts.colliders, ...furnishings.colliders, ...commerce.colliders, ...stationLife.colliders, ...importedModels.colliders);
  const tradeNotices = {
    'Night Market Tea': 'Six mismatched cups wait beside a pressure-sealed kettle. The handwritten price is crossed out in three different scripts. The seller appears to accept stories as a fourth currency.',
    'Quiet Spore': 'The luminous tips lean toward passing footsteps. A careful line of tiny airlocks separates the cultures. The handwritten notice reads: responsibility transfers with the lid.',
    'Borrowed Parts': 'A service unit waits patiently beside its own spare arm. Someone has polished its casing around a much older scratch. The technician has left that scratch alone.',
    'Orbital Orchard': 'Each suspended pod contains a different season. The caretaker turns the whole garden a few degrees every station morning, following a sun that is not here.',
  };
  for (const entry of commerce.vignettes) interactables.push({
    x: entry.x, z: entry.z, y:navigation.heightAt(entry.x,entry.z), radius: 4.8,
    code: 'PFC / INDEPENDENT TRADE', title: entry.name, hint: `Inspect ${entry.name}`,
    text: [entry.text, tradeNotices[entry.name]].filter(Boolean),
  });
  for(const landmark of [...station.landmarks,...districts.layouts.flatMap(layout=>layout.landmarks||[])])interactables.push({
    ...landmark,y:landmark.y??navigation.heightAt(landmark.x,landmark.z),radius:landmark.radius||4,
    code:landmark.code||'PFC / LOCAL DIRECTORY',hint:landmark.hint||`Explore ${landmark.title}`,
    text:Array.isArray(landmark.text)?landmark.text:[landmark.text],
  });
  buildTerminals({importedComputer: importedModels.loaded.computer});
  signage.build();
  scene.add(signage.group);
  population = createPopulation({districtLayouts:districts.layouts,promenadeRoutes:station.routes,navigation:journeyNavigation});
  scene.add(population.group);
  stationPlan=createStationPlan(navigation,{shops:station.shops});
  audio = createAmbientAudio({volume:audioVolume,footstepsEnabled,onStateChange:syncAudioControls});
  syncAudioControls();
  controls = createFirstPersonControls(camera, canvas, {
    canWalk,
    heightAt:navigation.heightAt,
    transportAt:escalators.transportAt,
    onLockChange(locked) {
      if (!locked && !intentionalUnlock && mode === 'exploring') openDialog('#pause-dialog');
    },
    onInteract: interact,
  });

  // Shadows and reflections are settled before the first frame. Shaders link
  // off the main thread first, so the probe capture and the opening frames do
  // not stall on them.
  lighting.configureShadows();
  lighting.reserveEnvironment();
  await renderer.compileAsync(scene, camera);
  await lighting.compileForCapture(camera);
  if(disposed)return;
  lighting.captureProbes();
  // Only now are the hall's contents given their own layer: the probes had to see them.
  visibility = createSectorVisibility({scene, camera, layouts: districts.layouts});
  visibility.classify();
  resizeViewport();
  let previousTime = performance.now();
  let frameCount = 0;

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    const now = performance.now();
    const interval = now - previousTime;
    const dt = Math.min(interval / 1000, .05);
    previousTime = now;
    if (document.hidden) { governor.reset(); return; }
    elapsed += dt;
    publicLifts.update(dt,{camera,controls,mode,reducedMotion});
    escalators.update(dt,{camera,controls,mode,reducedMotion});
    if (mode === 'arrival') {
      const drift = reducedMotion ? 0 : Math.sin(elapsed * .075);
      camera.position.set(12.5 + drift * .65, 10.5 + drift * .2, 66);
      camera.lookAt(-3, 10, -58);
    } else {
      controls.update(dt, elapsed);
      if (mode === 'exploring') {
        updateSector();
        updateNearbyInteractable();
        if (frameCount % 8 === 0) {
          const level=concourseLevelAt(camera.position.y-1.75);
          const deck=publicLifts.riding?'LANTERN LIFT / LOOK AROUND':controls.passiveTransport?`ESCALATOR / TO DECK ${camera.position.x<0?'02':'01'}`:activeSector==='concourse'?`DECK ${String(level.number).padStart(2,'0')} / ${level.short}`:activeSector==='observation'&&camera.position.x>64?'PANORAMIC TERRACE':activeSector==='market'?'EXCHANGE STREETS':activeSector==='docks'?'BOARDING PIERS':'DECK 01 / PUBLIC DECK';
          if(deck!==lastDeckLabel){$('#deck-name').textContent=`PORT FREECOMMERCE / ${deck}`;lastDeckLabel=deck;}
          const heading = ((-THREE.MathUtils.radToDeg(controls.yaw) % 360) + 360) % 360;
          const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8];
          if (cardinal !== lastHeading) { compassHeading.textContent = cardinal; lastHeading = cardinal; }
        }
      }
    }
    // The eye is placed: decide whether any opening to the concourse is in view.
    effectContext.concourseSeen = visibility.update();
    // One fascia sits directly behind the arrival copy; it belongs to the walk-through.
    for(const sign of station.titleCardHidden||[])sign.visible=mode!=='arrival';
    station.update?.(dt, elapsed, effectContext);
    districts.update?.(dt, elapsed, effectContext);
    population.update(dt, elapsed, effectContext);
    commerce.update(dt, elapsed, effectContext);
    stationLife.update(dt, elapsed, effectContext);
    importedModels.update(dt, elapsed, effectContext);
    atmosphere.update(dt, elapsed, effectContext);
    updateConversations(dt);
    effectContext.mode = publicLifts.riding||(controls.passiveTransport&&!controls.moving)?'riding':mode;
    effectContext.yaw = mode === 'arrival' ? camera.rotation.y : controls.yaw;
    effectContext.serviceTime = stationLife.serviceTime;
    audio.update(camera.position, elapsed, effectContext);
    const room=roomAtmospheres[mode==='arrival'?'concourse':activeSector]||roomAtmospheres.concourse;
    const blend=1-Math.exp(-dt*1.8);
    scene.fog.color.lerp(room.color,blend);
    scene.fog.density+=(room.density-scene.fog.density)*blend;
    lighting.update(dt,mode==='arrival'?'concourse':activeSector||'concourse',effectContext.concourseSeen);
    glowLayer.update(scene.fog.density);
    terminalScreens.forEach((marker, i) => {
      if (!reducedMotion) marker.position.y = 2.8 + Math.sin(elapsed * 1.5 + i) * .1;
      marker.quaternion.copy(marker.userData.inverseParent).multiply(camera.quaternion);
    });
    // Keep station activity advancing while menus use a cheaper background.
    if(mode==='paused'&&now-lastSceneRender<1000/15)return;
    lastSceneRender=now;
    renderer.info.reset();
    renderer.render(scene,camera);
    // Menus render at a deliberate 15 Hz, which says nothing about the hardware.
    if(mode==='paused')governor.reset();else governor.sample(interval);
    frameCount++;
    if (frameCount === 3) {
      ready = true;
      $('#enter-button').disabled = false;
      $('#enter-label').textContent = 'ENTER THE STATION';
      $('#loading').classList.add('done');
      setTimeout(() => { $('#loading').hidden = true; }, 750);
      if (importedModels.stats.errors.length) toast('Some station details could not load. Reload to try again.');
    }
  }
  animate();

  // A small read-only bridge makes local smoke tests and future development easy.
  window.stationExperience = {
    get state() { return {ready, mode, sector: activeSector, visited: [...visited], position: camera.position.toArray(), yaw: controls.yaw, floorHeight:navigation.heightAt(camera.position.x,camera.position.z,camera.position.y-1.75), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, points: renderer.info.render.points, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, resolution:{pixelRatio:renderer.getPixelRatio(),width:canvas.width,height:canvas.height}, quality:{...governor.stats,lighting:lighting.stats,glow:glowLayer.stats,signage:signage.stats,visibility:visibility.stats}, atmosphere: atmosphere.stats, furnishings: furnishings.stats, population: population.stats, commerce: commerce.stats, stationLife: stationLife.stats, importedModels: importedModels.stats, architecture:districts.layouts.map(({id,stats})=>({id,...stats})), concourse:station.stats, conversations: shownConversations, sound: audio.enabled, audio:audio.stats}; },
    get places() { return interactables.map(item => ({name: item.title || item.code, x: item.x, z: item.z, radius: item.radius || 3.8})); },
    get npcBehavior() { return {population:population.behaviorSnapshot ?? [], commuters:districts.behaviorSnapshot ?? []}; },
    get lifts() { return publicLifts.snapshot; },
    get publicLiftStats() { return publicLifts.stats; },
    get escalators() { return escalators.stats; },
    get movement() { return {moving:controls.moving,passiveTransport:controls.passiveTransport,liftRide:controls.riding,floorHeight:controls.floorHeight}; },
    get concourseLevels() { return CONCOURSE_LEVELS.map(level=>({...level})); },
    get promenade() { return {stats:structuredClone(station.promenadeStats),shops:station.shops.map(({id,name,type,side,z,width})=>({id,name,type,side,x:side*26.1,y:CONCOURSE_LEVELS[1].height,z,width}))}; },
    canWalk,
    heightAt:navigation.heightAt,
    get floors(){return navigation.surfaces.map(s=>({...s}));},
  };
}

$('#enter-button').addEventListener('click', beginExploring);
$('#home').addEventListener('click', (event) => { event.preventDefault(); if (ready) returnToArrival(); });
$('#resume-button').addEventListener('click', resume);
$('#return-button').addEventListener('click', returnToArrival);
$('#map-button').addEventListener('click', () => openDialog('#map-dialog'));
$('#help-button').addEventListener('click', () => openDialog('#help-dialog'));
$('#pause-button').addEventListener('click', () => openDialog('#pause-dialog'));
$('#touch-interact').addEventListener('click', interact);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
  closeAllDialogs();
  if (!isTouch) controls.requestLock();
}));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeAllDialogs(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeAllDialogs();
    }
  });
});

document.querySelectorAll('[data-sector]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.sector;
  const sector = sectors[id];
  closeAllDialogs(false);
  mode = 'transit';
  updateNearbyInteractable();
  $('#transition').classList.add('active');
  clearTimeout(transitTimer);
  transitTimer = setTimeout(() => {
    cancelPublicRide();
    controls.teleport(sector.position, sector.yaw);
    mode = 'exploring';
    controls.setActive(true);
    updateSector();
    updateNearbyInteractable();
    $('#transition').classList.remove('active');
    toast(`STATION TRANSIT / ${sector.name.toUpperCase()}`);
  }, reducedMotion ? 20 : 380);
}));

document.querySelectorAll('[data-lift-level]').forEach(button=>button.addEventListener('click',()=>{
  if(!selectedLift||!publicLifts)return;
  const shaftId=selectedLift.shaftId,levelId=button.dataset.liftLevel;
  closeAllDialogs();
  const result=publicLifts.startRide(shaftId,levelId,controls,{reducedMotion});
  selectedLift=null;
  if(result.ok&&reducedMotion){$('#transition').classList.add('active');clearTimeout(transitTimer);transitTimer=setTimeout(()=>$('#transition').classList.remove('active'),180);}
  lastLiftRide=publicLifts.riding;
  updateNearbyInteractable();
  toast(result.message);
  if(!isTouch)controls.requestLock();
}));

$('#sound-button').addEventListener('click', () => toggleAudio(!audio?.enabled));
$('#audio-enabled-setting').addEventListener('change', event => toggleAudio(event.target.checked));
$('#audio-volume').addEventListener('input', event => {
  audioVolume = Number(event.target.value)/100;
  audio?.setVolume(audioVolume);
  syncAudioControls();
  try { localStorage.setItem('pfc-audio-volume',String(audioVolume)); } catch { /* Keep the current setting in memory. */ }
});
$('#footsteps-setting').addEventListener('change', event => {
  footstepsEnabled = event.target.checked;
  audio?.setFootstepsEnabled(footstepsEnabled);
  try { localStorage.setItem('pfc-audio-footsteps',String(footstepsEnabled)); } catch { /* Keep the current setting in memory. */ }
});
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast('Fullscreen is unavailable in this browser. Try opening in a new tab.'); }
});
document.addEventListener('fullscreenchange', () => {
  $('#fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
$('#motion-setting').addEventListener('change', (event) => {
  reducedMotion = event.target.checked;
  effectContext.reducedMotion = reducedMotion;
  controls?.setReducedMotion?.(reducedMotion);
});
$('#chatter-setting').addEventListener('change', (event) => {
  chatterEnabled = event.target.checked;
  if (!chatterEnabled) chatter.classList.remove('visible');
});
document.addEventListener('keydown', (event) => {
  if (!ready || mode === 'arrival' || mode === 'transit' || event.repeat || event.metaKey || event.ctrlKey || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.code === 'KeyM') {
    event.preventDefault();
    if ($('#map-dialog').open) closeAllDialogs();
    else openDialog('#map-dialog');
  }
  if (event.key === '?' || event.code === 'KeyH') {
    event.preventDefault();
    if ($('#help-dialog').open) closeAllDialogs();
    else openDialog('#help-dialog');
  }
  if (event.code === 'Escape' && mode === 'exploring' && !controls.locked) {
    event.preventDefault();
    openDialog('#pause-dialog');
  }
});

window.addEventListener('pageshow',event=>{if(event.persisted){resizeViewport();watchPixelRatio();}});
window.addEventListener('pagehide', event => {
  // Cached history entries retain this live scene and its animation callback.
  if(event.persisted||disposed)return;
  disposed=true;
  cancelAnimationFrame(animationFrame);
  window.removeEventListener('resize',resizeViewport);
  pixelRatioQuery?.removeEventListener('change',handlePixelRatioChange);
  clearTimeout(toastTimer);
  clearTimeout(transitTimer);
  publicLifts?.cancelRide(controls);
  publicLifts?.dispose();
  escalators?.dispose();
  stationPlan?.dispose?.();
  controls?.dispose();
  audio?.dispose();
  atmosphere?.dispose();
  furnishings?.dispose();
  population?.dispose();
  commerce?.dispose();
  stationLife?.dispose();
  importedModels?.dispose();
  districts?.dispose();
  station?.dispose();
  disposeTerminals();
  signage?.dispose();
  glowLayer?.dispose();
  lighting?.dispose();
  renderer?.dispose();
});

init().catch(showError);
