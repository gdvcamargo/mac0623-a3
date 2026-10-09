// Classe auxiliar para gerenciar as mãos do usuário
//
// As técnicas só leem dois objetos: o grip esquerdo (que segura a miniatura) e a
// mão direita (que mira o raio/arco e carrega o boneco).
//
// Dentro de um headset eles são os controladores XR, escolhidos pela lateralidade (handedness); fora dela, são
// mãos virtuais presas à câmera (modo desktop).
//
// Esta classe faz essa escolha e avisa quem precisa reprender objetos nas mãos novas.

export class Hands {
  /**
   * @param {object} deps
   * @param {() => boolean} deps.isPresenting há uma sessão XR ativa?
   * @param {import("./xr-input.js").XrInput} deps.xrInput controladores e grips
   * @param {import("./desktop-input.js").DesktopInput} deps.desktopInput mãos virtuais
   */
  constructor({ isPresenting, xrInput, desktopInput }) {
    this.isPresenting = isPresenting;
    this.xrInput = xrInput;
    this.desktopInput = desktopInput;

    /** Segura a miniatura. */
    this.leftGrip = null;
    /** Mira o raio/arco e carrega o boneco agarrado. */
    this.rightHand = null;

    this._listeners = [];
  }

  /** Registra `fn(leftGrip, rightHand)`, chamada sempre que as mãos são (re)decididas. */
  onChange(fn) {
    this._listeners.push(fn);
  }

  /**
   * Decide qual objeto é a mão esquerda (segura a miniatura) e qual é a direita
   * (mira). 
   * 
   * O WebXR só informa a lateralidade quando o controlador conecta e a
   * ordem dos índices não é garantida, então casa pela lateralidade e, até ela ser
   * conhecida, cai para a ordem dos índices.
   */
  resolve() {
    if (this.isPresenting()) {
      const { controllers, grips } = this.xrInput;
      const handedness = controllers.map((c) => c.userData.handedness);
      let l = handedness.indexOf("left");
      let r = handedness.indexOf("right");
      if (l < 0) l = r === 0 ? 1 : 0;
      if (r < 0) r = l === 0 ? 1 : 0;
      this.leftGrip = grips[l];
      this.rightHand = controllers[r];
      this.desktopInput.root.visible = false;
    } else {
      this.leftGrip = this.desktopInput.left;
      this.rightHand = this.desktopInput.right;
      this.desktopInput.root.visible = true;
    }
    for (const fn of this._listeners) fn(this.leftGrip, this.rightHand);
  }
}
