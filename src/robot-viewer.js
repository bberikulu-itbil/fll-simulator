// Close-up of the robot with a real depth buffer. Geometry comes from the same parts as the field view.
import * as THREE from '../vendor/three/build/three.module.js';
import { OrbitControls } from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import { robotScene, robotMeshData } from './robot-3d.js';
import { makeRobotGeometry } from './field-3d.js';

const VIEWS = { iso: [260, 200, -300], front: [0, 90, -420], back: [0, 130, 420], side: [420, 90, 0], top: [0, 480, -1], bottom: [0, -440, -1] };

export function createRobotViewer(panel, sim) {
  const mount = panel.querySelector('[data-robot-canvas]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#dfe9e4'); renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement); renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', '3D robot');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 5, 4000), controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 160; controls.maxDistance = 1400;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8b8577', 2.1));
  const sun = new THREE.DirectionalLight('#fff4dd', 1.8); sun.position.set(250, 600, -350); scene.add(sun);
  const grid = new THREE.GridHelper(640, 40, '#8aa298', '#b7c8c0'); grid.position.y = -.5; scene.add(grid);
  const meshes = [0, 1].map(i => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, side: THREE.DoubleSide, polygonOffset: !!i, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  const robot = new THREE.Group(); robot.add(...meshes); scene.add(robot);
  let key = '';
  const draw = () => renderer.render(scene, camera);
  function update() {
    if (!mount.clientWidth) return; // hidden view
    const state = robotScene(sim), next = JSON.stringify([state.cfg, state.wheels, state.arms]);
    if (next !== key) {
      key = next;
      makeRobotGeometry(robotMeshData(state)).forEach((g, i) => { meshes[i].geometry.dispose(); meshes[i].geometry = g; });
      draw();
    }
  }
  function setView(name) {
    const c = sim.cfg, centre = new THREE.Vector3(0, 45, -(c.robotL / 2 - c.axleBack));
    grid.visible = name !== 'bottom';
    controls.target.copy(centre); camera.position.copy(centre).add(new THREE.Vector3(...VIEWS[name])); controls.update(); draw();
  }
  const resize = () => { const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); update(); draw(); };
  new ResizeObserver(resize).observe(mount);
  controls.addEventListener('change', () => { grid.visible = camera.position.y > 0; draw(); });
  panel.addEventListener('click', e => { const b = e.target.closest('[data-robot-view]'); if (b) setView(b.dataset.robotView); });
  setView('iso'); resize();
  return { update, setView, data: () => robotMeshData(robotScene(sim)) };
}
