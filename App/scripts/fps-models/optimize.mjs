// Prepares a model for the FPS game: for animated characters, keeps only
// the clips the game uses (renamed to the names engine/anim.js expects) and
// drops the rest; then, for every model, prunes, dedups and compresses with
// meshopt (decoded at runtime by three's MeshoptDecoder). See README.md next
// to this file.
//
// Usage: node optimize.mjs <in.glb> <out.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, weld, quantize, meshopt, resample } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

// Source clip (Quaternius "CharacterArmature|<name>") → name used in game.
const CLIPS = {
  Idle_Gun: "Idle",
  Idle_Gun_Shoot: "Idle_Shoot",
  Walk: "Walk",
  Run: "Run",
  Run_Back: "Run_Back",
  Run_Left: "Run_Left",
  Run_Right: "Run_Right",
  Run_Shoot: "Run_Shoot",
  HitRecieve: "HitReact",
  Death: "Death",
};

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const [, , input, output] = process.argv;
const doc = await io.read(input);
const root = doc.getRoot();

for (const anim of root.listAnimations()) {
  const name = CLIPS[anim.getName().split("|").pop()];
  if (name) anim.setName(name);
  else anim.dispose();
}
await doc.transform(prune(), dedup(), resample(), weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(output, doc);
console.log(`${output}: animations ${root.listAnimations().map(a => a.getName()).join(", ") || "none"}`);
