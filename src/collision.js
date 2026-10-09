// Colisão para a navegação
//
// Paredes e móveis são sólidos apenas para o pouso: um pulo nunca é bloqueado (a
// mesma regra para as duas técnicas), mas a cabeça não pode ser colocada dentro
// de uma parede ou de um sofá. Os sólidos são retângulos (possivelmente girados)
// e círculos no plano do chão (x, z).
//
// Convenção de rotação: um objeto girado `rot` em torno de Y leva o ponto local
// (x, z) a (x cos + z sin, -x sin + z cos); as contas abaixo usam a inversa.

const EPS = 1e-3; // folga para ficar um pouco FORA do sólido depois de empurrar

/**
 * Conjunto de sólidos no plano do chão.
 */
export class CollisionMap {
  constructor() {
    this.colliders = [];
  }

  /** Retângulo de largura `w` (eixo x local) e profundidade `d` (eixo z local), centrado em (cx, cz). */
  addRect(cx, cz, w, d, rotationY = 0) {
    this.colliders.push({
      circle: false, cx, cz, hw: w / 2, hd: d / 2, cos: Math.cos(rotationY), sin: Math.sin(rotationY),
    });
  }

  addCircle(cx, cz, r) {
    this.colliders.push({ circle: true, cx, cz, r });
  }

  /**
   * Adiciona um sólido dado no referencial LOCAL de um objeto (landmark) que está
   * em `origin` ({x, z, rotationY}). `c` é {x, z, w, d} (retângulo) ou
   * {circle: true, x, z, r}.
   */
  addFromLocal(origin, c) {
    const rot = origin.rotationY ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const wx = origin.x + c.x * cos + c.z * sin;
    const wz = origin.z - c.x * sin + c.z * cos;
    if (c.circle) this.addCircle(wx, wz, c.r);
    else this.addRect(wx, wz, c.w, c.d, rot);
  }

  /** O ponto (x, z) está a menos de `margin` de algum sólido? */
  isBlocked(x, z, margin = 0) {
    for (const c of this.colliders) {
      if (c.circle) {
        if (Math.hypot(x - c.cx, z - c.cz) < c.r + margin) return true;
      } else {
        const dx = x - c.cx;
        const dz = z - c.cz;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw + margin && Math.abs(lz) < c.hd + margin) return true;
      }
    }
    return false;
  }

  /**
   * Empurra (x, z) para fora dos sólidos, pelo caminho mais curto de cada um
   * (pelo eixo fino, no caso de uma parede). Repete algumas vezes porque sair de
   * um sólido pode entrar em outro (cantos).
   * @returns {{x:number, z:number, ok:boolean}} `ok` é falso se não achou ponto livre
   */
  resolveFree(x, z, margin = 0) {
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (const c of this.colliders) {
        const p = pushOut(c, x, z, margin);
        if (p) {
          x = p.x;
          z = p.z;
          moved = true;
        }
      }
      if (!moved) return { x, z, ok: true };
    }
    return { x, z, ok: !this.isBlocked(x, z, margin - 0.01) };
  }
}

/** O ponto logo fora do sólido `c` mais perto de (x, z), ou null se (x, z) não está dentro dele. */
function pushOut(c, x, z, margin) {
  if (c.circle) {
    const dx = x - c.cx;
    const dz = z - c.cz;
    const dist = Math.hypot(dx, dz);
    if (dist >= c.r + margin) return null;
    const scale = (c.r + margin + EPS) / (dist || 1);
    return dist === 0 ? { x: c.cx + c.r + margin + EPS, z: c.cz } : { x: c.cx + dx * scale, z: c.cz + dz * scale };
  }

  const dx = x - c.cx;
  const dz = z - c.cz;
  let lx = dx * c.cos - dz * c.sin;
  let lz = dx * c.sin + dz * c.cos;
  const penX = c.hw + margin - Math.abs(lx);
  const penZ = c.hd + margin - Math.abs(lz);
  if (penX <= 0 || penZ <= 0) return null;
  // Sai pela face mais próxima: pelo eixo fino, no caso de uma parede.
  if (penX < penZ) lx = (lx >= 0 ? 1 : -1) * (c.hw + margin + EPS);
  else lz = (lz >= 0 ? 1 : -1) * (c.hd + margin + EPS);
  return { x: c.cx + lx * c.cos + lz * c.sin, z: c.cz - lx * c.sin + lz * c.cos };
}
