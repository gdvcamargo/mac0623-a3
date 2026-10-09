// MAC0623 — A3: a sessão de tentativas (trials).
//
// Aqui estão as regras do experimento, sem nada de interação nem de desenho:
//  - a máquina de fases de cada tentativa;
//  - o sorteio da beacon e a medição (tempo, caminho, pulos);
//  - o CSV (uma linha por tentativa) e a ordem ABBA;
//  - o conteúdo do que os dois HUDs mostram em cada fase.
//
// Fases (`state.phase`):
//   "active":  há uma beacon e o relógio está correndo.
//   "result":  a tentativa acabou de ser confirmada: a beacon some, nada é cronometrado
//              e as métricas ficam na tela para o participante ler em voz alta (o CSV
//              não dá para baixar na hora). Confirmar inicia o que vem depois.
//   "between": as tentativas desta técnica acabaram e falta a outra para este
//              participante; confirmar inicia a outra técnica.
//   "done":    as duas técnicas acabaram para este participante.

import * as THREE from "three";
import {
  ABBA, ACK_MIN_MS, BEACON_CLEARANCE, BEACON_EDGE_MARGIN, BEACON_MAX_DISTANCE, BEACON_MIN_DISTANCE, CONFIRM_RADIUS,
  ENV_HALF, FLASH_MS, PATH_MIN_STEP, TECHNIQUE, TRIALS_PER_TECHNIQUE,
} from "./constants.js";
import { TECHNIQUE_NAMES, TEXTOS } from "./strings.js";

/** Colunas do CSV. As oito primeiras são as do enunciado; as quatro últimas são extras. */
const CSV_HEADER = [
  "participant_id",
  "technique",
  "trial_number",
  "presentation_order",
  "completion_time_s",
  "path_length",
  "straight_line_distance",
  "path_ratio",
  // Extras: como o path_length se divide e quão perto da beacon foi a confirmação.
  "walk_length",
  "jump_length",
  "n_moves",
  "final_distance_to_beacon",
];

/** O id da outra técnica. */
const otherTechnique = (id) => (id === TECHNIQUE.WIM ? TECHNIQUE.TELEPORT : TECHNIQUE.WIM);

/**
 * Técnica que o plano ABBA manda usar primeiro para um participante: P01 → WIM,
 * P02 → teleporte, P03 → teleporte, P04 → WIM, e repete. Devolve null se o id não
 * tiver número.
 * @param {string} pid
 */
export function abbaFirstTechnique(pid) {
  const match = pid.match(/\d+/);
  if (!match) return null;
  return ABBA[(Number(match[0]) - 1 + ABBA.length) % ABBA.length];
}

export class TrialSession {
  /**
   * @param {object} deps
   * @param {import("./environment.js").Environment} deps.environment
   * @param {import("./viewpoint.js").Viewpoint} deps.viewpoint
   * @param {import("./hud.js").DomHud} deps.hud barra da página
   * @param {import("./hud.js").WorldHud} deps.worldHud painel da headset
   * @param {() => boolean} deps.isPresenting há uma sessão XR ativa?
   * @param {() => void} deps.cancelInteractions larga o gesto em curso (arrasto, mira)
   */
  constructor({ environment, viewpoint, hud, worldHud, isPresenting, cancelInteractions }) {
    this.environment = environment;
    this.beacon = environment.beacon;
    this.viewpoint = viewpoint;
    this.hud = hud;
    this.worldHud = worldHud;
    this.isPresenting = isPresenting;
    this.cancelInteractions = cancelInteractions;

    /** Linhas do CSV, em memória (o enunciado manda baixar a cada participante). */
    this.rows = [];

    /** Estado da tentativa atual. Os testes e o console leem estes campos. */
    this.state = {
      phase: "done",
      startTime: 0,
      startHead: new THREE.Vector3(),
      straightLine: 0,
      walkLength: 0,
      jumpLength: 0,
      moves: 0,
      walkAnchor: new THREE.Vector3(),
    };

    /** Métricas da tentativa recém-confirmada, mostradas na fase "result". */
    this.lastResult = null;
    this.trialLabel = ""; // "WIM · tentativa 2/2"
    this._phaseEnteredAt = 0; // quando a tela de resultado / bloco apareceu (ver ACK_MIN_MS)
    this._flashMessage = "";
    this._flashUntil = 0;
    this._head = new THREE.Vector3();

    // Cada pulo soma ao caminho. A caminhada física é medida em trackWalking().
    viewpoint.onJump((jump) => {
      if (this.state.phase !== "active") return;
      this.state.jumpLength += jump;
      this.state.moves += 1;
      viewpoint.headPosition(this.state.walkAnchor); // a caminhada recomeça daqui
    });
  }

  // -------------------------------------------------------------------------
  // Contagens e ordem
  // -------------------------------------------------------------------------

  /** Quantas tentativas registradas este participante tem nesta técnica. */
  loggedCount(pid, technique) {
    return this.rows.filter((r) => r.participant_id === pid && r.technique === technique).length;
  }

  /**
   * A posição que esta técnica ocupa na sessão do participante: 1 se foi a
   * primeira usada, 2 se foi a segunda. É isso que o ABBA varia entre participantes.
   */
  presentationOrderFor(pid, technique) {
    const seen = [];
    for (const row of this.rows) {
      if (row.participant_id === pid && !seen.includes(row.technique)) seen.push(row.technique);
    }
    const index = seen.indexOf(technique);
    return index >= 0 ? index + 1 : seen.length + 1;
  }

  /** Texto do plano ABBA para um participante ("" se o id não tem número). */
  orderHintFor(pid) {
    const first = abbaFirstTechnique(pid);
    if (!first) return "";
    return TEXTOS.orderHint(TECHNIQUE_NAMES[first], TECHNIQUE_NAMES[otherTechnique(first)]);
  }

  /**
   * Participante sem nada registrado começa pela técnica que o plano ABBA manda;
   * o experimentador ainda pode trocar no dropdown. Chamar quando o id mudar.
   */
  applyPlanForParticipant() {
    const pid = this.hud.participant;
    if (this.loggedCount(pid, TECHNIQUE.WIM) + this.loggedCount(pid, TECHNIQUE.TELEPORT) === 0) {
      const first = abbaFirstTechnique(pid);
      if (first) this.hud.technique = first;
    }
  }

  // -------------------------------------------------------------------------
  // Fases
  // -------------------------------------------------------------------------

  /** Mensagem rápida no HUD da headset ("Longe demais..."), por FLASH_MS. */
  flash(message) {
    this._flashMessage = message;
    this._flashUntil = performance.now() + FLASH_MS;
  }

  /** Distância no plano do chão entre a cabeça e a beacon. */
  distanceToBeacon() {
    this.viewpoint.headPosition(this._head);
    return Math.hypot(this._head.x - this.beacon.position.x, this._head.z - this.beacon.position.z);
  }

  /**
   * Sorteia a beacon a 14–30 m da cabeça, dentro da casa e longe de paredes e
   * móveis. Amostragem com rejeição; o plano B (nunca usado na prática) é o canto
   * da casa mais distante da cabeça.
   */
  _spawnBeacon() {
    this.viewpoint.headPosition(this._head);
    const half = ENV_HALF - BEACON_EDGE_MARGIN;

    let x = 0;
    let z = 0;
    let found = false;
    for (let attempt = 0; attempt < 500 && !found; attempt++) {
      x = THREE.MathUtils.randFloat(-half, half);
      z = THREE.MathUtils.randFloat(-half, half);
      const d = Math.hypot(x - this._head.x, z - this._head.z);
      const clear = !this.environment.isBlocked(x, z, BEACON_CLEARANCE);
      found = d >= BEACON_MIN_DISTANCE && d <= BEACON_MAX_DISTANCE && clear;
    }
    if (!found) {
      x = this._head.x > 0 ? -half : half;
      z = this._head.z > 0 ? -half : half;
    }

    this.beacon.setPosition(x, z);
    this.beacon.setVisible(true);
  }

  /**
   * Começa o que vem agora: a próxima tentativa, ou a tela de "bloco concluído" /
   * "tudo pronto" se as tentativas da técnica atual acabaram.
   */
  start() {
    const pid = this.hud.participant;
    const technique = this.hud.technique;
    const practice = this.hud.practice;
    const state = this.state;
    this.hud.setOrderHint(this.orderHintFor(pid));

    const done = this.loggedCount(pid, technique);
    if (!practice && done >= TRIALS_PER_TECHNIQUE) {
      const other = otherTechnique(technique);
      state.phase = this.loggedCount(pid, other) < TRIALS_PER_TECHNIQUE ? "between" : "done";
      this._phaseEnteredAt = performance.now();
      this.beacon.setVisible(false);
      this._setTrialLabel(TEXTOS.techniqueDone(TECHNIQUE_NAMES[technique]));
      return;
    }

    state.phase = "active";
    this._spawnBeacon();
    this.viewpoint.headPosition(state.startHead);
    state.straightLine = Math.hypot(
      this.beacon.position.x - state.startHead.x,
      this.beacon.position.z - state.startHead.z,
    );
    state.walkLength = 0;
    state.jumpLength = 0;
    state.moves = 0;
    state.walkAnchor.copy(state.startHead);
    state.startTime = performance.now();

    const name = TECHNIQUE_NAMES[technique];
    this._setTrialLabel(practice ? TEXTOS.practiceLabel(name) : TEXTOS.trialLabel(name, done + 1, TRIALS_PER_TECHNIQUE));
    console.log(
      `[trial] ${this.trialLabel} | start (${state.startHead.x.toFixed(2)}, ${state.startHead.z.toFixed(2)})` +
      ` -> beacon (${this.beacon.position.x.toFixed(2)}, ${this.beacon.position.z.toFixed(2)}) | straight line ${state.straightLine.toFixed(2)} m`,
    );
  }

  _setTrialLabel(text) {
    this.trialLabel = text;
    this.hud.setTrialLabel(text);
  }

  /**
   * Botão de confirmar (gatilho esquerdo / Enter / botão da página).
   *  - "result": segue para a próxima tentativa ou tela de bloco (ignora um segundo
   *    toque logo em seguida, ver ACK_MIN_MS);
   *  - "between": inicia a outra técnica;
   *  - "active": confirma se a cabeça está dentro do raio de confirmação; senão,
   *    avisa o quão longe está.
   */
  tryConfirm() {
    const state = this.state;

    if (state.phase === "result") {
      if (performance.now() - this._phaseEnteredAt < ACK_MIN_MS) return;
      this.start(); // a próxima tentativa, ou a tela de bloco concluído / tudo pronto
      return;
    }
    if (state.phase === "between") {
      if (performance.now() - this._phaseEnteredAt < ACK_MIN_MS) return;
      this.hud.technique = otherTechnique(this.hud.technique);
      this.cancelInteractions();
      this.start();
      return;
    }
    if (state.phase !== "active") return;

    const distance = this.distanceToBeacon();
    if (distance > CONFIRM_RADIUS) {
      this.flash(TEXTOS.tooFar(distance));
      return;
    }

    const completionTimeS = (performance.now() - state.startTime) / 1000;
    const pathLength = state.walkLength + state.jumpLength;
    const pid = this.hud.participant;
    const technique = this.hud.technique;
    const practice = this.hud.practice;

    if (!practice) {
      this.rows.push({
        participant_id: pid,
        technique,
        trial_number: this.loggedCount(pid, technique) + 1,
        presentation_order: this.presentationOrderFor(pid, technique),
        completion_time_s: completionTimeS.toFixed(3),
        path_length: pathLength.toFixed(3),
        straight_line_distance: state.straightLine.toFixed(3),
        path_ratio: (pathLength / state.straightLine).toFixed(3),
        walk_length: state.walkLength.toFixed(3),
        jump_length: state.jumpLength.toFixed(3),
        n_moves: state.moves,
        final_distance_to_beacon: distance.toFixed(3),
      });
      console.log("[csv row]", this.rows[this.rows.length - 1]);
    }

    this.lastResult = {
      technique,
      practice,
      label: this.trialLabel, // ex.: "WIM · tentativa 2/2"
      time: completionTimeS,
      path: pathLength,
      straight: state.straightLine,
      ratio: pathLength / state.straightLine,
      moves: state.moves,
      // Verdadeiro na última tentativa do bloco: a próxima tela não é outra tentativa.
      lastOfBlock: !practice && this.loggedCount(pid, technique) >= TRIALS_PER_TECHNIQUE,
    };
    this.hud.setLastResult(TEXTOS.lastResult(this.lastResult));

    // Para o relógio e a tentativa aqui; a próxima começa na próxima confirmação.
    state.phase = "result";
    this._phaseEnteredAt = performance.now();
    this.cancelInteractions();
    this.beacon.setVisible(false);
  }

  // -------------------------------------------------------------------------
  // A cada quadro
  // -------------------------------------------------------------------------

  /**
   * Caminhada física da cabeça no plano do chão, em passos de pelo menos
   * PATH_MIN_STEP. Os pulos não passam por aqui: o evento onJump soma em
   * jumpLength e reancora a caminhada, então os dois nunca contam em dobro.
   */
  _trackWalking() {
    const state = this.state;
    if (state.phase !== "active") return;
    this.viewpoint.headPosition(this._head);
    const step = Math.hypot(this._head.x - state.walkAnchor.x, this._head.z - state.walkAnchor.z);
    if (step >= PATH_MIN_STEP) {
      state.walkLength += step;
      state.walkAnchor.copy(this._head);
    }
  }

  /** Chamar uma vez por quadro: mede a caminhada e atualiza beacon e HUDs. */
  update() {
    this._trackWalking();

    const state = this.state;
    let inRange = false;
    let status;
    if (state.phase === "active") {
      const distance = this.distanceToBeacon();
      inRange = distance <= CONFIRM_RADIUS;
      status = TEXTOS.statusActive(distance, CONFIRM_RADIUS, state.moves, state.walkLength, state.jumpLength);
    } else if (state.phase === "result") {
      status = TEXTOS.statusResult;
    } else if (state.phase === "between") {
      status = TEXTOS.statusBetween(TECHNIQUE_NAMES[otherTechnique(this.hud.technique)]);
    } else {
      status = TEXTOS.statusDone;
    }
    this.hud.setStatus(status, inRange);
    this.beacon.setInRange(inRange);
    this.worldHud.update(this.hudPanel(inRange), this.isPresenting());
  }

  /**
   * O que o HUD da headset mostra agora. Durante a tentativa é só uma dica pequena
   * (sem números, para não distrair da tarefa). Depois dela é o resultado: os
   * números que o participante lê em voz alta, já que o CSV não dá para baixar na
   * hora. São os mesmos quatro do CSV (completion_time_s, path_length,
   * straight_line_distance, path_ratio) e, no teleporte, a contagem de pulos.
   * @param {boolean} inRange a cabeça está dentro do raio de confirmação?
   */
  hudPanel(inRange) {
    const state = this.state;
    if (state.phase === "result" && this.lastResult) {
      const r = this.lastResult;
      const labels = TEXTOS.resultLabels;
      const rows = [
        [labels.time, TEXTOS.resultTime(r.time)],
        [labels.path, TEXTOS.resultMeters(r.path)],
        [labels.straight, TEXTOS.resultMeters(r.straight)],
        [labels.ratio, TEXTOS.resultRatio(r.ratio)],
      ];
      if (r.technique === TECHNIQUE.TELEPORT) rows.push([labels.jumps, String(r.moves)]);
      return {
        title: r.practice ? `${r.label} ${TEXTOS.notLogged}` : r.label,
        rows,
        subtitle: r.lastOfBlock ? TEXTOS.resultContinue : TEXTOS.resultNext,
        ok: true,
      };
    }
    if (state.phase === "between") {
      return {
        title: TEXTOS.hudBlockTitle,
        subtitle: TEXTOS.hudBlockNext(TECHNIQUE_NAMES[otherTechnique(this.hud.technique)]),
        ok: true,
      };
    }
    if (state.phase === "done") {
      return { title: TEXTOS.hudDoneTitle, subtitle: TEXTOS.hudDoneSubtitle, ok: true };
    }
    const flashing = performance.now() < this._flashUntil;
    return {
      title: this.trialLabel,
      subtitle: flashing ? this._flashMessage : inRange ? TEXTOS.hudInRange : TEXTOS.hudHint,
      ok: inRange && !flashing,
    };
  }

  // -------------------------------------------------------------------------
  // CSV
  // -------------------------------------------------------------------------

  /** O CSV acumulado até agora, como texto. */
  buildCsv() {
    const lines = [CSV_HEADER.join(",")];
    for (const row of this.rows) lines.push(CSV_HEADER.map((key) => row[key]).join(","));
    return lines.join("\n");
  }

  /** Baixa o CSV pelo navegador (arquivo a3_<participante>_<instante>.csv). */
  downloadCsv() {
    const blob = new Blob([this.buildCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `a3_${this.hud.participant}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
