// Entrada pelo desktop (mouse + teclado), só para dev
//
// As mãos virtuais são filhas da câmera, de modo que o MESMO código das técnicas
// roda sem headset: a mão direita fica no olho e aponta ao longo do raio do mouse.
//
// A esquerda segura a miniatura no canto inferior esquerdo da visão. A validação na headset
// usa a versão real, com duas mãos.
//
// Comandos: segurar Espaço mostra a miniatura; botão esquerdo = ação da técnica;
// botão direito (arrastar) ou setas = olhar; 
// Enter = confirmar.

import * as THREE from "three";
import {
  DESKTOP_EYE_HEIGHT, DESKTOP_KEY_LOOK_SPEED, DESKTOP_LEFT_HAND_POSITION, DESKTOP_LOOK_SPEED, DESKTOP_MAX_PITCH,
} from "./constants.js";
import { FORWARD } from "./utils.js";

/** Teclando num campo de texto ou dropdown, os atalhos não devem disparar. */
function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
}

export class DesktopInput {
  /**
   * @param {object} deps
   * @param {THREE.PerspectiveCamera} deps.camera cuja orientação (olhar) esta classe controla
   * @param {THREE.WebGLRenderer} deps.renderer
   * @param {THREE.Object3D} deps.rig atualizado antes de ler a pose da mão ao clicar
   * @param {object} deps.handlers callbacks: action(start), confirm(), hold(held)
   */
  constructor({ camera, renderer, rig, handlers }) {
    this.camera = camera;
    this.renderer = renderer;
    this.rig = rig;
    this.handlers = handlers;

    // Campos públicos (os testes e o console leem e escrevem yaw/pitch/ndc).
    this.root = new THREE.Group(); // some quando há uma sessão XR
    this.left = new THREE.Group(); // segura a miniatura
    this.right = new THREE.Group(); // aponta ao longo do raio do mouse
    this.ndc = new THREE.Vector2(0, 0); // posição do mouse em coordenadas normalizadas (-1..1)
    this.yaw = 0;
    this.pitch = 0;
    this.looking = false; // arrastando com o botão direito
    this.keys = new Set(); // setas pressionadas

    this.left.position.set(...DESKTOP_LEFT_HAND_POSITION);
    this.root.add(this.left, this.right);
    camera.add(this.root);

    camera.rotation.order = "YXZ";
    this.resetCamera();
    this._dirLocal = new THREE.Vector3();
    this._wire();
  }

  /**
   * Volta a câmera para a pose de desktop (altura dos olhos, yaw/pitch atuais).
   * Também serve ao fim de uma sessão XR, que deixa a câmera na última pose da cabeça.
   */
  resetCamera() {
    this.camera.position.set(0, DESKTOP_EYE_HEIGHT, 0);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /**
   * Uma vez por quadro (e ao clicar, para apontar antes de ler a pose): aplica as
   * setas ao olhar e aponta a mão direita ao longo do raio do mouse. Não faz nada
   * dentro de uma sessão XR (a pose vem da headset).
   */
  updateHands(delta) {
    if (this.renderer.xr.isPresenting) return;

    const yawKey = (this.keys.has("ArrowLeft") ? 1 : 0) - (this.keys.has("ArrowRight") ? 1 : 0);
    const pitchKey = (this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("ArrowDown") ? 1 : 0);
    this.yaw += yawKey * DESKTOP_KEY_LOOK_SPEED * delta;
    this.pitch = THREE.MathUtils.clamp(this.pitch + pitchKey * DESKTOP_KEY_LOOK_SPEED * delta, -DESKTOP_MAX_PITCH, DESKTOP_MAX_PITCH);
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this._dirLocal.set(this.ndc.x * halfHeight * this.camera.aspect, this.ndc.y * halfHeight, -1).normalize();
    this.right.quaternion.setFromUnitVectors(FORWARD, this._dirLocal);
  }

  /** Converte a posição do mouse (pixels) em coordenadas normalizadas. */
  _setPointer(e) {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }

  _wire() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("mousedown", (e) => {
      if (this.renderer.xr.isPresenting) return;
      this._setPointer(e);
      if (e.button === 2) {
        this.looking = true;
      } else if (e.button === 0) {
        this.updateHands(0); // aponta antes de ler a pose
        this.rig.updateMatrixWorld(true);
        this.handlers.action(true);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.renderer.xr.isPresenting) return;
      if (e.button === 2) this.looking = false;
      else if (e.button === 0) this.handlers.action(false);
    });

    window.addEventListener("mousemove", (e) => {
      this._setPointer(e);
      if (this.looking) {
        this.yaw -= e.movementX * DESKTOP_LOOK_SPEED;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * DESKTOP_LOOK_SPEED, -DESKTOP_MAX_PITCH, DESKTOP_MAX_PITCH);
      }
    });

    window.addEventListener("keydown", (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.handlers.hold(true);
      } else if (e.key === "Enter") {
        this.handlers.confirm();
      } else if (e.code.startsWith("Arrow")) {
        e.preventDefault();
        this.keys.add(e.code);
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this.handlers.hold(false);
      this.keys.delete(e.code);
    });
  }
}
