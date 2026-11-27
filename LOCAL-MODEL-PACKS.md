# Local model packs

This fork ships **no 3D field models** (the upstream bundle came with no redistribution licence, so it was removed). The 3D field draws mission models as simple labelled blocks. If you own models you are allowed to use, load them from **3D field → local models ZIP**. The app reads the file in this browser tab only; it is not uploaded or saved, and a reload returns to the simple blocks.

The robot follows the simulator's position, heading, configured dimensions, wheel motors and arm motors. Mission mechanisms are static. Movement, collisions and scoring always use the 2D simulator.

## Pack version 1

A standard, unencrypted ZIP contains `manifest.json` and one or more self-contained GLB files. Filenames are case sensitive and use ASCII letters, digits, underscore, hyphen, dot, and forward slash. Absolute paths, empty segments, `.` and `..` segments, and duplicate names are rejected. ZIP64 and split archives are unsupported.

```json
{
  "schema": "bioglow-local-model-pack",
  "version": 1,
  "title": "My local field models",
  "units": "mm",
  "assetUnits": "m",
  "assets": [{"id": "sample", "file": "models/sample.glb"}],
  "placements": [{
    "id": "sample-position",
    "asset": "sample",
    "nodes": ["sample-base"],
    "origin": [0, 0, 0],
    "position": [1000, 570, 0],
    "yaw": 0
  }]
}
```

GLBs use metres, Y up. The viewer applies a uniform 1000× unit conversion. `origin` is the source anchor in millimetres after this conversion. `position` is `[fieldX, fieldY, height]` in millimetres, measured from the mat's bottom-left. Field points map to Three.js `[fieldX, height, -fieldY]`; yaw is clockwise degrees. `nodes` selects named nodes, preserving their source world transforms; omit it to place the whole asset. `dockModel`, when set to M13, M14, or M15, follows the simulator's selected dock. Optional `dockYaw` adds a clockwise offset.

Limits: ZIP 256 MiB; individual compressed or expanded entry 96 MiB; expanded total 420 MiB; 96 entries; manifest 128 KiB; 40 assets; 64 placements. GLB metadata is limited to 8 MiB. The viewer limits the rendered placements to 4.5 million triangles and 500 meshes. These are rejection limits, not memory or frame-rate guarantees on every device.

Models must contain one embedded binary buffer. External resources, images, glTF extensions, animation and skinning are unsupported. Nonempty extension objects are rejected throughout the GLB JSON before parsing, even when extensionsUsed and extensionsRequired declarations are absent. Buffer ranges, hierarchy cycles, duplicate child nodes, malformed transforms, checksums, and declared sizes are validated. Before GLTFLoader runs, the viewer counts mesh primitives and their instances across all scenes: at most 500 primitive definitions, 500 instantiated meshes, 4.5 million instantiated triangles, 40 scenes, and 8,000 node instances per asset. This rejects small files that would expand into excessive scene objects. Decompression runs in a cancellable worker, one asset at a time, with a 20-second timeout per entry. Loading a valid replacement manifest releases the previous pack before loading its meshes. Saved dock selections apply as soon as a pack loads, including while the robot is idle.

## Dependencies and licenses

Vendored Three.js 0.180.0 and fflate 0.8.2 retain their MIT licenses in `vendor/three/LICENSE` and `vendor/fflate/LICENSE`. `vendor/DEPENDENCIES.json` records the pinned source URLs and SHA-256 hashes. Blockly 11.2.2 (Apache 2.0) is described in `vendor/blockly/NOTICE`.

Model-pack source credits and any conversion limitations belong inside each pack. The viewer's software license does not grant rights to redistribute model assets.
