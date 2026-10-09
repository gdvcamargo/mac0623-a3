// Parâmetros de ajuste (tamanhos, cores, tolerâncias, tempos).
//
// Convenção de eixos: x = leste, y = para cima, z = sul; a frente da pessoa é -z.
// Todas as distâncias estão em metros, salvo indicação.

// ---------------------------------------------------------------------------
// Casa
// ---------------------------------------------------------------------------

export const ENV_SIZE = 40; // lado da casa, centrada na origem
export const ENV_HALF = ENV_SIZE / 2;

// Paredes
export const WALL_HEIGHT = 3;
export const EXTERIOR_THICKNESS = 0.4;
export const INTERIOR_THICKNESS = 0.2;
export const CAP_HEIGHT = 0.15; // capa de pedra no topo das paredes externas
export const BASEBOARD_HEIGHT = 0.12; // rodapé
export const WALL_TILE = 2; // metros de parede cobertos por um ladrilho de textura

// Portas e janelas
export const DOOR_WIDTH = 1.4; // vãos entre cômodos
export const DOOR_HEIGHT = 2.2;
export const FRONT_DOOR_WIDTH = 2;
export const FRONT_DOOR_HEIGHT = 2.3;
export const OPENING_DEPTH = 0.12; // quanto o batente sai da parede
export const OPENING_BORDER = 0.1; // largura do batente/moldura
export const SILL_HEIGHT = 0.08; // peitoril
export const JAMB_THICKNESS = 0.08; // batente dos vãos internos
export const MULLION_THICKNESS = 0.05; // travessas da janela

// Pisos
export const FLOOR_LIFT = 0.01; // os pisos dos cômodos ficam acima do piso-base por isso
export const BASE_FLOOR_COLOR = 0x8c887d;
export const START_PAD_COLOR = 0xe8e6df; // tapete redondo no ponto de partida
export const START_PAD_RADIUS = 2.5;
export const START_PAD_HEIGHT = 0.06;
export const START_PAD_Y = 0.04;
// Cor (multiplicada pela textura) e metros por ladrilho de cada tipo de piso.
export const FLOOR_STYLES = {
  oak: { color: 0xffe9cc, tile: 2 },
  walnut: { color: 0x8f6a4a, tile: 2 }, // mesma textura do carvalho, em tom escuro
  tile: { color: 0xcfe3ea, tile: 2 },
  checker: { color: 0xffffff, tile: 2 },
  grass: { color: 0xffffff, tile: 4 },
  carpet: { color: 0xb9c3d4, tile: 2 },
};

// Cores de paredes e acabamentos
export const PLASTER_COLOR = 0xf3efe6;
export const TRIM_COLOR = 0x4a3626; // rodapé e batentes
export const FRAME_COLOR = 0xf4f4f0; // molduras das janelas
export const DOOR_COLOR = 0x6b4a2f; // porta de entrada
export const SKY_WINDOW_COLOR = 0x86b3d6; // as janelas "olham" para o céu: fora da casa não há nada

// Mobília neutra (as cores saturadas são reservadas aos landmarks)
export const FURNITURE_COLORS = {
  fabric: 0x6f7378,
  oak: 0xc9a574,
  walnut: 0x5b4636,
  white: 0xf2f0ea,
  counter: 0x3b3d40,
};

// Landmarks: cinco peças saturadas que identificam os cômodos
export const LANDMARK_COLORS = {
  chimney: 0xd62828,
  hearth: 0x8a8780,
  firebox: 0x1b1b1b,
  arch: 0x1f5fbf,
  islandBody: 0xf2c230,
  islandTop: 0x3b3d40,
  trunk: 0x6b4a2f,
  crown: 0x2e9e4f,
  tableTop: 0xf28c28,
  tableBase: 0xb85f10,
  chair: 0x5b4636,
};

// Beacon: um feixe alto e translúcido (visível acima das paredes) sobre um anel no
// chão cujo raio é o raio de confirmação.
export const BEACON_COLOR = 0xff2bd6;
export const BEACON_IN_RANGE_COLOR = 0x2bff6a; // cor dentro do raio de confirmação
export const BEACON_BEAM_HEIGHT = 18;
export const BEACON_BEAM_RADIUS = 0.5;
export const BEACON_BEAM_OPACITY = 0.55;
export const BEACON_RING_WIDTH = 0.18;
export const BEACON_RING_Y = 0.1;

// Texturas procedurais
export const TEXTURE_SIZE = 256; // pixels de lado de cada ladrilho
export const TEXTURE_ANISOTROPY = 4;

// ---------------------------------------------------------------------------
// Cena e câmera
// ---------------------------------------------------------------------------

export const SKY_COLOR = 0x9ec7e8;
export const HEMISPHERE_SKY_COLOR = 0xffffff;
// Reflexo claro do chão: com um escuro as faces verticais (todas as paredes) ficam cinza.
export const HEMISPHERE_GROUND_COLOR = 0xb5ad9f;
export const HEMISPHERE_LIGHT_INTENSITY = 1.7;
export const DIRECTIONAL_LIGHT_INTENSITY = 0.9;
export const DIRECTIONAL_LIGHT_POSITION = [20, 40, 15];

export const CAMERA_FOV_DEG = 60;
export const CAMERA_NEAR = 0.05;
export const CAMERA_FAR = 300;
export const DESKTOP_EYE_HEIGHT = 1.6;

// ---------------------------------------------------------------------------
// Tarefa (beacon, confirmação, caminho)
// ---------------------------------------------------------------------------

// Ids das técnicas: são os valores gravados na coluna `technique` do CSV.
export const TECHNIQUE = { WIM: 1, TELEPORT: 2 };
export const TRIALS_PER_TECHNIQUE = 2;

// Raio de confirmação: 1,25 m, o meio da faixa sugerida de 0,75–1,5 m. Na miniatura,
// 1 cm de movimento da mão vale 1,14 m de mundo, e 1° de inclinação do controlador
// desloca o pouso do teleporte em ≈ 1 m a 20 m; um raio bem menor mediria o tremor
// da mão, não a navegação.
export const CONFIRM_RADIUS = 1.25;

// A beacon surge a 14–30 m da cabeça: muito além do alcance do braço e dos poucos
// passos que uma área de rastreamento permite, então exige a técnica.
export const BEACON_MIN_DISTANCE = 14;
export const BEACON_MAX_DISTANCE = 30;
export const BEACON_EDGE_MARGIN = 3; // distância mínima das paredes externas
// Distância mínima de qualquer parede ou móvel, para o anel de confirmação
// (raio 1,25 m) nunca ficar enterrado em um deles.
export const BEACON_CLEARANCE = 1.5;

// O ponto de vista não pode ser levado mais perto que isso das paredes externas.
export const PLAYABLE_MARGIN = 1.5;
// Raio do corpo no pouso: um pulo nunca coloca a cabeça mais perto que isso de
// uma parede ou de um móvel.
export const PLAYER_RADIUS = 0.3;

// A caminhada física é acumulada em passos de pelo menos este tamanho, para o
// balanço da cabeça parado não inflar o path_length. Mesma regra nas duas técnicas.
export const PATH_MIN_STEP = 0.05;

// Contrabalanceamento ABBA entre participantes: A = técnica 1 (WIM), B = técnica 2.
export const ABBA = [TECHNIQUE.WIM, TECHNIQUE.TELEPORT, TECHNIQUE.TELEPORT, TECHNIQUE.WIM];

export const FLASH_MS = 1600; // duração das mensagens rápidas ("Longe demais...")
// A tela de resultado / de bloco ignora o botão de confirmar por este tempo depois
// de aparecer, para um clique duplo não pulá-la antes de dar para ler.
export const ACK_MIN_MS = 800;

// ---------------------------------------------------------------------------
// Técnica 1 — World-in-Miniature
// ---------------------------------------------------------------------------

// Miniatura de 35 cm da casa de 40 m: escala 0,35 / 40 ≈ 0,00875. Ela é north-up
// (ver Miniature.updatePose): mantém a orientação do mundo, não importa como a
// mão ou o corpo girem.
export const WIM_SIZE = 0.35;
export const WIM_SCALE = WIM_SIZE / ENV_SIZE;
export const WIM_HEIGHT = 0.12; // a origem da miniatura fica tanto acima do grip, na vertical do mundo

// Boneco "você está aqui"
export const MARKER_HEIGHT = 0.04; // o boneco tem ~4 cm de altura na mão
export const MARKER_BODY_HEIGHT = 0.026;
export const MARKER_BODY_RADIUS = 0.0125;
export const MARKER_HEAD_RADIUS = 0.0085;
export const MARKER_COLOR = 0x00d8ff;
export const MARKER_NOSE_COLOR = 0xffffff; // o nariz aponta para onde a cabeça olha
export const MARKER_NOSE_LENGTH = 0.017;
export const MARKER_GHOST_OPACITY = 0.3;
export const MARKER_EMISSIVE_INTENSITY = 0.35;
export const MARKER_TOUCH_RADIUS = 0.08; // controlador a menos de 8 cm do boneco o agarra
export const MARKER_PICK_RADIUS = 0.05; // esfera invisível que o raio pode acertar (5 cm)

// Raio branco que sai do controlador direito: o único desenho de controle, como no A2
// (que não tinha modelo 3D). Fica visível durante o WIM e escondido no teleporte
// (onde, parado, não se desenha nada; ao mirar, aparece o arco).
export const RAY_LENGTH = 1.5; // o mesmo comprimento do A2 (RAY_LENGTH_SCALE = 1.5)
export const RAY_COLOR = 0xffffff;

// ---------------------------------------------------------------------------
// Técnica 2 — teleporte em arco (design_technique2.md)
// ---------------------------------------------------------------------------

export const TELEPORT_SPEED = 20; // m/s de lançamento: alcance máximo ≈ 42 m, cobre a casa
export const TELEPORT_GRAVITY = 9.8;
export const ARC_STEPS = 48; // segmentos usados para desenhar o arco
export const ARC_VALID_COLOR = 0x00e5ff;
export const ARC_INVALID_COLOR = 0xff3b30;
export const LANDING_RING_INNER = 0.35;
export const LANDING_RING_OUTER = 0.5;
export const LANDING_RING_LIFT = 0.05; // o anel flutua um pouco acima do chão

// ---------------------------------------------------------------------------
// HUD preso à cabeça (só aparece dentro de uma sessão XR)
// ---------------------------------------------------------------------------

// Um canvas, duas posições: um painel pequeno no canto superior direito para as
// dicas de estado e um maior no meio da visão para o resultado da tentativa. Os dois
// são ancorados pela borda de cima, então o painel cresce para baixo a partir dela.
export const WORLD_HUD_CANVAS_WIDTH = 512;
export const WORLD_HUD_CANVAS_HEIGHT = 384;
export const WORLD_HUD_CORNER = { scale: [0.24, 0.18, 1], position: [0.3, 0.23, -0.6] };
export const WORLD_HUD_CENTER = { scale: [0.46, 0.345, 1], position: [0, 0.14, -0.7] };

// Layout do painel dentro do canvas (pixels)
export const HUD_TITLE_Y = 16;
export const HUD_ROW_TOP = 72;
export const HUD_ROW_STEP = 46;
export const HUD_PADDING_X = 16;
export const HUD_ROW_PADDING_X = 24;
export const HUD_SUBTITLE_GAP = 10; // espaço entre a última linha e a dica final
export const HUD_SUBTITLE_Y_NO_ROWS = 70;
export const HUD_BOTTOM_PADDING = 18;
export const HUD_FONT_FAMILY = "system-ui, sans-serif";
export const HUD_TITLE_PX = 38;
export const HUD_ROW_PX = 34;
export const HUD_SUBTITLE_PX = 30;
// Textos mais largos que o painel encolhem a fonte até caber, mas não abaixo disto.
export const HUD_MIN_FONT_PX = 20;
export const HUD_SUBTITLE_HEIGHT = 30;
export const HUD_OK_BACKGROUND = "rgba(30,70,40,0.88)";
export const HUD_NORMAL_BACKGROUND = "rgba(20,20,26,0.88)";
export const HUD_OK_TEXT = "#9f9";
export const HUD_NORMAL_TEXT = "#eee";
export const HUD_ROW_LABEL_TEXT = "#cfd8cf";
export const HUD_ROW_VALUE_TEXT = "#ffffff";

// ---------------------------------------------------------------------------
// Modo desktop
// ---------------------------------------------------------------------------

// Posição, no referencial da câmera, da mão esquerda virtual, que segura a
// miniatura. Baixa e longe o bastante para a miniatura (nivelada, north-up) ser
// vista de ~30° acima, e não de lado, com a placa de 35 cm inteira na tela.
export const DESKTOP_LEFT_HAND_POSITION = [-0.15, -0.5, -0.9];
export const DESKTOP_LOOK_SPEED = 0.004; // radianos por pixel de arrasto com o botão direito
export const DESKTOP_KEY_LOOK_SPEED = Math.PI / 2; // radianos por segundo com as setas
export const DESKTOP_MAX_PITCH = 1.4; // limite de olhar para cima/baixo, em radianos
