// O ambiente, uma casa 40 × 40 m e o beacon.
//
// Tudo que se pode percorrer fica num único THREE.Group (`world`): pisos, paredes,
// mobília, landmarks e a beacon. 
// 
// A miniatura (miniature.js) clona esse grupo, então qualquer coisa adicionada aqui aparece na miniatura de graça. 
// As luzes NÃO fazem parte de `world` (o main.js as põe na cena), para a clonagem nunca duplicá-las.
//
// Os DADOS ficam em house-plan.js (cômodos, paredes, janelas, mobília, landmarks);
// 
// O visual dos landmarks, em landmarks.js; tamanhos e cores, em constants.js; as
// texturas, em textures.js;
//
// A colisão, em collision.js. Este arquivo transforma esses dados em geometria.
//


import * as THREE from "three";
import {
  BASEBOARD_HEIGHT, BASE_FLOOR_COLOR, BEACON_BEAM_HEIGHT, BEACON_BEAM_OPACITY, BEACON_BEAM_RADIUS, BEACON_COLOR,
  BEACON_IN_RANGE_COLOR, BEACON_RING_WIDTH, BEACON_RING_Y, CAP_HEIGHT, DOOR_COLOR, DOOR_HEIGHT, DOOR_WIDTH, ENV_HALF,
  ENV_SIZE, EXTERIOR_THICKNESS, FLOOR_LIFT, FLOOR_STYLES, FRAME_COLOR, FRONT_DOOR_HEIGHT, FRONT_DOOR_WIDTH,
  FURNITURE_COLORS, INTERIOR_THICKNESS, JAMB_THICKNESS, MULLION_THICKNESS, OPENING_BORDER, OPENING_DEPTH, PLASTER_COLOR,
  SILL_HEIGHT, SKY_WINDOW_COLOR, START_PAD_COLOR, START_PAD_HEIGHT, START_PAD_RADIUS, START_PAD_Y, TRIM_COLOR, WALL_HEIGHT,
  WALL_TILE,
} from "./constants.js";
import { CollisionMap } from "./collision.js";
import { FRONT_DOOR, FURNITURE, LANDMARK_PLACEMENTS, PARTITIONS, ROOMS, WALL_FRAMES, WINDOWS } from "./house-plan.js";
import { LANDMARK_BUILDERS } from "./landmarks.js";
import {
  createCarpetTexture, createCheckerTexture, createGrassTexture, createPlasterTexture, createStoneTexture,
  createTileTexture, createWoodTexture,
} from "./textures.js";
import { GeometryBucket, boxAt, named } from "./utils.js";

// Detalhes de geometria dos acabamentos.
const CAP_OVERHANG = 0.2; // a capa de pedra sai da parede por 0,1 m de cada lado
const PARTITION_OVERLAP = 0.1; // paredes internas entram na externa, nunca em outra interna
const EXTERIOR_BASEBOARD_DEPTH = 0.04;
const INTERIOR_BASEBOARD_PROUD = 0.04; // o rodapé interno sai 2 cm de cada lado da parede
const DOOR_TRIM_PROUD = 0.08; // batente e verga saem 4 cm de cada lado da parede
const SILL_OVERHANG = 0.1;
const SILL_EXTRA_DEPTH = 0.08;
const MULLION_DEPTH = 0.06;
const GLASS_OFFSET = 0.01;
const DOOR_PANEL_THICKNESS = 0.08;
const DOOR_PANEL_OFFSET = 0.05;
const DOOR_KNOB_RADIUS = 0.06;
const DOOR_KNOB_HEIGHT = 1.1;

/**
 * A beacon: um feixe alto e translúcido sobre um anel no chão cujo raio é o raio de
 * confirmação. 
 * 
 * A miniatura tem uma CÓPIA dela (clone do mundo) que compartilha os
 * materiais, então recolorir aqui recolore lá, mas a posição e a visibilidade da
 * cópia são sincronizadas à mão pela Miniature.
 */
export class Beacon {
  /** @param {number} confirmRadius raio do anel, igual ao raio de confirmação */
  constructor(confirmRadius) {
    this.group = new THREE.Group();
    this.group.name = "beacon"; // a Miniature acha a cópia dela por este nome

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(BEACON_BEAM_RADIUS, BEACON_BEAM_RADIUS, BEACON_BEAM_HEIGHT, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: BEACON_COLOR, transparent: true, opacity: BEACON_BEAM_OPACITY,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = BEACON_BEAM_HEIGHT / 2;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(confirmRadius - BEACON_RING_WIDTH, confirmRadius, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: BEACON_COLOR, side: THREE.DoubleSide }),
    );
    ring.position.y = BEACON_RING_Y;

    this.group.add(beam, ring);
    this.materials = [beam.material, ring.material];
    this._inRange = false;
  }

  /** Posição da beacon no plano do chão. */
  setPosition(x, z) {
    this.group.position.set(x, 0, z);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  get visible() {
    return this.group.visible;
  }

  get position() {
    return this.group.position;
  }

  /** Verde dentro do raio de confirmação, magenta fora (só recolore se mudou). */
  setInRange(inRange) {
    if (inRange === this._inRange) return;
    this._inRange = inRange;
    for (const material of this.materials) material.color.setHex(inRange ? BEACON_IN_RANGE_COLOR : BEACON_COLOR);
  }
}

/**
 * O ambiente: monta `world` a partir da planta (house-plan.js) e responde às
 * perguntas de colisão. 
 * 
 * Paredes e móveis são sólidos só para o POUSO: um pulo nunca é bloqueado (mesma regra para as duas técnicas).
 */
export class Environment {
  /** @param {{confirmRadius: number}} opcoes */
  constructor({ confirmRadius }) {
    /** Grupo com identidade (uma posição local de `world` é uma posição da cena). */
    this.world = new THREE.Group();
    this.world.name = "world";
    this.collisions = new CollisionMap();

    // A ordem importa: é também a ordem em que os sólidos entram na colisão.
    this.floor = this._buildFloors();
    this.world.add(this._floorsGroup, this._buildWalls(), this._buildFurniture());
    this._buildLandmarks();

    this.beacon = new Beacon(confirmRadius);
    this.world.add(this.beacon.group);
  }

  /** Há um sólido a menos de `margin` metros de (x, z)? */
  isBlocked(x, z, margin = 0) {
    return this.collisions.isBlocked(x, z, margin);
  }

  /** O ponto livre mais próximo de (x, z). `ok` é falso se não achou nenhum. */
  resolveFree(x, z, margin = 0) {
    return this.collisions.resolveFree(x, z, margin);
  }

  // -------------------------------------------------------------------------
  // Pisos
  // -------------------------------------------------------------------------

  /** Constrói o piso-base, o piso de cada cômodo e o tapete de partida. Devolve a malha "floor". */
  _buildFloors() {
    const group = new THREE.Group();
    group.name = "floors";
    this._floorsGroup = group;

    // Piso-base sob tudo. Tem nome: a miniatura e as verificações o procuram.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ENV_SIZE, ENV_SIZE).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: BASE_FLOOR_COLOR }),
    );
    floor.name = "floor";
    group.add(floor);

    // O nogueira usa a mesma textura do carvalho, só que em tom escuro.
    const textures = {
      oak: createWoodTexture(),
      tile: createTileTexture(),
      checker: createCheckerTexture(),
      grass: createGrassTexture(),
      carpet: createCarpetTexture(),
    };
    textures.walnut = textures.oak;

    // polygonOffset: o piso do cômodo fica 1 cm acima do piso-base; sem isso os dois
    // brigariam pela profundidade ao longe.
    const materials = {};
    for (const [key, style] of Object.entries(FLOOR_STYLES)) {
      materials[key] = named(new THREE.MeshLambertMaterial({
        map: textures[key], color: style.color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }), `floor-${key}`);
    }

    const bucket = new GeometryBucket();
    for (const room of ROOMS) {
      const w = room.x1 - room.x0;
      const d = room.z1 - room.z0;
      const tile = FLOOR_STYLES[room.floor].tile;
      const geometry = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
      geometry.translate((room.x0 + room.x1) / 2, FLOOR_LIFT, (room.z0 + room.z1) / 2);
      bucket.add(materials[room.floor], geometry);
    }
    bucket.addTo(group);

    // Tapete redondo na origem: onde a primeira tentativa começa.
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(START_PAD_RADIUS, START_PAD_RADIUS, START_PAD_HEIGHT, 32),
      new THREE.MeshLambertMaterial({ color: START_PAD_COLOR }),
    );
    pad.name = "startPad";
    pad.position.y = START_PAD_Y;
    group.add(pad);

    return floor;
  }

  // -------------------------------------------------------------------------
  // Paredes, vãos de porta e janelas
  // -------------------------------------------------------------------------

  /** Geometria de moldura de janela ou porta no referencial local: x ao longo da parede, y para cima (centrado), +z para dentro da casa. */
  _openingFrame(w, h) {
    const frame = [];
    const add = (gw, gh, gd, x, y, z) => frame.push(new THREE.BoxGeometry(gw, gh, gd).translate(x, y, z));
    add(w + 2 * OPENING_BORDER, OPENING_BORDER, OPENING_DEPTH, 0, h / 2 + OPENING_BORDER / 2, OPENING_DEPTH / 2); // verga
    add( // peitoril
      w + 2 * OPENING_BORDER + SILL_OVERHANG, SILL_HEIGHT, OPENING_DEPTH + SILL_EXTRA_DEPTH,
      0, -h / 2 - SILL_HEIGHT / 2, (OPENING_DEPTH + SILL_EXTRA_DEPTH) / 2,
    );
    add(OPENING_BORDER, h, OPENING_DEPTH, -(w / 2 + OPENING_BORDER / 2), 0, OPENING_DEPTH / 2); // ombreiras
    add(OPENING_BORDER, h, OPENING_DEPTH, w / 2 + OPENING_BORDER / 2, 0, OPENING_DEPTH / 2);
    return frame;
  }

  /** Leva uma geometria do referencial local de uma abertura para a face interna da parede `wall`, em `along`, na altura `y`. */
  _placeOnWall(geometry, wall, along, y) {
    const { rot, fixed } = WALL_FRAMES[wall];
    const position = new THREE.Vector3(fixed[0] ?? along, y, fixed[1] ?? along);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).setPosition(position));
    return geometry;
  }

  /** Paredes externas e internas, vãos, janelas e a porta de entrada. Registra o sólido de cada trecho de parede interna. */
  _buildWalls() {
    const group = new THREE.Group();
    group.name = "walls";

    const plasterMat = named(new THREE.MeshLambertMaterial({ map: createPlasterTexture(), color: PLASTER_COLOR }), "plaster");
    const stoneMat = named(new THREE.MeshLambertMaterial({ map: createStoneTexture() }), "stone");
    const trimMat = named(new THREE.MeshLambertMaterial({ color: TRIM_COLOR }), "trim");
    const frameMat = named(new THREE.MeshLambertMaterial({ color: FRAME_COLOR }), "frames");
    const glassMat = named(new THREE.MeshBasicMaterial({ color: SKY_WINDOW_COLOR }), "glass");
    const doorMat = named(new THREE.MeshLambertMaterial({ color: DOOR_COLOR }), "door");
    const bucket = new GeometryBucket();
    const TE = EXTERIOR_THICKNESS;
    const TI = INTERIOR_THICKNESS;

    // Paredes externas ficam logo FORA do piso de 40 m: as faces internas estão em ±ENV_HALF.
    const exterior = (w, d, x, z) => {
      bucket.add(plasterMat, boxAt({ w, h: WALL_HEIGHT, d, x, z, tile: WALL_TILE }));
      bucket.add(stoneMat, boxAt({ w: w + CAP_OVERHANG, h: CAP_HEIGHT, d: d + CAP_OVERHANG, x, z, y: WALL_HEIGHT, tile: WALL_TILE }));
    };
    exterior(ENV_SIZE + 2 * TE, TE, 0, -(ENV_HALF + TE / 2));
    exterior(ENV_SIZE + 2 * TE, TE, 0, ENV_HALF + TE / 2);
    exterior(TE, ENV_SIZE, -(ENV_HALF + TE / 2), 0);
    exterior(TE, ENV_SIZE, ENV_HALF + TE / 2, 0);
    // Rodapés nas faces internas das paredes externas.
    const edge = EXTERIOR_BASEBOARD_DEPTH / 2;
    bucket.add(trimMat, boxAt({ w: ENV_SIZE, h: BASEBOARD_HEIGHT, d: EXTERIOR_BASEBOARD_DEPTH, z: -(ENV_HALF - edge) }));
    bucket.add(trimMat, boxAt({ w: ENV_SIZE, h: BASEBOARD_HEIGHT, d: EXTERIOR_BASEBOARD_DEPTH, z: ENV_HALF - edge }));
    bucket.add(trimMat, boxAt({ w: EXTERIOR_BASEBOARD_DEPTH, h: BASEBOARD_HEIGHT, d: ENV_SIZE, x: -(ENV_HALF - edge) }));
    bucket.add(trimMat, boxAt({ w: EXTERIOR_BASEBOARD_DEPTH, h: BASEBOARD_HEIGHT, d: ENV_SIZE, x: ENV_HALF - edge }));

    // Paredes internas, partidas em volta dos vãos de porta.
    for (const p of PARTITIONS) {
      const horizontal = p.axis === "x";
      // Só entra na parede externa, nunca em outra interna (isso poria duas faces
      // coplanares uma sobre a outra).
      const from = p.from <= -ENV_HALF ? p.from - PARTITION_OVERLAP : p.from;
      const to = p.to >= ENV_HALF ? p.to + PARTITION_OVERLAP : p.to;
      const centers = [...p.doors].sort((a, b) => a - b);

      // Trechos de parede entre os vãos: [início, fim] ao longo do eixo da parede.
      let cursor = from;
      const pieces = [];
      for (const c of centers) {
        pieces.push([cursor, c - DOOR_WIDTH / 2]);
        cursor = c + DOOR_WIDTH / 2;
      }
      pieces.push([cursor, to]);

      // Caixa de comprimento `len` centrada em `mid` ao longo do eixo da parede.
      const dims = (len, mid, thickness) => (horizontal
        ? { w: len, d: thickness, x: mid, z: p.at }
        : { w: thickness, d: len, x: p.at, z: mid });

      for (const [a, b] of pieces) {
        const len = b - a;
        if (len < 0.01) continue;
        const mid = (a + b) / 2;
        const body = dims(len, mid, TI);
        bucket.add(plasterMat, boxAt({ ...body, h: WALL_HEIGHT, tile: WALL_TILE }));
        bucket.add(trimMat, boxAt({ ...dims(len, mid, TI + INTERIOR_BASEBOARD_PROUD), h: BASEBOARD_HEIGHT }));
        this.collisions.addRect(body.x, body.z, body.w, body.d);
      }

      for (const c of centers) {
        // Verga sobre o vão, e batentes e cabeceira de madeira que arrematam a abertura.
        bucket.add(plasterMat, boxAt({ ...dims(DOOR_WIDTH, c, TI), h: WALL_HEIGHT - DOOR_HEIGHT, y: DOOR_HEIGHT, tile: WALL_TILE }));
        for (const side of [-1, 1]) {
          bucket.add(trimMat, boxAt({
            ...dims(JAMB_THICKNESS, c + side * (DOOR_WIDTH / 2 - JAMB_THICKNESS / 2), TI + DOOR_TRIM_PROUD), h: DOOR_HEIGHT,
          }));
        }
        bucket.add(trimMat, boxAt({
          ...dims(DOOR_WIDTH, c, TI + DOOR_TRIM_PROUD), h: JAMB_THICKNESS, y: DOOR_HEIGHT - JAMB_THICKNESS,
        }));
      }
    }

    // Janelas: moldura, travessas em cruz e um vidro da cor do céu.
    const glassBucket = new GeometryBucket();
    for (const win of WINDOWS) {
      for (const g of this._openingFrame(win.w, win.h)) {
        bucket.add(frameMat, this._placeOnWall(g, win.wall, win.along, win.y));
      }
      for (const g of [
        new THREE.BoxGeometry(MULLION_THICKNESS, win.h, MULLION_DEPTH).translate(0, 0, MULLION_DEPTH),
        new THREE.BoxGeometry(win.w, MULLION_THICKNESS, MULLION_DEPTH).translate(0, 0, MULLION_DEPTH),
      ]) bucket.add(frameMat, this._placeOnWall(g, win.wall, win.along, win.y));
      glassBucket.add(glassMat, this._placeOnWall(
        new THREE.PlaneGeometry(win.w, win.h).translate(0, 0, GLASS_OFFSET), win.wall, win.along, win.y,
      ));
    }

    // Porta de entrada na parede leste, dando para o salão.
    const doorY = FRONT_DOOR_HEIGHT / 2;
    for (const g of this._openingFrame(FRONT_DOOR_WIDTH, FRONT_DOOR_HEIGHT)) {
      bucket.add(frameMat, this._placeOnWall(g, FRONT_DOOR.wall, FRONT_DOOR.along, doorY));
    }
    bucket.add(doorMat, this._placeOnWall(
      new THREE.BoxGeometry(FRONT_DOOR_WIDTH, FRONT_DOOR_HEIGHT, DOOR_PANEL_THICKNESS).translate(0, 0, DOOR_PANEL_OFFSET),
      FRONT_DOOR.wall, FRONT_DOOR.along, doorY,
    ));
    bucket.add(frameMat, this._placeOnWall(
      new THREE.SphereGeometry(DOOR_KNOB_RADIUS, 8, 6).translate(FRONT_DOOR_WIDTH / 2 - 0.2, 0, 0.12),
      FRONT_DOOR.wall, FRONT_DOOR.along, DOOR_KNOB_HEIGHT,
    ));

    bucket.addTo(group);
    glassBucket.addTo(group);
    return group;
  }

  // -------------------------------------------------------------------------
  // Mobília neutra e landmarks
  // -------------------------------------------------------------------------

  /** Mobília da planta (FURNITURE): uma caixa por item, mescladas por material. */
  _buildFurniture() {
    const group = new THREE.Group();
    group.name = "furniture";

    const materials = {};
    for (const [key, color] of Object.entries(FURNITURE_COLORS)) {
      materials[key] = named(new THREE.MeshLambertMaterial({ color }), key);
    }
    const bucket = new GeometryBucket();

    for (const item of FURNITURE) {
      if (!item.colliderOnly) {
        bucket.add(materials[item.material], boxAt({ w: item.w, h: item.h, d: item.d, x: item.x, z: item.z, y: item.y ?? 0 }));
      }
      // Peças de um conjunto (solid: false) não têm sólido próprio; o conjunto tem um só.
      if (item.colliderOnly || item.solid !== false) this.collisions.addRect(item.x, item.z, item.w, item.d);
    }

    bucket.addTo(group);
    return group;
  }

  /** Os cinco landmarks: posiciona cada um e registra seus sólidos. */
  _buildLandmarks() {
    for (const placement of LANDMARK_PLACEMENTS) {
      const landmark = LANDMARK_BUILDERS[placement.id]();
      landmark.name = placement.id;
      landmark.position.set(placement.x, 0, placement.z);
      landmark.rotation.y = placement.rotationY ?? 0;
      this.world.add(landmark);
      for (const c of placement.colliders) this.collisions.addFromLocal(placement, c);
    }
  }
}
