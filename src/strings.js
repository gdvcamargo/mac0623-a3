// Todos os textos que aparecem na tela, em português.
//
import { formatNumber } from "./utils.js";

/** Nome de cada técnica, indexado pelo id gravado no CSV (1 = WIM, 2 = teleporte). */
export const TECHNIQUE_NAMES = { 1: "WIM", 2: "Teleporte em arco" };

const n = formatNumber;
const pluralPulos = (quantidade) => (quantidade === 1 ? "pulo" : "pulos");

export const TEXTOS = {
  // ---- Barra da página (experimentador) ----
  orderHint: (primeira, segunda) => `Plano ABBA: ${primeira} → ${segunda}`,
  /** Rótulo da tentativa atual: "WIM · tentativa 1/2". */
  trialLabel: (nome, numero, total) => `${nome} · tentativa ${numero}/${total}`,
  practiceLabel: (nome) => `${nome} · treino`,
  techniqueDone: (nome) => `${nome} concluído`,
  notLogged: "(não registrado)",

  statusActive: (distancia, raio, pulos, andou, pulou) =>
    `dist ${n(distancia, 1)} m (raio ${n(raio)}) | pulos ${pulos} | andou ${n(andou, 1)} m, pulou ${n(pulou, 1)} m`,
  statusResult: "Resultado na tela — confirme para o próximo passo",
  statusBetween: (proxima) => `Próxima: ${proxima} — confirme para começar`,
  statusDone: "Sessão concluída — baixe o CSV",

  /** Última tentativa, mostrada na barra da página (com pulos nas duas técnicas). */
  lastResult: (r) =>
    `Última: ${r.label}${r.practice ? " " + TEXTOS.notLogged : ""} — ${n(r.time)} s · ` +
    `caminho ${n(r.path)} m · linha reta ${n(r.straight)} m · razão ${n(r.ratio)} · ` +
    `${r.moves} ${pluralPulos(r.moves)}`,

  // ---- HUD de dentro da headset ----
  hudHint: "Vá até a beacon magenta",
  hudInRange: "No alvo — gatilho ESQUERDO para confirmar",
  tooFar: (distancia) => `Longe demais (${n(distancia, 1)} m)`,
  cannotLand: "Não dá para pousar aqui",

  hudBlockTitle: "Bloco concluído",
  hudBlockNext: (proxima) => `Próxima: ${proxima} — gatilho ESQUERDO`,
  hudDoneTitle: "Tudo pronto",
  hudDoneSubtitle: "Obrigado — tire o headset",

  // Painel de resultado. Rótulos curtos para caber nos 512 px do painel; os valores
  // correspondem às colunas do CSV (completion_time_s, path_length,
  // straight_line_distance, path_ratio, n_moves).
  resultLabels: { time: "Tempo", path: "Caminho", straight: "Linha reta", ratio: "Razão", jumps: "Pulos" },
  resultTime: (segundos) => `${n(segundos)} s`,
  resultMeters: (metros) => `${n(metros)} m`,
  resultRatio: (razao) => n(razao),
  resultNext: "Gatilho ESQUERDO: próxima tentativa",
  resultContinue: "Gatilho ESQUERDO: continuar",
};
