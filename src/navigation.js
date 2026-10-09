// Despachante das duas técnicas de navegação.
//
// A entrada (headset ou mouse) só sabe dizer "a ação da mão direita começou/acabou";
// quem decide o que isso significa é a técnica atual: com o WIM, agarrar e soltar o
// boneco; com o teleporte, mirar e pular. Esta classe liga uma coisa à outra e
// cuida da ordem das atualizações de cada quadro.

import { TECHNIQUE } from "./constants.js";

export class NavigationController {
  /**
   * @param {object} deps
   * @param {import("./miniature.js").Miniature} deps.miniature técnica 1
   * @param {import("./teleport.js").TeleportAim} deps.teleport técnica 2
   * @param {import("./hands.js").Hands} deps.hands de onde vem a mão direita
   * @param {() => number} deps.getTechnique id da técnica atual (TECHNIQUE.WIM ou .TELEPORT)
   */
  constructor({ miniature, teleport, hands, getTechnique }) {
    this.miniature = miniature;
    this.teleport = teleport;
    this.hands = hands;
    this.getTechnique = getTechnique;
  }

  /** A ação da mão direita (gatilho / botão do mouse) começou (`start`) ou acabou. */
  action(start) {
    if (this.getTechnique() === TECHNIQUE.WIM) {
      if (start) this.miniature.actionStart(this.hands.rightHand);
      else this.miniature.actionEnd();
    } else if (start) {
      this.teleport.start();
    } else {
      this.teleport.end();
    }
  }

  /** Larga qualquer gesto em curso (arrasto do boneco, mira) sem mover ninguém. */
  cancel() {
    this.miniature.cancel();
    this.teleport.cancel();
  }

  /** Uma vez por quadro: primeiro a miniatura, depois a mira do teleporte. */
  update() {
    this.miniature.setActive(this.getTechnique() === TECHNIQUE.WIM);
    this.miniature.update();
    this.teleport.update(this.hands.rightHand);
  }
}
