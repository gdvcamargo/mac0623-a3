// Visual dos cinco landmarks.
//
// São cinco peças saturadas, uma por cômodo, que identificam onde a pessoa está.

// Cada uma tem silhueta E cor próprias, para dar para saber o heading por
// qualquer uma das duas. Onde cada uma fica (e o sólido de colisão) está em
// house-plan.js (LANDMARK_PLACEMENTS), com o mesmo `id`; as cores, em constants.js.
//
// Cada construtor devolve um THREE.Group com a base em y = 0, centrado na origem
// local da peça; quem o usa (Environment) o posiciona e gira.

import * as THREE from "three";
import { LANDMARK_COLORS as COR } from "./constants.js";
import { solidMaterial } from "./utils.js";

export const LANDMARK_BUILDERS = {
  /** Chaminé de 11 m com lareira, encostada na parede oeste do salão. */
  redChimney() {
    const group = new THREE.Group();
    const column = new THREE.BoxGeometry(1.8, 11, 1.8);
    column.translate(0, 5.5, 0);
    const hearth = new THREE.BoxGeometry(1.0, 0.35, 2.8);
    hearth.translate(1.4, 0.175, 0);
    const firebox = new THREE.BoxGeometry(0.1, 0.9, 1.2);
    firebox.translate(0.95, 0.6, 0);
    group.add(
      new THREE.Mesh(column, solidMaterial(COR.chimney)),
      new THREE.Mesh(hearth, solidMaterial(COR.hearth)),
      new THREE.Mesh(firebox, solidMaterial(COR.firebox)),
    );
    return group;
  },

  /** Arco azul: meio toro em pé sobre as duas pontas, como um portal. */
  blueArch() {
    // A seção do tubo numa ponta é um disco HORIZONTAL (a tangente do arco ali é
    // vertical), então com a malha em y = 0 as pontas ficam exatamente no chão:
    // o ponto mais baixo do arco é y = 0 e o topo é 4 + 0,9 = 4,9 m.
    const tube = 0.9;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4, tube, 16, 32, Math.PI), solidMaterial(COR.arch));
    arch.position.y = 0.0;
    const group = new THREE.Group();
    group.add(arch);
    return group;
  },

  /** Ilha da cozinha: corpo amarelo com tampo escuro. */
  yellowIsland() {
    const body = new THREE.BoxGeometry(7, 1.0, 2.4);
    body.translate(0, 0.5, 0);
    const top = new THREE.BoxGeometry(7.3, 0.1, 2.7);
    top.translate(0, 1.05, 0);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(body, solidMaterial(COR.islandBody)), new THREE.Mesh(top, solidMaterial(COR.islandTop)));
    return group;
  },

  /** Pinheiro do pátio: tronco e copa cônica de ~10 m. */
  greenTree() {
    const trunk = new THREE.CylinderGeometry(0.35, 0.45, 1.6, 12);
    trunk.translate(0, 0.8, 0);
    const crown = new THREE.ConeGeometry(3.2, 9, 24);
    crown.translate(0, 1.4 + 4.5, 0);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(trunk, solidMaterial(COR.trunk)), new THREE.Mesh(crown, solidMaterial(COR.crown)));
    return group;
  },

  /** Mesa redonda laranja com quatro cadeiras. */
  orangeTable() {
    const group = new THREE.Group();
    const top = new THREE.CylinderGeometry(2.2, 2.2, 0.12, 32);
    top.translate(0, 0.84, 0);
    const base = new THREE.CylinderGeometry(0.3, 0.5, 0.84, 16);
    base.translate(0, 0.42, 0);
    group.add(new THREE.Mesh(top, solidMaterial(COR.tableTop)), new THREE.Mesh(base, solidMaterial(COR.tableBase)));

    const chairMaterial = solidMaterial(COR.chair);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), chairMaterial);
      chair.position.set(Math.cos(angle) * 2.1, 0.45, Math.sin(angle) * 2.1);
      chair.rotation.y = -angle;
      group.add(chair);
    }
    return group;
  },
};
