# FPS game models

Characters and weapons in `public/fps/models/` come from Poly Pizza; authors
and licences (CC0, and CC BY 3.0 for the Soldier) are in
`public/fps/models/CREDITS.md`. The game's menu shows the attribution too.

They are trimmed with `optimize.mjs`: for the characters it keeps only the
animation clips the game uses and renames them (see `CLIPS`); every model
is pruned, deduplicated and meshopt-compressed. To regenerate:

```sh
# in a scratch directory, not this repo
npm install @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 \
            @gltf-transform/extensions@4.1.1 meshoptimizer@0.21.0
get() { curl -L -o "$1" "https://static.poly.pizza/$2.glb"; }
get swat.glb    713f6535-f4f3-4367-a4c6-ced126ae0936   # SWAT (Quaternius, CC0)
get soldier.glb 66a55d04-4286-44a3-b289-0d774c27db5b   # Soldier (Quaternius, CC BY 3.0)
get rifle.glb   9a0e478c-de82-4773-9b70-a0219bb0057c   # Assault Rifle (Quaternius, CC0)
get smg.glb     fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710   # Submachine Gun (Quaternius, CC0)
get sniper.glb  f03e21b7-e3b7-49fd-b47d-d1908649fcee   # Sniper Rifle (Quaternius, CC0)
get shotgun.glb 032e6589-3188-41bc-b92b-e25528344275   # Shotgun (Quaternius, CC0)
get pistol.glb  7a31b522-5632-41d9-8274-031795af5d8d   # Pistol (Quaternius, CC0)
get knife.glb   10348d8b-44db-4071-914b-db606eadd92c   # Knife (Quaternius, CC0)
get grenade.glb 03fa7f5b-4df5-45d6-86fb-87e8590f28d7   # Hand Grenade (CreativeTrio, CC0)
O=/path/to/App/scripts/fps-models/optimize.mjs
node $O swat.glb    out/swat.glb
node $O soldier.glb out/soldier.glb
for g in rifle smg sniper shotgun pistol knife grenade; do node $O $g.glb out/guns/$g.glb; done
```

The weapon files share one convention (barrel along +x, up +y; the knife's
blade along +y), which `render/models.js` relies on (`AXES`).
