import {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
} from 'three';

/**
 * The main city street the player walks down, with raised sidewalks on each
 * side and painted lane + crossing markings. Runs the length of the district
 * along -Z. The street is wide (a plaza-like boulevard) so crowds feel alive.
 */
export class Roads {
  constructor(parent: Object3D) {
    // Asphalt street.
    const streetGeo = new PlaneGeometry(16, 130, 1, 1);
    streetGeo.rotateX(-Math.PI / 2);
    streetGeo.translate(0, 0.02, -45);
    const street = new Mesh(streetGeo, new MeshStandardMaterial({ map: this.asphalt(), roughness: 0.95 }));
    street.receiveShadow = true;
    parent.add(street);

    // Centre lane dashes.
    const dashMat = new MeshStandardMaterial({ color: 0xe8e2c0, roughness: 0.8, emissive: 0x222018 });
    for (let z = 10; z > -100; z -= 5) {
      const dash = new Mesh(new BoxGeometry(0.3, 0.02, 2), dashMat);
      dash.position.set(0, 0.06, z);
      parent.add(dash);
    }

    // Crosswalk stripes near the plaza.
    for (let i = -3; i <= 3; i++) {
      const stripe = new Mesh(new BoxGeometry(1, 0.02, 4), dashMat);
      stripe.position.set(i * 1.4, 0.06, -30);
      parent.add(stripe);
    }

    // Raised sidewalks.
    const walkMat = new MeshStandardMaterial({ color: 0x9a9488, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const walk = new Mesh(new BoxGeometry(6, 0.25, 130), walkMat);
      walk.position.set(side * 11, 0.12, -45);
      walk.receiveShadow = true;
      parent.add(walk);
    }
  }

  private asphalt(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3c3c40';
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 3000; i++) {
      const s = 40 + Math.random() * 40;
      ctx.fillStyle = `rgba(${s},${s},${s + 6},0.5)`;
      ctx.fillRect(Math.random() * 128, Math.random() * 512, 2, 2);
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(2, 18);
    tex.anisotropy = 8;
    return tex;
  }
}
