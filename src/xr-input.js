// Entrada pela headset (WebXR).
//
// Prepara o WebXR (botão "Enter VR", dois controladores e seus grips dentro do rig)
// e traduz os botões em callbacks.
// 
// Não sabe o que cada botão faz: só avisa.
//
// Mapa de botões:
//   gatilho direito  -> ação da técnica (agarrar o boneco / mirar e pular)
//   gatilho esquerdo -> confirmar a tentativa (e seguir nas telas de resultado/bloco)
//   grip esquerdo    -> mostrar a miniatura

import { VRButton } from "three/addons/webxr/VRButton.js";

export class XrInput {
  /**
   * @param {object} deps
   * @param {THREE.WebGLRenderer} deps.renderer
   * @param {THREE.Object3D} deps.rig controladores e grips entram aqui: se fossem filhos
   *   da cena, ficariam para trás quando o rig se move
   * @param {object} deps.handlers callbacks:
   *   action(start), confirm(), hold(held), controllersChanged(), sessionStart(), sessionEnd()
   */
  constructor({ renderer, rig, handlers }) {
    this.handlers = handlers;
    /** Controladores (espaço do raio de apontar); a lateralidade fica em `userData.handedness`. */
    this.controllers = [];
    /** Grips (espaço da mão), na mesma ordem dos controladores. */
    this.grips = [];

    renderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(renderer));

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const grip = renderer.xr.getControllerGrip(i);

      controller.addEventListener("connected", (e) => this._onConnected(e));
      controller.addEventListener("disconnected", (e) => this._onDisconnected(e));
      controller.addEventListener("selectstart", (e) => this._onSelectStart(e));
      controller.addEventListener("selectend", (e) => this._onSelectEnd(e));
      controller.addEventListener("squeezestart", (e) => this._onSqueeze(e, true));
      controller.addEventListener("squeezeend", (e) => this._onSqueeze(e, false));

      rig.add(controller, grip);
      this.controllers.push(controller);
      this.grips.push(grip);
    }

    renderer.xr.addEventListener("sessionstart", () => this.handlers.sessionStart());
    renderer.xr.addEventListener("sessionend", () => this.handlers.sessionEnd());
  }

  // O WebXR só informa a lateralidade quando o controlador conecta.
  _onConnected(event) {
    event.target.userData.handedness = event.data.handedness;
    this.handlers.controllersChanged();
  }

  _onDisconnected(event) {
    event.target.userData.handedness = null;
    this.handlers.controllersChanged();
  }

  _isRight(event) {
    return event.target.userData.handedness === "right";
  }

  _isLeft(event) {
    return event.target.userData.handedness === "left";
  }

  _onSelectStart(event) {
    if (this._isRight(event)) this.handlers.action(true);
    else if (this._isLeft(event)) this.handlers.confirm();
  }

  _onSelectEnd(event) {
    if (this._isRight(event)) this.handlers.action(false);
  }

  _onSqueeze(event, held) {
    if (this._isLeft(event)) this.handlers.hold(held);
  }
}
