//
//  - DomHud: a barra da página (para quem conduz o experimento). Lê participante,
//    técnica e "treino" e mostra o estado da sessão. Não conhece a tarefa: só lê e
//    escreve elementos do DOM e repassa os eventos por callbacks.

//  - WorldHud: o painel preso à cabeça, dentro da headset (só aparece numa sessão
//    XR). Desenha um "painel" (título, linhas, dica) num canvas que vira a textura
//    de um Sprite.
//
// O que cada HUD mostra (o conteúdo) é decidido pelo TrialSession; os textos estão
// em strings.js.

import * as THREE from "three";
import {
  HUD_BOTTOM_PADDING, HUD_FONT_FAMILY, HUD_MIN_FONT_PX, HUD_NORMAL_BACKGROUND, HUD_NORMAL_TEXT, HUD_OK_BACKGROUND,
  HUD_OK_TEXT, HUD_PADDING_X, HUD_ROW_LABEL_TEXT, HUD_ROW_PADDING_X, HUD_ROW_PX, HUD_ROW_STEP, HUD_ROW_TOP,
  HUD_ROW_VALUE_TEXT, HUD_SUBTITLE_GAP, HUD_SUBTITLE_HEIGHT, HUD_SUBTITLE_PX, HUD_SUBTITLE_Y_NO_ROWS, HUD_TITLE_PX,
  HUD_TITLE_Y, WORLD_HUD_CANVAS_HEIGHT, WORLD_HUD_CANVAS_WIDTH, WORLD_HUD_CENTER, WORLD_HUD_CORNER,
} from "./constants.js";

/**
 * A barra da página. Os ids são os do index.html.
 * Os eventos chegam por callbacks (`onConfirm`, `onTechniqueChange`...); depois de
 * mudar a técnica ou o treino, o foco sai do campo para Enter e Espaço continuarem
 * chegando ao canvas.
 */
export class DomHud {
  constructor() {
    const byId = (id) => document.getElementById(id);
    this.participantInput = byId("participantId");
    this.techniqueSelect = byId("techniqueSelect");
    this.practiceToggle = byId("practiceToggle");
    this.trialCountEl = byId("trialCount");
    this.confirmBtn = byId("confirmBtn");
    this.downloadBtn = byId("downloadBtn");
    this.orderHintEl = byId("orderHint");
    this.lastResultEl = byId("lastResult");
    this.statusEl = byId("status");
  }

  /** Id da técnica escolhida (1 = WIM, 2 = teleporte). */
  get technique() {
    return Number(this.techniqueSelect.value);
  }

  set technique(id) {
    this.techniqueSelect.value = String(id);
  }

  /** Id do participante, sem espaços; "UNKNOWN" se estiver vazio. */
  get participant() {
    return this.participantInput.value.trim() || "UNKNOWN";
  }

  /** Tentativas de treino rodam normalmente, mas não são registradas. */
  get practice() {
    return this.practiceToggle.checked;
  }

  setTrialLabel(text) {
    this.trialCountEl.textContent = text;
  }

  setOrderHint(text) {
    this.orderHintEl.textContent = text;
  }

  setLastResult(text) {
    this.lastResultEl.textContent = text;
  }

  /** Texto de estado; `inRange` pinta a pílula de verde (dentro do raio de confirmação). */
  setStatus(text, inRange) {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("in-range", inRange);
  }

  /** Marca a pílula de estado enquanto há uma sessão XR ativa. */
  setInVr(inVr) {
    this.statusEl.classList.toggle("in-vr", inVr);
  }

  onConfirm(fn) {
    this.confirmBtn.addEventListener("click", fn);
  }

  onDownload(fn) {
    this.downloadBtn.addEventListener("click", fn);
  }

  onTechniqueChange(fn) {
    this.techniqueSelect.addEventListener("change", () => {
      this.techniqueSelect.blur();
      fn();
    });
  }

  onPracticeChange(fn) {
    this.practiceToggle.addEventListener("change", () => {
      this.practiceToggle.blur();
      fn();
    });
  }

  onParticipantChange(fn) {
    this.participantInput.addEventListener("change", fn);
  }
}

/**
 * O painel preso à cabeça. Um canvas, duas posições: um painel pequeno no canto
 * para as dicas e um maior no meio da visão para o resultado (ver constants.js).
 *
 * Um "painel" é {title, subtitle, ok, rows?}: `rows` é uma lista de [rótulo, valor]
 * (só o resultado tem); `ok` pinta o painel de verde.
 */
export class WorldHud {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = WORLD_HUD_CANVAS_WIDTH;
    this.canvas.height = WORLD_HUD_CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);

    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false }));
    this.sprite.center.set(0.5, 1); // ancorado pela borda de cima
    this.sprite.scale.set(...WORLD_HUD_CORNER.scale);
    this.sprite.position.set(...WORLD_HUD_CORNER.position);
    this.sprite.renderOrder = 999;
    this.sprite.visible = false;

    this._lastKey = "";
  }

  /**
   * Prende o painel à câmera, que precisa estar na cena: os filhos de uma câmera
   * só são desenhados se a câmera for alcançável a partir da cena.
   */
  attachTo(camera) {
    camera.add(this.sprite);
  }

  /**
   * Desenha o painel (se mudou) e mostra o sprite só durante uma sessão XR.
   * @param {{title:string, subtitle:string, ok:boolean, rows?:[string,string][]}} panel
   * @param {boolean} presenting há uma sessão XR ativa?
   */
  update(panel, presenting) {
    if (!presenting) {
      this.sprite.visible = false;
      return;
    }
    this.sprite.visible = true;

    const key = JSON.stringify(panel);
    if (key === this._lastKey) return; // só redesenha e reenvia a textura quando o conteúdo muda
    this._lastKey = key;

    // O resultado vai no meio da visão e maior; as dicas ficam no canto.
    const placement = panel.rows ? WORLD_HUD_CENTER : WORLD_HUD_CORNER;
    this.sprite.scale.set(...placement.scale);
    this.sprite.position.set(...placement.position);

    this._draw(panel);
    this.texture.needsUpdate = true;
  }

  /** Desenha de cima para baixo e pinta o fundo só até a altura usada. */
  _draw(panel) {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const maxTextWidth = width - 2 * HUD_PADDING_X;

    const rowsBottom = HUD_ROW_TOP + (panel.rows ? panel.rows.length * HUD_ROW_STEP : 0);
    const subtitleY = panel.rows ? rowsBottom + HUD_SUBTITLE_GAP : HUD_SUBTITLE_Y_NO_ROWS;
    const height = subtitleY + HUD_SUBTITLE_HEIGHT + HUD_BOTTOM_PADDING;

    ctx.clearRect(0, 0, width, canvas.height);
    ctx.fillStyle = panel.ok ? HUD_OK_BACKGROUND : HUD_NORMAL_BACKGROUND;
    ctx.fillRect(0, 0, width, height);

    const textColor = panel.ok ? HUD_OK_TEXT : HUD_NORMAL_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.fillStyle = textColor;
    this._fitFont(panel.title, maxTextWidth, HUD_TITLE_PX);
    ctx.fillText(panel.title, HUD_PADDING_X, HUD_TITLE_Y);

    if (panel.rows) {
      ctx.font = `600 ${HUD_ROW_PX}px ${HUD_FONT_FAMILY}`;
      panel.rows.forEach(([label, value], i) => {
        const y = HUD_ROW_TOP + i * HUD_ROW_STEP;
        ctx.textAlign = "left";
        ctx.fillStyle = HUD_ROW_LABEL_TEXT;
        ctx.fillText(label, HUD_ROW_PADDING_X, y);
        ctx.textAlign = "right";
        ctx.fillStyle = HUD_ROW_VALUE_TEXT;
        ctx.fillText(value, width - HUD_ROW_PADDING_X, y);
      });
      ctx.textAlign = "left";
    }

    ctx.fillStyle = textColor;
    this._fitFont(panel.subtitle, maxTextWidth, HUD_SUBTITLE_PX);
    ctx.fillText(panel.subtitle, HUD_PADDING_X, subtitleY);
  }

  /**
   * Escolhe a fonte do próximo texto: começa em `px` e vai diminuindo de 2 em 2
   * até o texto caber em `maxWidth` (nunca abaixo de HUD_MIN_FONT_PX). Textos em
   * português são mais compridos que os em inglês e precisam disso para caber.
   */
  _fitFont(text, maxWidth, px) {
    const { ctx } = this;
    let size = px;
    ctx.font = `600 ${size}px ${HUD_FONT_FAMILY}`;
    while (size > HUD_MIN_FONT_PX && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = `600 ${size}px ${HUD_FONT_FAMILY}`;
    }
  }
}
