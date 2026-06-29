# Stage asset mapping notes

This note tracks the current evidence for world-map stage assets. It focuses on
the relation between executable string names, LINK entries, and the map formats
already found in `san11pkres.bin`.

## Why GCOL/K3ST sampling is not enough

`GCOL0001` is useful visual evidence, but it should not be used as an
authoritative per-grid asset identifier. `K3ST0006` is now stronger than a
visual hint: IDB shows it is the `default.stg` parser payload.

- `GCOL0001` looks like a full-map RGB preview or color channel payload.
- `K3ST0006` is parsed by the stage loader as `1025*1025*8` control records
  plus a `1024*1024*8` auxiliary qword bitfield plane.
- Sampling exported diagnostic images at a logical grid coordinate can only
  produce a visual hint. The IDB coordinate conversion and terrain-type
  branches are required before assigning semantic height/water meaning.

The more promising evidence is in the executable and IDA data: the game has
explicit virtual paths for stage data, stage object tables, ground textures,
tree models, building models, and stage environment files.

## Executable stage path evidence

Running `strings` on `San11WPK.exe` shows 470 `media/stage/...` path strings.
They are not present as loose files in the current local `media/` directory, so
they are likely virtual resource names resolved through the packed LINK
containers.

Observed categories:

```text
411 building
36 tree
5 distantview
4 ground
2 default.hex
1 object.sto
1 default.stg
1 default.sef
1 envinfo.sea
4 color_*.sea
1 water.wft
1 hex.wft
1 silhouette.wft
1 paint.wft
```

Important stage control/data paths:

```text
media/stage/default.stg
media/stage/default.hex
media/stage/object.sto
media/stage/default.sef
media/stage/envinfo.sea
media/stage/color_spring.sea
media/stage/color_summer.sea
media/stage/color_autumn.sea
media/stage/color_winter.sea
```

Important stage asset families:

```text
media/stage/ground/ground_*.wft
media/stage/tree/tree*.wkm
media/stage/tree/tree_*.wft
media/stage/building/*.wkm
media/stage/building/*.wft
media/stage/water.wft
media/stage/distantview/*.wft
```

The reproducible extractor for this evidence is:

```bash
cd extractor
uv run python -m san11resource.stage.extract_stage_paths
```

Current outputs:

```text
extracted/stage/paths/stage_paths.csv
extracted/stage/paths/stage_paths.json
extracted/stage/paths/stage_link_entries.csv
extracted/stage/paths/stage_link_entries.json
extracted/stage/paths/stage_entry_candidates.csv
extracted/stage/paths/stage_entry_candidates.json
extracted/stage/paths/summary.json
```

Current summary:

```text
stage paths: 470
candidate bindings: 58

candidate confidence:
  high:   33
  medium: 21
  low:     4
```

## Working model

Current best model:

```text
San11WPK.exe / IDA strings
  -> virtual resource paths such as media/stage/object.sto

san11pkres.bin / san11res1.bin
  -> packed LINK entries containing the actual payload bytes

extractor manifests
  -> entry number, signature, size, parsed metadata, exported previews
```

The missing layer is the binding between virtual path strings and LINK entry
numbers. Without that binding, `SHEX0008`, `OBJS0004`, `WKMD0010`, and `WFTX0010`
can be parsed structurally, but their semantic filenames remain guessed.

## Map-layer interpretation

Treat the world map as three related layers rather than a simple
`grid -> model -> texture` table:

1. Logical grid and terrain classification:

   ```text
   media/stage/default.hex
   SHEX0008
   struct_map_grid_ARRAY
   ```

   `SHEX0008` is still the strongest 200x200 logical grid candidate, but the
   disk format is not a direct dump of the runtime `struc_map_grid`.

2. Stage layout and renderer buffers:

   ```text
   media/stage/default.stg
   K3ST0006
   ```

   IDB `sub_418fb0` parses K3ST into a `1025x1025` control record area and a
   `1024x1024` qword bitfield plane. `control_b00` is now an IDB-supported
   terrain height/control byte: it is expanded to `this+0x800008+index*10`,
   sampled by `0x415bb0/0x4163b0`, scaled by `0.5`, and also reaches the
   ground draw path through the terrain record pointers used by
   `41dcb0/41e7a0/41eb60`. `0x4176b0/0x417770` known call sites pass
   `this+8`, so their `ecx+0x800000+index*10` access also lands on expanded
   `control_b00`. Water/river cells read `derived_b07`, built by `0x415e20`
   from the qword bitfield plane. `control_b01..b03` are terrain diffuse color
   candidates: `0x41dc00` packs them as `alpha<<24 | b01<<16 | b02<<8 | b03`,
   so `b02` is the diffuse green/brightness component.

3. Placed map objects:

   ```text
   media/stage/object.sto
   OBJS0004
   shadowNN_* strings
   media/stage/building/*.wkm
   media/stage/building/*.wft
   media/stage/tree/*.wkm
   media/stage/tree/*.wft
   ```

   `OBJS0004` records already expose object coordinates, `group`, `object_type`,
   and rotation. IDA strings such as `shadow23_market`, `shadow24_farm`,
   `shadow45_tree00`, and related names are strong candidates for object type
   semantics, but the object-type-to-model mapping is not yet proven.

## Candidate path-to-entry bindings

The strongest binding found so far is the tree model group:

```text
media/stage/tree/tree15_m1.wkm -> san11pkres entry 4808 WKMD0010
media/stage/tree/tree15.wkm    -> san11pkres entry 4809 WKMD0010
...
media/stage/tree/tree00_m1.wkm -> san11pkres entry 4838 WKMD0010
media/stage/tree/tree00.wkm    -> san11pkres entry 4839 WKMD0010
```

Evidence:

- there are exactly 32 tree `.wkm` stage paths in this block;
- `san11pkres.bin` entries `4808..4839` are exactly 32 consecutive `WKMD0010`
  entries;
- the exported model bounds are small object-sized meshes, not character-sized
  models;
- the sequence pairs `treeNN_m1/treeNN` match the repeated two-entry model
  pattern.

This is still technically order-based, but it is much stronger than image
sampling.

Stage control/data candidates:

```text
media/stage/object.sto               -> entry 4805 OBJS0004
media/stage/default.hex              -> entry 4791 or 4863 SHEX0008
media/stage/default.stg              -> entry 4793 K3ST0006
media/stage/default.sef              -> entry 4792 SEFF0001
media/stage/envinfo.sea              -> entry 4799 SENV0002
media/stage/distantview/distantview.bin -> entry 4795 DIST0002
media/stage/distantview/spring_distantview.wft -> entry 4796 WFTX0010
media/stage/distantview/summer_distantview.wft -> entry 4797 WFTX0010
media/stage/distantview/autumn_distantview.wft -> entry 4794 WFTX0010
media/stage/distantview/winter_distantview.wft -> entry 4798 WFTX0010
media/stage/ground/ground_spring.wft -> entry 4801 WFTX0010
media/stage/ground/ground_summer.wft -> entry 4802 WFTX0010
media/stage/ground/ground_autumn.wft -> entry 4800 WFTX0010
media/stage/ground/ground_winter.wft -> entry 4803 WFTX0010
media/stage/hex.wft                  -> entry 4804 WFTX0010
media/stage/tree/tree_*.wft          -> entries 4840..4843 WFTX0010
```

Notes:

- entry `4794` visually looks like a distant mountain/sky panorama, so the
  `distantview` binding is more plausible than mapping it to ground textures;
- entries `4800..4803` were previously treated as water candidates, but IDB
  gives a stronger binding to `ground_*.wft`: `sub_40f2f0` indexes the
  `ground_spring/summer/autumn/winter` path table and, on the packed-resource
  branch, indexes the adjacent id table `0x12c1/0x12c2/0x12c0/0x12c3`, i.e.
  LINK entries `4801/4802/4800/4803`;
- each `4800..4803` payload is a multi-image WFTX block. IDB `sub_453110`
  validates the `WFTX0010` magic, reads `u32@0x08` as declared block size, and
  reads `u32@0x0c` as image count. For the ground entries that count is `36`.
  `sub_452700` then reads each image as an 8-byte header
  (`u16 width`, `u16 height`, `u8 bpp`, `u8 extra_blocks`, `u8 mip_count`,
  `u8 flags`) followed by row-aligned pixel data and optional
  `extra_blocks * 1024` bytes. `sub_44f280` creates one D3D texture per image,
  locks each mip level, and copies pixels through `sub_454ee0/454e30`.
  Therefore the previous `payload[32:] -> 1024x989 BGR atlas` interpretation was
  wrong; the visible horizontal stripes came from concatenating 36 independent
  textures as one linear bitmap;
- entry `4804` is a 256x512 atlas with terrain/road/facility labels and
  direction glyphs, making it a plausible `hex.wft` candidate;
- entry `4840` visually looks like a vegetation atlas, making `tree_*.wft ->
  4840..4843` more plausible than the earlier `4800..4803` WFTX group;
- `media/stage/water.wft` remains a confirmed first-class water render asset
  by IDB xrefs, but its concrete LINK entry binding is unresolved after the
  `4800..4803` ground binding correction.

Seasonal color candidates:

```text
media/stage/color_spring.sea -> entry 4788 GCOL0001
media/stage/color_summer.sea -> entry 4789 GCOL0001
media/stage/color_autumn.sea -> entry 4787 GCOL0001
media/stage/color_winter.sea -> entry 4790 GCOL0001
```

The `color_*.sea` extension differs from `GCOL0001`, but this mapping is no
longer only filename ordering. IDB `sub_5a2ec0` indexes a color path table and
an adjacent packed-resource id table with spring/summer/autumn/winter ids
`0x12b4/0x12b5/0x12b3/0x12b6`, i.e. entries `4788/4789/4787/4790`.

Low-confidence stage layout candidates:

```text
entries 4864/4866/4868 -> data-buffer payloads after the stage cluster
```

The data-buffer entries are still useful renderer-buffer candidates, but they
should no longer be treated as the primary `default.stg` binding.

## IDA xref follow-up

`python-idb` can read `XrefsTo`, so the stage strings can be reduced to a small
set of loader functions and data tables.

Code xrefs found so far:

```text
aMediaStageHexW   -> 0x40f596 in sub_40f510
aMediaStageGrou*  -> 0x40f3e5 table access in sub_40f2f0
aMediaStageBuil_1 -> 0x41d3b2 in sub_41d2e0
aMediaStageWate   -> 0x422658 in sub_4224d0
aMediaStageWate   -> 0x422f94 in sub_422eb0
aMediaStageDefa   -> 0x4a5060 in sub_4a4f30
aMediaStageDefa_1 -> 0x5a2184 in sub_5a1fe0
aMediaStageDefa_0 -> 0x5a20c6 in sub_5a1fe0
aMediaStageObje   -> 0x5a219c in sub_5a1fe0
aMediaStageDist_0 -> 0x5a2290 in sub_5a1fe0
aMediaStageDefa_2 -> 0x5a2435 in sub_5a1fe0
aMediaStageEnvi   -> 0x5a2ab5 in sub_5a2a60
```

Interpretation:

- `sub_5a1fe0` is now the best IDA target for `default.*`, `object.sto`, and
  `distantview` loader behavior.
- `sub_41af90` dispatches stage payloads by signature: `K3ST` to `sub_418fb0`,
  `GCOL` to `sub_4191f0`, and `OBJS` to `sub_419280`.
- `sub_418fb0` consumes exactly `8 + 1025*1025*8 + 1024*1024*8` bytes for
  `K3ST0006`, matching `san11pkres.bin` entry `4793`.
- `0x4176b0/0x417770` sample terrain vertex positions from the runtime K3ST
  layout. Known call sites pass `this+8`, so the ordinary-ground branch reads
  expanded `control_b00`, then scales it by `0.5`; terrain classes `6..8` use
  `derived_b07` from the `0x415e20` table instead.
- `sub_40f510` is a good target for `hex.wft`.
- `sub_40f2f0` is the ground texture loader. Its path table order is
  spring/summer/autumn/winter, and the packed-resource id table maps those
  slots to `4801/4802/4800/4803`.
- `sub_4224d0` and `sub_422eb0` are good targets for `water.wft`.
- `sub_5a2a60` is a good target for `envinfo.sea`.
- `sub_41d2e0` touches at least one building stage path directly.

Most building/tree stage path names are referenced through pointer tables rather
than direct code references. Observed table buckets:

```text
0x89e000..0x89e0ff   4 refs
0x8a0700..0x8a07ff  20 refs
0x8a0800..0x8a08ff  64 refs
0x8a0900..0x8a09ff  64 refs
0x8a0a00..0x8a0aff  64 refs
0x8a0b00..0x8a0bff  64 refs
0x8a0c00..0x8a0cff  48 refs
0x8a0d00..0x8a0dff  64 refs
0x8a0e00..0x8a0eff  50 refs
0x8a0f00..0x8a0fff   8 refs
0x8b9800..0x8b98ff   4 refs
```

These tables are likely the real bridge between stage object type/category and
asset filename. The next useful export is a compact xref/table CSV for
`aMediaStage*` names, then inspect which functions read the pointer table.

## Current implication

It is probably wrong to expect each logical map grid to have its own standalone
3D model. A better hypothesis is:

- grid data controls terrain class, movement, facility ownership, and map logic;
- stage files, `K3ST0006` channel data, and renderer buffers define continuous
  terrain surfaces;
- the in-game world map is a 3D stage: the northwest mountain region and
  southeast sea region should be treated as validation constraints for terrain
  height/channel interpretation;
- `object.sto` places discrete objects such as cities, ports, gates, facilities,
  trees, hazards, and special sites;
- object `type` then selects a named stage model/texture family.

The strongest current terrain-surface clue is `K3ST control_b00`: it keeps
rivers and sea low while preserving mountain/highland structure, and IDB
evidence shows it is sampled as a terrain height/control byte. The b01/b02/b03
triplet is now the strongest terrain-color clue, with `b02` acting as the
diffuse green/brightness component. The exporter writes this triplet as
`control_diffuse_b01_b02_b03`, which should be treated as a color layer rather
than a height source. Water and river cells branch to `derived_b07`.
`derived_b08` is a 4-bit corner mask comparing nearby `control_b00` values
against `derived_b07`. `SHEX b01` still forms a map-shaped low-resolution
field, but its `0..92` range looks more like a region/material/height-layer
index than a direct high-resolution height map.
`aux_qword_b05` is also strongly water-related: water and river regions are
high while most non-water terrain is near zero. It should be treated as a raw
bitfield byte that contributes to derived water data, not as the final binary
water mask. The IDB-backed fields are `aux_bits44_51_water_height`, which
crosses raw bytes `b05/b06`, and `aux_bits52_53_water_flags`; `derived_b07`
then folds the height field down to the runtime `256x256` water table.

## Next investigation targets

1. Extract a stable `media/stage/...` path manifest from the executable.
2. Compare stage path ordering with nearby LINK entry ordering, especially
   entries around the map cluster.
3. Search for xrefs or constants around:

   ```text
   media/stage/default.stg
   media/stage/default.hex
   media/stage/object.sto
   struct_map_grid_ARRAY
   Tbl_GridToCityID
   GetFacilityIDFromMapGridData
   shadowNN_*
   ```

4. Validate whether:

   ```text
   object.sto -> OBJS0004
   default.hex -> SHEX0008
   default.stg -> K3ST0006
   ```

5. Trace the rest of the qword bitfield layout used by `0x415e20` and the
   renderer functions around `0x417f30`, then decide how `control_b00`,
   ordinary-ground height, and `derived_b07/b08` should combine in the viewer.
6. Build an enrichment manifest only after a path-to-entry binding is supported
   by ordering, xrefs, or resource loader behavior.
