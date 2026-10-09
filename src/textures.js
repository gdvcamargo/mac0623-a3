// Texturas procedurais da casa.
//
// Nenhuma imagem é carregada: cada textura é desenhada em um <canvas> por uma
// função "pintora" e vira um THREE.CanvasTexture. O gerador pseudoaleatório usa
// semente fixa (ver rng em utils.js), então as texturas saem sempre iguais.
//
// As fábricas exportadas (createXTexture) devolvem texturas que repetem
// (RepeatWrapping): o tamanho de cada ladrilho no mundo é definido por quem as
// usa, escalando os UVs (ver boxAt em utils.js e FLOOR_STYLES em constants.js).

import * as THREE from "three";
import { TEXTURE_ANISOTROPY, TEXTURE_SIZE } from "./constants.js";
import { rng } from "./utils.js";

/**
 * Desenha uma textura num canvas quadrado e a converte para textura do three.js.
 * @param {(ctx: CanvasRenderingContext2D, size: number, rand: () => number) => void} paint
 * @param {number} seed semente do gerador pseudoaleatório
 */
function canvasTexture(paint, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  paint(canvas.getContext("2d"), TEXTURE_SIZE, rng(seed));

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = TEXTURE_ANISOTROPY;
  return texture;
}

/** Salpica pontinhos claros e escuros (ruído de superfície). */
function speckle(ctx, size, rand, count, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

// ---------------------------------------------------------------------------
// Pintores: um por material
// ---------------------------------------------------------------------------

/** Reboco: fundo claro, ruído e leves marcas de desempenadeira. */
function paintPlaster(ctx, size, rand) {
  ctx.fillStyle = "#f2efe8";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 2500, 0.05);
  for (let i = 0; i < 24; i++) { // marcas horizontais bem fracas
    ctx.fillStyle = `rgba(0,0,0,${0.012 + rand() * 0.015})`;
    ctx.fillRect(0, rand() * size, size, 2 + rand() * 6);
  }
}

/** Tábuas de madeira: 16 por ladrilho de 2 m (tábuas de 12,5 cm), com veios e emendas. */
function paintWood(ctx, size, rand) {
  const rows = 16;
  const rowHeight = size / rows;
  for (let r = 0; r < rows; r++) {
    const shade = 0.82 + rand() * 0.28;
    ctx.fillStyle = `rgb(${Math.round(183 * shade)},${Math.round(139 * shade)},${Math.round(92 * shade)})`;
    ctx.fillRect(0, r * rowHeight, size, rowHeight);
    for (let g = 0; g < 10; g++) { // veios
      ctx.fillStyle = `rgba(60,30,10,${0.04 + rand() * 0.05})`;
      ctx.fillRect(rand() * size, r * rowHeight + rand() * rowHeight, 20 + rand() * 80, 1);
    }
    ctx.fillStyle = "rgba(40,20,5,0.55)"; // fresta entre tábuas
    ctx.fillRect(0, r * rowHeight, size, 1);
    const joint = rand() * size; // emenda de topo
    ctx.fillRect(joint, r * rowHeight, 1, rowHeight);
  }
}

/** Azulejo claro 4×4 (peças de 0,5 m) com rejunte. */
function paintTile(ctx, size, rand) {
  const cells = 4;
  const cell = size / cells;
  ctx.fillStyle = "#e9edf0";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 600, 0.04);
  ctx.fillStyle = "#9aa4aa";
  for (let i = 0; i < cells; i++) {
    ctx.fillRect(i * cell, 0, 2, size);
    ctx.fillRect(0, i * cell, size, 2);
  }
}

/** Piso xadrez preto e branco 4×4. */
function paintChecker(ctx, size, rand) {
  const cells = 4;
  const cell = size / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? "#f1f1ee" : "#2d2f32";
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
  }
  speckle(ctx, size, rand, 600, 0.05);
}

/** Grama: fundo verde com pequenos traços verticais. */
function paintGrass(ctx, size, rand) {
  ctx.fillStyle = "#6b9a4f";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const g = 110 + rand() * 80;
    ctx.fillStyle = `rgba(${40 + rand() * 40},${g},${30 + rand() * 30},0.5)`;
    ctx.fillRect(rand() * size, rand() * size, 1, 2 + rand() * 3);
  }
}

/** Carpete: cinza com ruído denso. */
function paintCarpet(ctx, size, rand) {
  ctx.fillStyle = "#8b8f99";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 6000, 0.08);
}

/** Pedra da capa dos muros: 4 fiadas de blocos com juntas alternadas. */
function paintStone(ctx, size, rand) {
  ctx.fillStyle = "#b9b5ab";
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 1500, 0.07);
  ctx.fillStyle = "rgba(60,55,45,0.6)";
  for (let r = 0; r < 4; r++) {
    ctx.fillRect(0, r * (size / 4), size, 2);
    const offset = r % 2 === 0 ? 0 : size / 4;
    for (let c = 0; c < 2; c++) ctx.fillRect(offset + c * (size / 2), r * (size / 4), 2, size / 4);
  }
}

// ---------------------------------------------------------------------------
// Fábricas (as sementes são fixas: 11–15 pisos, 21–22 paredes)
// ---------------------------------------------------------------------------

export const createWoodTexture = () => canvasTexture(paintWood, 11);
export const createTileTexture = () => canvasTexture(paintTile, 12);
export const createCheckerTexture = () => canvasTexture(paintChecker, 13);
export const createGrassTexture = () => canvasTexture(paintGrass, 14);
export const createCarpetTexture = () => canvasTexture(paintCarpet, 15);
export const createPlasterTexture = () => canvasTexture(paintPlaster, 21);
export const createStoneTexture = () => canvasTexture(paintStone, 22);
