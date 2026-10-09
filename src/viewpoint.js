// O ponto de vista (rig)
//
// O WebXR sobrescreve a pose da câmera a cada quadro (é a pose da cabeça), então
// não dá para mover a câmera diretamente: 
// 
// o ponto de vista se move movendo o RIG, o grupo que contém a câmera e os controladores. 
// Esta classe é a única que mexe no rig e, por isso, a única que conta pulos: o path_length significa a mesma
// coisa nas duas técnicas.

import * as THREE from "three";
import { ENV_HALF, PLAYABLE_MARGIN } from "./constants.js";

/**
 * Dono do rig. Move o ponto de vista com `moveTo` e avisa quem quiser saber de
 * cada pulo.
 */
export class Viewpoint {
  /** @param {THREE.PerspectiveCamera} camera a câmera é colocada dentro do rig */
  constructor(camera) {
    this.camera = camera;
    this.rig = new THREE.Group();
    this.rig.name = "rig";
    this.rig.add(camera);

    this._jumpListeners = [];
    this._head = new THREE.Vector3();
    this._headAfter = new THREE.Vector3();
  }

  /** Registra `fn(distancia)`, chamada a cada pulo depois que o rig foi movido. */
  onJump(fn) {
    this._jumpListeners.push(fn);
  }

  /** Posição, no mundo, da cabeça (a câmera). Escreve em `out` e o devolve. */
  headPosition(out) {
    return this.camera.getWorldPosition(out);
  }

  /**
   * Pula para que a CABEÇA (não a origem do rig) fique em (x, z) do mundo.
   *
   * Quem usa a headset quase nunca está no centro do rig, então o rig é deslocado
   * pela diferença entre o alvo e a posição atual da cabeça, e não posto no alvo.
   * A altura não muda (o chão é plano). Usado pelas duas técnicas.
   *
   * @param {number} x
   * @param {number} z
   * @param {string} via de onde veio o pulo ("wim", "teleport"...); só para o log
   */
  moveTo(x, z, via) {
    this.headPosition(this._head);
    const dx = x - this._head.x;
    const dz = z - this._head.z;
    this.rig.position.x += dx;
    this.rig.position.z += dz;
    this.rig.updateMatrixWorld(true); // para o próximo getWorldPosition() já ver a pose nova

    const jump = Math.hypot(dx, dz);
    for (const fn of this._jumpListeners) fn(jump);

    this.headPosition(this._headAfter);
    console.log(
      `[move:${via}] head (${this._head.x.toFixed(2)}, ${this._head.z.toFixed(2)}) -> target (${x.toFixed(2)}, ${z.toFixed(2)})` +
      ` | jump ${jump.toFixed(2)} m | head now (${this._headAfter.x.toFixed(2)}, ${this._headAfter.z.toFixed(2)})` +
      ` | rig (${this.rig.position.x.toFixed(2)}, ${this.rig.position.z.toFixed(2)})`,
    );
  }

  /** Limita uma coordenada ao interior jogável (a PLAYABLE_MARGIN das paredes externas). */
  clampToPlayable(value) {
    const limit = ENV_HALF - PLAYABLE_MARGIN;
    return THREE.MathUtils.clamp(value, -limit, limit);
  }
}
