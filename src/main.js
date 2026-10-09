// MAC0623 — A3, Navegação em VR: World-in-Miniature (WIM) x teleporte em arco.
//
// Setup do aplicativo: cria a cena, instancia as classes, liga os
// callbacks entre elas e roda o laço de desenho. Cada responsabilidade mora no seu
// arquivo:
//
//   constants.js      parâmetros de ajuste (tamanhos, cores, tolerâncias, tempos)
//   strings.js        textos da tela (português)
//   utils.js          utilidades compartilhadas (rng, geometria, raio do controlador...)
//   house-plan.js     planta da casa: cômodos, paredes, janelas, mobília (só dados)
//   landmarks.js      o visual dos cinco landmarks
//   textures.js       texturas procedurais        collision.js   colisão (só pouso)
//   environment.js    Environment (a casa) e Beacon
//   viewpoint.js      o ponto de vista: o rig e os pulos
//   miniature.js      técnica 1: WIM (miniatura + boneco)
//   teleport.js       técnica 2: teleporte em arco
//   navigation.js     liga a ação da mão direita à técnica atual
//   hands.js          qual objeto é a mão esquerda / direita
//   xr-input.js       entrada pela headset        desktop-input.js   entrada por mouse/teclado
//   hud.js            barra da página (DomHud) e painel da headset (WorldHud)
//   trial-session.js  fases da tentativa, medições, CSV, ordem ABBA
//

import * as THREE from "three";
import {
  CAMERA_FAR, CAMERA_FOV_DEG, CAMERA_NEAR, CONFIRM_RADIUS, DIRECTIONAL_LIGHT_INTENSITY, DIRECTIONAL_LIGHT_POSITION,
  ENV_SIZE, HEMISPHERE_GROUND_COLOR, HEMISPHERE_LIGHT_INTENSITY, HEMISPHERE_SKY_COLOR, SKY_COLOR,
  TRIALS_PER_TECHNIQUE, WIM_SCALE,
} from "./constants.js";
import { DesktopInput } from "./desktop-input.js";
import { Environment } from "./environment.js";
import { Hands } from "./hands.js";
import { DomHud, WorldHud } from "./hud.js";
import { Miniature } from "./miniature.js";
import { NavigationController } from "./navigation.js";
import { TeleportAim } from "./teleport.js";
import { TrialSession } from "./trial-session.js";
import { Viewpoint } from "./viewpoint.js";
import { XrInput } from "./xr-input.js";

function main() {
  // --- Cena e luzes ---------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);

  // As luzes ficam na cena, não no `world`, para clonar o mundo (a miniatura) nunca
  // duplicá-las. Não há sombras em lugar nenhum: mantém barato o desenho extra da miniatura.
  scene.add(new THREE.HemisphereLight(HEMISPHERE_SKY_COLOR, HEMISPHERE_GROUND_COLOR, HEMISPHERE_LIGHT_INTENSITY));
  const dirLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY);
  dirLight.position.set(...DIRECTIONAL_LIGHT_POSITION);
  scene.add(dirLight);

  // --- Ambiente, câmera, ponto de vista e renderer --------------------------
  const environment = new Environment({ confirmRadius: CONFIRM_RADIUS });
  scene.add(environment.world);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
  const viewpoint = new Viewpoint(camera);
  scene.add(viewpoint.rig);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  const isPresenting = () => renderer.xr.isPresenting;

  // --- HUDs -----------------------------------------------------------------
  const hud = new DomHud();
  const worldHud = new WorldHud();
  worldHud.attachTo(camera);

  // --- Técnicas ---------------------------------------------------------------
  // Algumas peças se referenciam (a miniatura avisa a sessão; a entrada chama a
  // navegação); as variáveis declaradas aqui são lidas só depois de tudo montado.
  let session;
  let navigation;
  let desktopInput;
  let hands;

  // A miniatura clona o mundo só agora: ele está pronto e o rig (câmera, controladores)
  // não faz parte dele, então nenhum controlador é duplicado.
  const miniature = new Miniature({
    world: environment.world,
    beacon: environment.beacon,
    camera,
    environment,
    viewpoint,
    isPresenting,
    getPointerNdc: () => desktopInput.ndc,
    notify: (texto) => session.flash(texto),
  });
  const teleport = new TeleportAim({ scene, viewpoint, environment });

  // --- Entrada (mouse/teclado e headset) ----------------------------------------
  const inputHandlers = {
    action: (start) => navigation.action(start),
    confirm: () => session.tryConfirm(),
    hold: (held) => miniature.setHeld(held),
  };
  desktopInput = new DesktopInput({ camera, renderer, rig: viewpoint.rig, handlers: inputHandlers });
  const xrInput = new XrInput({
    renderer,
    rig: viewpoint.rig,
    handlers: {
      ...inputHandlers,
      controllersChanged: () => hands.resolve(),
      sessionStart: () => {
        hud.setInVr(true);
        hands.resolve();
      },
      sessionEnd: () => {
        hud.setInVr(false);
        desktopInput.resetCamera(); // a sessão XR deixou a câmera na última pose da cabeça
        hands.resolve();
      },
    },
  });

  hands = new Hands({ isPresenting, xrInput, desktopInput });
  hands.onChange((leftGrip, rightHand) => {
    miniature.attachTo(leftGrip);
    miniature.attachRay(rightHand);
  });

  navigation = new NavigationController({ miniature, teleport, hands, getTechnique: () => hud.technique });

  // --- Sessão de tentativas e ligação da barra da página -------------------------
  session = new TrialSession({
    environment,
    viewpoint,
    hud,
    worldHud,
    isPresenting,
    cancelInteractions: () => navigation.cancel(),
  });

  hud.onConfirm(() => session.tryConfirm());
  hud.onDownload(() => session.downloadCsv());
  hud.onTechniqueChange(() => {
    navigation.cancel();
    session.start();
  });
  hud.onPracticeChange(() => session.start());
  hud.onParticipantChange(() => {
    session.applyPlanForParticipant();
    navigation.cancel();
    session.start();
  });

  hands.resolve();
  session.start();

  // --- Laço de desenho -------------------------------------------------------------
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();

    desktopInput.updateHands(delta);
    viewpoint.rig.updateMatrixWorld(true); // as poses dos controladores acabaram de ser atualizadas pelo WebXR

    navigation.update(); // miniatura e mira do teleporte
    session.update(); // caminhada, beacon e HUDs

    renderer.render(scene, camera);
  });

  // Fachada para o console e para verificações automáticas ("logar posições no
  // console antes de colocar a headset").
  window.a3 = {
    THREE,
    get rig() { return viewpoint.rig; },
    get camera() { return camera; },
    get world() { return environment.world; },
    get mini() { return miniature.object; },
    get marker() { return miniature.marker; },
    get beacon() { return environment.beacon.group; },
    get trial() { return session.state; },
    get teleport() { return teleport; },
    get desktop() { return desktopInput; },
    get lastResult() { return session.lastResult; },
    hudPanel: () => session.hudPanel(false),
    rows: session.rows,
    moveViewpointTo: (x, z, via) => viewpoint.moveTo(x, z, via),
    tryConfirm: () => session.tryConfirm(),
    startTrial: () => session.start(),
    onAction: (start) => navigation.action(start),
    buildCsv: () => session.buildCsv(),
    setWimHeld: (held) => miniature.setHeld(held),
    isBlocked: (x, z, margin) => environment.isBlocked(x, z, margin),
    resolveFree: (x, z, margin) => environment.resolveFree(x, z, margin),
    constants: { ENV_SIZE, WIM_SCALE, CONFIRM_RADIUS, TRIALS_PER_TECHNIQUE },
  };
}

main();
