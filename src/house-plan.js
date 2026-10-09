// Planta da casa.
//
// Casa de 40 × 40 m, sem teto (x = leste, z = sul, metros; o ponto de partida é 0,0):
//
//   z=-20 ┌─────────────┬──────────┬────────────────┐
//         │   quarto    │ banheiro │    cozinha     │
//   z= -8 ├────┬────────┴───┬──────┴─────┬──────────┤
//         │ chaminé      salão (início)      arco   │  porta de entrada na parede leste
//   z=  6 ├───────┬─────────┴─┬───────────┬────────┤
//         │ pátio │ escritório│ sala de jantar     │
//   z= 20 └───────┴───────────┴────────────────────┘
//        x=-20   -4          8                    20
//
import { ENV_HALF } from "./constants.js";

/**
 * Cômodos e o tipo de piso de cada um (chaves de FLOOR_STYLES em constants.js).
 * [x0, x1] × [z0, z1] é o retângulo do cômodo.
 */
export const ROOMS = [
  { name: "bedroom", x0: -20, x1: -6, z0: -20, z1: -8, floor: "oak" },
  { name: "bathroom", x0: -6, x1: 4, z0: -20, z1: -8, floor: "tile" },
  { name: "kitchen", x0: 4, x1: 20, z0: -20, z1: -8, floor: "checker" },
  { name: "hall", x0: -20, x1: 20, z0: -8, z1: 6, floor: "walnut" },
  { name: "courtyard", x0: -20, x1: -4, z0: 6, z1: 20, floor: "grass" },
  { name: "study", x0: -4, x1: 8, z0: 6, z1: 20, floor: "oak" },
  { name: "dining", x0: 8, x1: 20, z0: 6, z1: 20, floor: "carpet" },
];

/**
 * Paredes internas. axis "x": a parede corre ao longo de x, em z = `at`;
 * axis "z": corre ao longo de z, em x = `at`. `doors` são os centros dos vãos de
 * porta ao longo da parede. Os vãos ficam fora dos eixos de simetria dos cômodos
 * para que dois cômodos nunca pareçam iguais vistos da porta.
 */
export const PARTITIONS = [
  { axis: "x", at: -8, from: -20, to: 20, doors: [-13, 0, 12] },
  { axis: "x", at: 6, from: -20, to: 20, doors: [-12, 2, 13] },
  { axis: "z", at: -6, from: -20, to: -8, doors: [-14] },
  { axis: "z", at: 4, from: -20, to: -8, doors: [-11] },
  { axis: "z", at: -4, from: 6, to: 20, doors: [13] },
  { axis: "z", at: 8, from: 6, to: 20, doors: [11] },
];

/**
 * Janelas nas faces internas das paredes externas. `along` é x nas paredes
 * norte/sul e z nas leste/oeste; `y` é a altura do centro da janela.
 */
export const WINDOWS = [
  { wall: "north", along: -8, w: 1.8, h: 1.3, y: 1.65 }, // quarto
  { wall: "north", along: -1, w: 1.0, h: 0.8, y: 2.0 }, // banheiro
  { wall: "north", along: 9, w: 1.8, h: 1.3, y: 1.8 }, // cozinha
  { wall: "north", along: 15, w: 1.8, h: 1.3, y: 1.8 },
  { wall: "east", along: -14, w: 1.8, h: 1.3, y: 1.65 }, // cozinha
  { wall: "east", along: -3, w: 1.8, h: 1.3, y: 1.65 }, // salão
  { wall: "east", along: 13, w: 1.8, h: 1.3, y: 1.65 }, // sala de jantar
  { wall: "south", along: 6.5, w: 1.8, h: 1.3, y: 1.65 }, // escritório
  { wall: "south", along: 14, w: 1.8, h: 1.3, y: 1.65 }, // sala de jantar
  { wall: "west", along: -14, w: 1.8, h: 1.3, y: 1.65 }, // quarto
  { wall: "west", along: -5, w: 1.8, h: 1.3, y: 1.65 }, // salão
  { wall: "west", along: 4, w: 1.8, h: 1.3, y: 1.65 }, // salão
];

/** Porta de entrada, na parede leste, dando para o salão. */
export const FRONT_DOOR = { wall: "east", along: 3 };

/**
 * Como cada parede externa é posicionada: a rotação em torno de Y (de modo que o
 * eixo local +z aponte PARA DENTRO da casa) e a coordenada que fica fixa na face
 * interna da parede ([x, z]; null = varia com `along`).
 */
export const WALL_FRAMES = {
  north: { rot: 0, fixed: [null, -ENV_HALF] },
  south: { rot: Math.PI, fixed: [null, ENV_HALF] },
  west: { rot: Math.PI / 2, fixed: [-ENV_HALF, null] },
  east: { rot: -Math.PI / 2, fixed: [ENV_HALF, null] },
};

/**
 * Onde fica cada landmark (o visual está em landmarks.js, com o mesmo `id`).
 * `colliders` estão no referencial LOCAL do landmark, em metros: retângulos
 * {x, z, w, d} ou círculos {circle: true, x, z, r}.
 */
export const LANDMARK_PLACEMENTS = [
  {
    id: "redChimney", x: -19, z: 0, // encostada na parede oeste do salão
    colliders: [{ x: 0, z: 0, w: 1.8, d: 1.8 }, { x: 1.4, z: 0, w: 1.0, d: 2.8 }],
  },
  {
    id: "blueArch", x: 14, z: 0, rotationY: Math.PI / 2, // um portal atravessando o salão
    colliders: [{ circle: true, x: -4, z: 0, r: 1.0 }, { circle: true, x: 4, z: 0, r: 1.0 }],
  },
  {
    id: "yellowIsland", x: 12, z: -14, // ilha da cozinha
    colliders: [{ x: 0, z: 0, w: 7.3, d: 2.7 }],
  },
  {
    id: "greenTree", x: -12, z: 13, // o pinheiro do pátio a céu aberto
    // A copa tem 3,1 m de largura na altura da cabeça, então o sólido cobre a saia.
    colliders: [{ circle: true, x: 0, z: 0, r: 3.1 }],
  },
  {
    id: "orangeTable", x: 14, z: 13, // mesa redonda da sala de jantar
    colliders: [{ circle: true, x: 0, z: 0, r: 2.6 }],
  },
];

/**
 * Mobília neutra (sem cores saturadas: elas são reservadas aos landmarks), em
 * ordem. 
 * 
 * Cada caixa: `material` (chave de FURNITURE_COLORS), largura `w` (eixo x),
 * profundidade `d` (eixo z), altura `h`, centro (x, z) e base `y` (padrão 0).
 * `solid: false` marca peças que fazem parte de um conjunto e não têm sólido
 * próprio. `{ colliderOnly: true, x, z, w, d }` adiciona só um sólido (para o
 * conjunto inteiro: sofá, mesa de trabalho).
 */
export const FURNITURE = [
  // Salão: sofá encostado na parede sul e mesa de centro na frente dele.
  { material: "fabric", w: 6, d: 2.2, h: 0.45, x: -7, z: 4.6, solid: false },
  { material: "fabric", w: 6, d: 0.6, h: 0.95, x: -7, z: 5.6, solid: false },
  { material: "fabric", w: 0.4, d: 2.2, h: 0.65, x: -10.2, z: 4.6, solid: false },
  { material: "fabric", w: 0.4, d: 2.2, h: 0.65, x: -3.8, z: 4.6, solid: false },
  { colliderOnly: true, x: -7, z: 4.7, w: 6.8, d: 2.5 },
  { material: "oak", w: 2, d: 1.1, h: 0.4, x: -7, z: 1.6 },

  // Quarto: cama com cabeceira na parede norte, guarda-roupa.
  { material: "walnut", w: 4.2, d: 5.6, h: 0.45, x: -12.5, z: -16.9 },
  { material: "white", w: 3.9, d: 5.2, h: 0.25, x: -12.5, z: -16.9, y: 0.45, solid: false },
  { material: "white", w: 1.4, d: 0.7, h: 0.2, x: -13.5, z: -19.2, y: 0.7, solid: false },
  { material: "white", w: 1.4, d: 0.7, h: 0.2, x: -11.5, z: -19.2, y: 0.7, solid: false },
  { material: "walnut", w: 4.4, d: 0.2, h: 1.3, x: -12.5, z: -19.9, solid: false },
  { material: "walnut", w: 4, d: 0.9, h: 2.4, x: -17.8, z: -19.5 },

  // Banheiro: banheira e pia.
  { material: "white", w: 1.8, d: 0.85, h: 0.6, x: -3.3, z: -19.5 },
  { material: "white", w: 1.4, d: 0.55, h: 0.9, x: 1.8, z: -19.7 },
  { material: "counter", w: 1.5, d: 0.6, h: 0.05, x: 1.8, z: -19.7, y: 0.9, solid: false },

  // Cozinha: armários baixos ao longo da parede norte e geladeira.
  { material: "white", w: 12, d: 0.65, h: 0.9, x: 13, z: -19.65 },
  { material: "counter", w: 12.1, d: 0.7, h: 0.05, x: 13, z: -19.65, y: 0.9, solid: false },
  { material: "white", w: 1, d: 0.9, h: 2, x: 5.5, z: -19.5 },

  // Escritório: mesa de trabalho e estante encostada na parede sul.
  { material: "oak", w: 3, d: 1.2, h: 0.06, x: 2, z: 17, y: 0.69, solid: false },
  { material: "oak", w: 0.08, d: 1.1, h: 0.69, x: 0.6, z: 17, solid: false },
  { material: "oak", w: 0.08, d: 1.1, h: 0.69, x: 3.4, z: 17, solid: false },
  { colliderOnly: true, x: 2, z: 17, w: 3, d: 1.2 },
  { material: "walnut", w: 6, d: 0.5, h: 2.4, x: 2, z: 19.7 },
];
