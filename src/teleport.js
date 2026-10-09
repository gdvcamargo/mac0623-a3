// Técnica 2, teleporte em arco.
//
// Segurar o gatilho direito mostra um arco parabólico que sai do controlador, com
// um anel onde ele pousaria; 
// 
// Soltar o gatilho pula até lá. Nada se move enquanto se mantém a mira, e o pulo é instantâneo.

import * as THREE from "three";
import {
  ARC_INVALID_COLOR, ARC_STEPS, ARC_VALID_COLOR, ENV_HALF, LANDING_RING_INNER, LANDING_RING_LIFT, LANDING_RING_OUTER,
  PLAYABLE_MARGIN, PLAYER_RADIUS, TELEPORT_GRAVITY, TELEPORT_SPEED,
} from "./constants.js";
import { FORWARD } from "./utils.js";

export class TeleportAim {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene o arco e o anel são adicionados à cena (em coordenadas de mundo)
   * @param {import("./viewpoint.js").Viewpoint} deps.viewpoint quem pula ao soltar o gatilho
   * @param {import("./environment.js").Environment} deps.environment para validar o pouso
   */
  constructor({ scene, viewpoint, environment }) {
    this.viewpoint = viewpoint;
    this.environment = environment;

    /** Estado de mira */
    this.aiming = false;
    this.valid = false;
    this.point = new THREE.Vector3(); // onde o arco pousa, no chão

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC_STEPS + 1) * 3), 3));
    this.arc = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: ARC_VALID_COLOR }));
    this.arc.frustumCulled = false; // as posições mudam todo quadro: a esfera englobante ficaria velha
    this.arc.visible = false;
    scene.add(this.arc);

    this.landing = new THREE.Mesh(
      new THREE.RingGeometry(LANDING_RING_INNER, LANDING_RING_OUTER, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ARC_VALID_COLOR, side: THREE.DoubleSide }),
    );
    this.landing.visible = false;
    scene.add(this.landing);

    this._origin = new THREE.Vector3();
    this._velocity = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  /** Gatilho direito apertado: começa a mirar. */
  start() {
    this.aiming = true;
  }

  /** Gatilho solto: pula até o ponto de pouso, se ele for válido. */
  end() {
    if (!this.aiming) return;
    this.aiming = false;
    this.arc.visible = false;
    this.landing.visible = false;
    if (this.valid) this.viewpoint.moveTo(this.point.x, this.point.z, "teleport");
  }

  /** Para de mirar sem pular. */
  cancel() {
    this.aiming = false;
    this.arc.visible = false;
    this.landing.visible = false;
  }

  /**
   * A cada quadro, enquanto se mira: recalcula o arco a partir da pose da mão. 
   * 
   * O arco é um projétil lançado ao longo do eixo -z da mão: 
   * 
   * p(t) = p0 + v*t + 0.5 * g * t^2.
   * 
   * @param {THREE.Object3D} rightHand a mão que mira
   */
  update(rightHand) {
    if (!this.aiming) return;

    rightHand.getWorldPosition(this._origin);
    rightHand.getWorldQuaternion(this._quat);
    this._velocity.copy(FORWARD).applyQuaternion(this._quat).multiplyScalar(TELEPORT_SPEED);

    const origin = this._origin;
    const velocity = this._velocity;
    const g = TELEPORT_GRAVITY;
    const tLand = (velocity.y + Math.sqrt(velocity.y * velocity.y + 2 * g * Math.max(origin.y, 0))) / g;

    // Calcula a trajetória do projétil
    const positions = this.arc.geometry.attributes.position.array;
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = (tLand * i) / ARC_STEPS;
      positions[i * 3] = origin.x + velocity.x * t;
      positions[i * 3 + 1] = Math.max(origin.y + velocity.y * t - 0.5 * g * t * t, 0);
      positions[i * 3 + 2] = origin.z + velocity.z * t;
    }
    this.arc.geometry.attributes.position.needsUpdate = true;

    // Ponto do pouso, no chão (y=0)
    this.point.set(positions[ARC_STEPS * 3], 0, positions[ARC_STEPS * 3 + 2]);
    const limit = ENV_HALF - PLAYABLE_MARGIN;

    // Inválido fora da casa ou sobre uma parede ou um móvel. 
    // O arco em si não é bloqueado: é a mesma regra "pulos atravessam paredes, pousos não" que a miniatura segue.
    this.valid =
      Math.abs(this.point.x) <= limit &&
      Math.abs(this.point.z) <= limit &&
      !this.environment.isBlocked(this.point.x, this.point.z, PLAYER_RADIUS);

    // Cor com base na validade
    const color = this.valid ? ARC_VALID_COLOR : ARC_INVALID_COLOR;
    this.arc.material.color.setHex(color);
    this.landing.material.color.setHex(color);
    this.landing.position.copy(this.point);
    this.landing.position.y = LANDING_RING_LIFT;
    this.arc.visible = true;
    this.landing.visible = true;
  }
}
