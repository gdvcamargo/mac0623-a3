// Técnica 1, World-in-Miniature
//
// A miniatura é um clone reduzido do mundo, preso ao grip esquerdo. O boneco "você
// está aqui" mostra onde está a cabeça e para onde ela olha; agarrá-lo com a mão
// direita e soltá-lo em outro ponto da miniatura leva o ponto de vista para lá.
//
// Decisões (ver README):
//  - o mundo é clonado com clone(true): geometria e materiais são compartilhados,
//    então custa quase nada, e uma posição nas coordenadas locais da miniatura É uma
//    posição no mundo (o mapeamento é a identidade);
//  - o ponto de vista só se move ao SOLTAR o boneco, não durante o arrasto: mover
//    durante o arrasto seria movimento visual contínuo, exatamente a vection;
//  - a miniatura é north-up (ver updatePose).

import * as THREE from "three";
import {
  MARKER_BODY_HEIGHT, MARKER_BODY_RADIUS, MARKER_COLOR, MARKER_EMISSIVE_INTENSITY, MARKER_GHOST_OPACITY,
  MARKER_HEAD_RADIUS, MARKER_HEIGHT, MARKER_NOSE_COLOR, MARKER_NOSE_LENGTH, MARKER_PICK_RADIUS, MARKER_TOUCH_RADIUS,
  PLAYER_RADIUS, RAY_COLOR, RAY_LENGTH, WIM_HEIGHT, WIM_SCALE,
} from "./constants.js";
import { TEXTOS } from "./strings.js";
import { WORLD_UP, getIntersections, headingYaw } from "./utils.js";

/**
 * O boneco "você está aqui": uma pessoinha em pé no chão (corpo em cone, cabeça
 * redonda) com um nariz branco apontando para onde a cabeça olha. A origem fica nos
 * pés, em metros da MÃO, e a "frente" é -z.
 *
 * O usuário olha a miniatura na direção do heading, então vê o boneco de costas:
 * o nariz é comprido o bastante (ponta a 2,4 cm do centro da cabeça, que tem raio
 * 0,85 cm) para aparecer além da silhueta da cabeça a partir de ~21° de elevação, e
 * uma miniatura na mão é vista de 40–60°.
 *
 * Cada peça é desenhada duas vezes: sólida e com teste de profundidade (o nariz
 * se lê direito de qualquer lado) e como um "fantasma" translúcido por cima (o
 * boneco continua visível atrás de uma parede da miniatura).
 *
 * É um THREE.Group: o `pick` (esfera invisível, maior que o boneco) é filho dele.
 */
export class MarkerFigure extends THREE.Group {
  constructor() {
    super();
    this.name = "marker";

    const headY = MARKER_BODY_HEIGHT + MARKER_HEAD_RADIUS * 0.7;
    const noseLength = MARKER_NOSE_LENGTH;
    const parts = [
      [new THREE.ConeGeometry(MARKER_BODY_RADIUS, MARKER_BODY_HEIGHT, 16).translate(0, MARKER_BODY_HEIGHT / 2, 0), MARKER_COLOR],
      [new THREE.SphereGeometry(MARKER_HEAD_RADIUS, 16, 12).translate(0, headY, 0), MARKER_COLOR],
      [
        new THREE.ConeGeometry(MARKER_HEAD_RADIUS * 0.45, noseLength, 8)
          .rotateX(-Math.PI / 2) // ponta para -z
          .translate(0, headY, -(MARKER_HEAD_RADIUS + noseLength / 2 - 0.002)),
        MARKER_NOSE_COLOR,
      ],
    ];

    for (const [geometry, color] of parts) {
      this.add(new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: MARKER_EMISSIVE_INTENSITY }),
      ));
      const ghost = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: MARKER_GHOST_OPACITY, depthTest: false, depthWrite: false,
        }),
      );
      ghost.renderOrder = 10;
      this.add(ghost);
    }

    // Esfera invisível para o raio não precisar mirar o boneco de 4 cm com precisão.
    this.pick = new THREE.Mesh(
      new THREE.SphereGeometry(MARKER_PICK_RADIUS, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.pick.position.y = MARKER_HEIGHT / 2;
    this.add(this.pick);

    this._tmp = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._upright = new THREE.Quaternion();
  }

  /**
   * Em repouso, o boneco fica onde a cabeça está (no chão) e olha para onde ela olha.
   * @param {THREE.Object3D} world o mundo, para converter a posição da cabeça em coordenadas locais
   * @param {THREE.Camera} camera
   */
  syncToHead(world, camera) {
    camera.getWorldPosition(this._tmp);
    world.worldToLocal(this._tmp);
    this.position.set(this._tmp.x, 0, this._tmp.z);
    camera.getWorldDirection(this._forward);
    this.rotation.set(0, headingYaw(this._forward), 0);
  }

  /**
   * Só na headset, enquanto o controlador carrega o boneco: como filho do
   * controlador ele inclinaria junto com a mão. Em vez disso, a rotação de MUNDO
   * dele é mantida em "em pé, olhando para onde a cabeça olha" (a mesma pose de
   * syncToHead), ajustando a rotação local para inversa(rotação do controlador) ×
   * essa pose.
   * @param {THREE.Object3D} hand o controlador que carrega o boneco
   * @param {THREE.Camera} camera
   */
  keepUpright(hand, camera) {
    camera.getWorldDirection(this._forward);
    this._upright.setFromAxisAngle(WORLD_UP, headingYaw(this._forward));
    hand.getWorldQuaternion(this.quaternion);
    this.quaternion.invert().multiply(this._upright);
  }
}

/** A linha branca que sai do controlador ao longo do eixo -z dele. */
function buildControllerRay() {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: RAY_COLOR }));
  line.name = "ray";
  line.scale.z = RAY_LENGTH;
  return line;
}

export class Miniature {
  /**
   * @param {object} deps
   * @param {THREE.Object3D} deps.world o mundo a ser clonado (já pronto, sem luzes nem rig)
   * @param {import("./environment.js").Beacon} deps.beacon a beacon do mundo
   * @param {THREE.Camera} deps.camera
   * @param {import("./environment.js").Environment} deps.environment para a colisão no pouso
   * @param {import("./viewpoint.js").Viewpoint} deps.viewpoint quem é movido ao soltar o boneco
   * @param {() => boolean} deps.isPresenting há uma sessão XR ativa?
   * @param {() => THREE.Vector2} deps.getPointerNdc posição do mouse (desktop), em coordenadas normalizadas
   * @param {(texto: string) => void} deps.notify mostra uma mensagem rápida ao participante
   */
  constructor({ world, beacon, camera, environment, viewpoint, isPresenting, getPointerNdc, notify }) {
    this.world = world;
    this.beacon = beacon;
    this.camera = camera;
    this.environment = environment;
    this.viewpoint = viewpoint;
    this.isPresenting = isPresenting;
    this.getPointerNdc = getPointerNdc;
    this.notify = notify;

    this.object = world.clone(true);
    this.object.name = "miniature";
    this.object.scale.setScalar(WIM_SCALE);
    this.object.visible = false;
    // O clone da beacon não acompanha a original: a posição e a visibilidade dele
    // são copiadas a cada quadro em update().
    this.beaconCopy = this.object.getObjectByName("beacon");

    this.marker = new MarkerFigure();
    this.marker.scale.setScalar(1 / WIM_SCALE); // desfaz o encolhimento da miniatura
    this.object.add(this.marker);

    this.ray = buildControllerRay();

    this.active = false; // a técnica atual é o WIM?
    this.held = false; // grip esquerdo (ou Espaço no desktop) apertado
    this.dragging = false; // o boneco está agarrado
    this._dragHand = null;
    this._leftGrip = null; // quem segura a miniatura

    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._gripPos = new THREE.Vector3();
    this._gripQuat = new THREE.Quaternion();
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane();
  }

  /** Mostra/esconde a miniatura conforme a técnica atual é (ou não) o WIM. */
  setActive(active) {
    this.active = active;
  }

  /** O botão de mostrar a miniatura (grip esquerdo / Espaço) foi apertado ou solto. */
  setHeld(held) {
    this.held = held;
  }

  /** Prende a miniatura à mão esquerda (grip). Chamado quando as mãos mudam. */
  attachTo(leftGrip) {
    this._leftGrip = leftGrip;
    leftGrip.add(this.object);
  }

  /** Prende o raio branco à mão direita. */
  attachRay(rightHand) {
    rightHand.add(this.ray);
  }

  // -------------------------------------------------------------------------
  // Agarrar e soltar
  // -------------------------------------------------------------------------

  /** O controlador toca o boneco ou o raio dele acerta a esfera de pick? */
  _pickMarker(hand) {
    this.marker.getWorldPosition(this._b);
    hand.getWorldPosition(this._a);
    if (this._a.distanceTo(this._b) < MARKER_TOUCH_RADIUS) return true;
    return getIntersections(hand, [this.marker.pick]).length > 0;
  }

  /** Gatilho direito apertado: agarra o boneco se a mão o toca ou o raio o acerta. */
  actionStart(hand) {
    if (!this.object.visible || this.dragging) return;
    if (!this._pickMarker(hand)) return;
    this.dragging = true;
    this._dragHand = hand;
    // O mesmo attach() do agarrar direto do A2, mas só na headset: no desktop o
    // boneco segue o raio do mouse (ver _updateDesktopDrag).
    if (this.isPresenting()) hand.attach(this.marker);
  }

  /**
   * Gatilho solto: o ponto de vista se move AQUI, ao soltar, e não durante o
   * arrasto. A cabeça nunca pousa dentro de uma parede ou de um móvel: soltar sobre
   * um deles desliza até o ponto livre mais próximo (a resolução da miniatura é de
   * ~1 m por cm de mão, então é fácil soltar sobre uma parede fina).
   */
  actionEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    this._dragHand = null;

    const marker = this.marker;
    this.object.attach(marker); // de volta às coordenadas da miniatura (= do mundo)
    marker.position.y = 0; // mantém no chão

    const clamp = (v) => this.viewpoint.clampToPlayable(v);
    const free = this.environment.resolveFree(clamp(marker.position.x), clamp(marker.position.z), PLAYER_RADIUS);
    const x = clamp(free.x);
    const z = clamp(free.z);
    if (!free.ok || this.environment.isBlocked(x, z, PLAYER_RADIUS - 0.01)) {
      this.notify(TEXTOS.cannotLand);
      return;
    }
    marker.position.set(x, 0, z);

    const target = this.world.localToWorld(marker.position.clone());
    this.viewpoint.moveTo(target.x, target.z, "wim");
    // update() leva o boneco de volta para a nova posição da cabeça no quadro seguinte.
  }

  /** Larga o arrasto sem mover ninguém (troca de técnica, fim da tentativa...). */
  cancel() {
    if (!this.dragging) return;
    this.dragging = false;
    this._dragHand = null;
    this.object.attach(this.marker);
  }

  // -------------------------------------------------------------------------
  // A cada quadro
  // -------------------------------------------------------------------------

  /**
   * Miniatura north-up.
   *
   * Ela é filha do grip esquerdo, então acompanha a mão, mas a ROTAÇÃO é cancelada a
   * cada quadro (recebe a inversa da rotação de mundo do grip): mantém a orientação
   * do mundo e fica nivelada, não importa como a mão gire. A posição é WIM_HEIGHT
   * acima do grip, na vertical do mundo.
   *
   * Decisão (a declarar no relatório): north-up mantém os landmarks sempre no mesmo
   * lugar ao girar (um mapa estável), ao custo de rotação mental para casar com a
   * visão egocêntrica; o nariz do boneco mostra o heading.
   */
  _updatePose() {
    const grip = this._leftGrip;
    grip.getWorldPosition(this._gripPos);
    grip.getWorldQuaternion(this._gripQuat);
    this.object.quaternion.copy(this._gripQuat).invert();
    this._gripPos.y += WIM_HEIGHT;
    this.object.position.copy(grip.worldToLocal(this._gripPos));
    this.object.updateMatrixWorld(true);
  }

  /** Só no desktop: o boneco agarrado segue o raio do mouse projetado no piso da miniatura. */
  _updateDesktopDrag() {
    this.object.getWorldPosition(this._b);
    this._plane.setFromNormalAndCoplanarPoint(WORLD_UP, this._b);
    this._raycaster.setFromCamera(this.getPointerNdc(), this.camera);
    if (this._raycaster.ray.intersectPlane(this._plane, this._a)) {
      this.object.worldToLocal(this._a);
      this.marker.position.set(this._a.x, 0, this._a.z);
    }
  }

  /**
   * Chamar uma vez por quadro. A miniatura aparece enquanto o grip esquerdo está
   * apertado (ou enquanto há um boneco agarrado, para soltar o grip no meio do
   * arrasto não tirá-la da mão).
   */
  update() {
    const visible = this.active && (this.held || this.dragging);
    this.object.visible = visible;
    // O raio é o único desenho do controle (como no A2): visível durante o WIM, na headset.
    this.ray.visible = this.active && this.isPresenting();

    if (visible) {
      this._updatePose();
      if (this.dragging) {
        if (this.isPresenting()) this.marker.keepUpright(this._dragHand, this.camera);
        else this._updateDesktopDrag();
      }
    }
    if (!this.dragging) this.marker.syncToHead(this.world, this.camera);

    this.beaconCopy.position.copy(this.beacon.position);
    this.beaconCopy.visible = this.beacon.visible;
  }
}
