// MAC0623 — A3: utilidades usadas por vários arquivos.
//
// Aqui ficam só coisas pequenas e sem estado, compartilhadas por mais de um
// módulo: gerador pseudoaleatório, ajudantes de geometria e material, o raio a
// partir de um controlador e formatação de números. Nada daqui conhece a tarefa.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Vertical do mundo: usada para manter a miniatura nivelada e o boneco em pé. */
export const WORLD_UP = new THREE.Vector3(0, 1, 0);
/** Frente de um objeto no referencial local do three.js (o eixo -z). */
export const FORWARD = new THREE.Vector3(0, 0, -1);

/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * As texturas procedurais usam uma semente fixa para sempre saírem iguais.
 * @param {number} seed
 * @returns {() => number} função que devolve um número em [0, 1) a cada chamada
 */
export function rng(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dá um nome ao material e o devolve (o nome vira o da malha mesclada). */
export function named(material, name) {
  material.name = name;
  return material;
}

/**
 * Material padrão dos landmarks: opaco, visível dos dois lados. É Lambert (só luz
 * difusa): mais barato por pixel que o material PBR (Standard), e a diferença visual é
 * pequena porque nada aqui é brilhante.
 */
export function solidMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
}

/**
 * Caixa alinhada aos eixos, apoiada na altura `y` (base) e centrada em (x, z).
 *
 * Com `tile`, os UVs são escalados para um ladrilho de textura cobrir `tile`
 * metros em todas as faces: a densidade de texels é a mesma na face longa, na de
 * ponta e na de cima, então uma textura compartilhada serve para paredes de
 * qualquer tamanho.
 *
 * @param {{w:number, h:number, d:number, x?:number, z?:number, y?:number, tile?:number}} caixa
 * @returns {THREE.BoxGeometry}
 */
export function boxAt({ w, h, d, x = 0, z = 0, y = 0, tile = 0 }) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (tile) {
    // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z, quatro vértices cada.
    const faceSize = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = geometry.attributes.uv;
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 4; i++) {
        const k = face * 4 + i;
        uv.setXY(k, (uv.getX(k) * faceSize[face][0]) / tile, (uv.getY(k) * faceSize[face][1]) / tile);
      }
    }
  }
  geometry.translate(x, y + h / 2, z);
  return geometry;
}

/**
 * Junta geometrias por material e as mescla: algumas chamadas de desenho em vez
 * de centenas. É o que mantém a casa (e a miniatura, que a clona) barata.
 */
export class GeometryBucket {
  constructor() {
    this.byMaterial = new Map();
  }

  /** Guarda uma geometria para ser mesclada com as outras do mesmo material. */
  add(material, geometry) {
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(geometry);
  }

  /** Cria uma malha mesclada por material e a adiciona ao grupo. */
  addTo(group) {
    for (const [material, geometries] of this.byMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.name = material.name || "merged";
      group.add(mesh);
    }
  }
}

/**
 * Raio que sai da origem do controlador ao longo do seu eixo local -z, testado
 * contra `objects` (sem descer nos filhos).
 * @param {THREE.Object3D} controller
 * @param {THREE.Object3D[]} objects
 * @returns {THREE.Intersection[]}
 */
export function getIntersections(controller, objects) {
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  return raycaster.intersectObjects(objects, false);
}

/**
 * Ângulo em torno de Y que leva a frente (-z) à direção dada (só o plano xz).
 * É o "heading": com ele o boneco aponta para onde a cabeça olha.
 * @param {THREE.Vector3} direction
 */
export function headingYaw(direction) {
  return Math.atan2(-direction.x, -direction.z);
}

/**
 * Número formatado para a tela, com vírgula decimal (padrão brasileiro).
 * O CSV continua usando ponto.
 * @param {number} value
 * @param {number} [decimals=2]
 */
export function formatNumber(value, decimals = 2) {
  return value.toFixed(decimals).replace(".", ",");
}
