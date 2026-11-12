// ─── Procedural surface textures ────────────────────────────────────────────
// Plaster, stone, brick, concrete, wood, corrugated metal, paving and
// shelving, drawn on small canvases at runtime (nothing to download). They
// are mostly grey detail — light/dark variation, joints, grain — so each
// box's material colour still tints them.
//
// worldMapped() patches a three.js material to sample its texture by world
// position instead of UVs (top faces use x/z, walls use x/y or z/y): a
// texture keeps its real-world size on every box however the box is scaled,
// and joins line up across neighbouring boxes. It also darkens the foot of
// walls a little, a cheap stand-in for ambient occlusion.
import * as THREE from "three";

const SIZE = 256;
// Real-world size (m) of one repeat of each texture.
const METRES = { plaster: 2.5, stone: 2, brick: 1.6, concrete: 3, wood: 1.2, corrugated: 1.6, paving: 2, rack: 2, plain: 4 };

// Small deterministic random, so textures look the same every time.
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function grain(g, rand, count, size, alpha) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * 255);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(rand() * SIZE, rand() * SIZE, size, size);
  }
}

const DRAW = {
  plaster(g, rand) {
    g.fillStyle = "#e6e6e6"; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 40; i++) {
      const v = 200 + Math.floor(rand() * 55);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.beginPath(); g.arc(rand() * SIZE, rand() * SIZE, 10 + rand() * 40, 0, Math.PI * 2); g.fill();
    }
    grain(g, rand, 2500, 1.5, 0.12);
    g.strokeStyle = "rgba(90,90,90,0.25)"; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); let x = rand() * SIZE, y = rand() * SIZE; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 30; y += rand() * 20; g.lineTo(x, y); }
      g.stroke();
    }
  },
  stone(g, rand) {
    g.fillStyle = "#9a9a9a"; g.fillRect(0, 0, SIZE, SIZE);
    const rows = 4;
    const h = SIZE / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -h * 0.6 : 0;
      while (x < SIZE) {
        const w = h * (1.1 + rand() * 0.9);
        const v = 185 + Math.floor(rand() * 60);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
        x += w;
      }
    }
    grain(g, rand, 3000, 2, 0.1);
  },
  brick(g, rand) {
    g.fillStyle = "#b8b8b8"; g.fillRect(0, 0, SIZE, SIZE);
    const rows = 8;
    const h = SIZE / rows;
    for (let r = 0; r < rows; r++) {
      for (let x = r % 2 ? -h : 0; x < SIZE; x += h * 2) {
        const v = 150 + Math.floor(rand() * 70);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x + 2, r * h + 2, h * 2 - 4, h - 4);
      }
    }
    grain(g, rand, 2000, 1.5, 0.12);
  },
  concrete(g, rand) {
    g.fillStyle = "#cfcfcf"; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 60; i++) {
      const v = 170 + Math.floor(rand() * 70);
      g.fillStyle = `rgba(${v},${v},${v},0.25)`;
      g.beginPath(); g.arc(rand() * SIZE, rand() * SIZE, 6 + rand() * 30, 0, Math.PI * 2); g.fill();
    }
    grain(g, rand, 4000, 1.2, 0.15);
    g.strokeStyle = "rgba(70,70,70,0.45)"; g.lineWidth = 2;
    g.strokeRect(1, 1, SIZE - 2, SIZE - 2); // form-work joints
  },
  wood(g, rand) {
    g.fillStyle = "#c8c8c8"; g.fillRect(0, 0, SIZE, SIZE);
    const planks = 5;
    const h = SIZE / planks;
    for (let p = 0; p < planks; p++) {
      const v = 165 + Math.floor(rand() * 60);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, p * h + 2, SIZE, h - 4);
      g.strokeStyle = "rgba(60,60,60,0.25)"; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const y = p * h + 4 + rand() * (h - 8);
        g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(SIZE * 0.3, y + (rand() - 0.5) * 6, SIZE * 0.7, y + (rand() - 0.5) * 6, SIZE, y);
        g.stroke();
      }
    }
    g.fillStyle = "rgba(40,40,40,0.5)";
    for (let p = 0; p < planks; p++) { g.fillRect(SIZE * 0.1, p * h + h / 2 - 2, 4, 4); g.fillRect(SIZE * 0.9, p * h + h / 2 - 2, 4, 4); }
  },
  corrugated(g, rand) {
    const ribs = 16;
    const w = SIZE / ribs;
    for (let i = 0; i < ribs; i++) {
      const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      grad.addColorStop(0, "#9a9a9a"); grad.addColorStop(0.5, "#e8e8e8"); grad.addColorStop(1, "#9a9a9a");
      g.fillStyle = grad; g.fillRect(i * w, 0, w, SIZE);
    }
    for (let i = 0; i < 25; i++) {
      g.fillStyle = `rgba(110,80,60,${0.05 + rand() * 0.12})`;
      g.fillRect(rand() * SIZE, rand() * SIZE, 4 + rand() * 20, 10 + rand() * 60);
    }
  },
  paving(g, rand) {
    g.fillStyle = "#8f8f8f"; g.fillRect(0, 0, SIZE, SIZE);
    const n = 4;
    const s = SIZE / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const v = 175 + Math.floor(rand() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(c * s + 2, r * s + 2, s - 4, s - 4);
    }
    grain(g, rand, 3500, 1.5, 0.12);
  },
  rack(g) {
    g.fillStyle = "#4a4a4a"; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = "#d9d9d9"; g.fillRect(0, i * (SIZE / 4), SIZE, 10); // shelf beams
      g.fillStyle = "#8a7a62";                                           // boxes on the shelf
      for (let k = 0; k < 4; k++) g.fillRect(8 + k * 62, i * (SIZE / 4) + 14, 46, SIZE / 4 - 18);
    }
    g.fillStyle = "#e0e0e0"; g.fillRect(0, 0, 10, SIZE); g.fillRect(SIZE - 10, 0, 10, SIZE); // uprights
  },
  plain(g, rand) {
    g.fillStyle = "#dddddd"; g.fillRect(0, 0, SIZE, SIZE);
    grain(g, rand, 1500, 1.5, 0.08);
  },
};

export function makeTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext("2d");
  (DRAW[kind] ?? DRAW.plain)(g, rng(kind.length * 7919 + 13));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.userData.metres = METRES[kind] ?? METRES.plain;
  return tex;
}

// Patch `material` to sample `tex` in world space (see the header).
export function worldMapped(material, tex) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldTex = { value: tex };
    shader.uniforms.uWorldTexScale = { value: 1 / tex.userData.metres };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;")
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
        vec4 wpTex = vec4(transformed, 1.0);
        vec3 wnTex = objectNormal;
        #ifdef USE_INSTANCING
          wpTex = instanceMatrix * wpTex;
          wnTex = mat3(instanceMatrix) * wnTex;
        #endif
        vWorldPos = (modelMatrix * wpTex).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * wnTex);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\nuniform sampler2D uWorldTex;\nuniform float uWorldTexScale;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 an = abs(vWorldNormal);
        vec2 tuv = an.y > 0.5 ? vWorldPos.xz : (an.x > 0.5 ? vWorldPos.zy : vWorldPos.xy);
        diffuseColor.rgb *= texture2D(uWorldTex, tuv * uWorldTexScale).rgb;
        // Darker at the foot of walls (fake ambient occlusion).
        if (an.y < 0.5) diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 1.6, vWorldPos.y));`);
  };
  // Distinct shader variants per texture aren't needed (the texture is a
  // uniform), but three must not share this program with unpatched materials.
  material.customProgramCacheKey = () => "world-mapped";
  return material;
}
