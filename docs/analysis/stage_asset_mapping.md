# Stage asset mapping notes

This note tracks the current evidence for world-map stage assets. It focuses on
the relation between executable string names, LINK entries, and the map formats
already found in `san11pkres.bin`.

## Why GCOL/K3ST sampling is not enough

`GCOL0001` and `K3ST0006` are useful visual evidence, but they should not be
used as authoritative per-grid asset identifiers.

- `GCOL0001` looks like a full-map RGB preview or color channel payload.
- `K3ST0006` looks like a full-map RGBA channel payload.
- Sampling either image at a logical grid coordinate can only produce a visual
  hint. It does not prove which model or texture the game loads for that cell.

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
candidate bindings: 56

candidate confidence:
  high:   32
  medium: 17
  low:     7
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
   data-buffer/descriptor pairs around san11pkres entries 4864..4869
   ```

   These may describe rendered terrain geometry or batching data. They are more
   likely to carry terrain mesh information than `GCOL0001`/`K3ST0006` previews.

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

Medium-confidence stage control/data candidates:

```text
media/stage/object.sto               -> entry 4805 OBJS0004
media/stage/default.hex              -> entry 4791 or 4863 SHEX0008
media/stage/default.sef              -> entry 4792 SEFF0001
media/stage/envinfo.sea              -> entry 4799 SENV0002
media/stage/distantview/distantview.bin -> entry 4795 DIST0002
media/stage/distantview/*_distantview.wft -> entries 4794/4796/4797/4798 WFTX0010
media/stage/hex.wft                  -> entry 4804 WFTX0010
media/stage/tree/tree_*.wft          -> entries 4840..4843 WFTX0010
```

Notes:

- entry `4794` visually looks like a distant mountain/sky panorama, so the
  `distantview` binding is more plausible than mapping it to ground textures;
- entry `4804` is a 256x512 atlas with terrain/road/facility labels and
  direction glyphs, making it a plausible `hex.wft` candidate;
- entry `4840` visually looks like a vegetation atlas, making `tree_*.wft ->
  4840..4843` more plausible than the earlier `4800..4803` WFTX group;
- entries `4800..4803` are regular 64x64 dot/grid-like textures and should not
  be treated as tree textures without further evidence.

Low-confidence stage layout candidates:

```text
media/stage/color_*.sea -> entries 4787..4790 GCOL0001
media/stage/default.stg -> entries 4864/4866/4868 data-buffer payloads
```

These remain weak because extension/signature semantics do not line up directly.
They are useful as search targets for loader xrefs, not as final bindings.

## IDA xref follow-up

`python-idb` can read `XrefsTo`, so the stage strings can be reduced to a small
set of loader functions and data tables.

Code xrefs found so far:

```text
aMediaStageHexW   -> 0x40f596 in sub_40f510
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
- `sub_40f510` is a good target for `hex.wft`.
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

The strongest current terrain-surface clue is `K3ST0006 map_c0`: it shows
high-frequency mountain/relief structure in the northwest and large dark
regions toward the southeast, matching the visible world-map composition better
than `SHEX b01` alone. `SHEX b01` still forms a map-shaped low-resolution field,
but its 0..92 range looks more like a region/material/height-layer index than a
direct high-resolution height map.

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
   default.stg -> data-buffer/descriptor pair or another raw stage payload
   ```

5. Build an enrichment manifest only after a path-to-entry binding is supported
   by ordering, xrefs, or resource loader behavior.
