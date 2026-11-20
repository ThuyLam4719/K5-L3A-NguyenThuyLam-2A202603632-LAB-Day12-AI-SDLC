# Character model asset

The renderer looks for `nezuko.glb` in this directory (`/models/nezuko.glb` in the browser).

Requested Sketchfab model (ID reconstructed from the split link): https://sketchfab.com/3d-models/nezuko-kamado-demon-slayer-t-pose-3d-model-ddb8788ee67c4f0ebe23515e75a36dee

The linked model was not bundled because its page could not be retrieved to verify download permission or license, and no model file was supplied locally. If you download it, confirm its license allows this use, put the GLB here, and add the creator, model URL and license to the project `CREDITS.md`.

The game scales the GLB to about 1.75 m and uses it instead of the built-in fallback. It assumes the model faces GLTF's usual `-Z` direction and rotates it toward the game's `+Z` forward direction. If it faces backward, adjust `model.rotation.y` in `src/main.js`.
