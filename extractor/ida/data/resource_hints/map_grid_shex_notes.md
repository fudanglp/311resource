# SHEX0008 and runtime map grid hints

## Resource-side facts

`SHEX0008` is a 200x200 grid with an 11-byte record.

- `../game/San11WPK/media/san11pkres.bin` entry `4791`: 200x200 * 11 bytes
- `../game/San11WPK/media/san11pkres.bin` entry `4863`: 200x200 * 11 bytes
- `../game/San11WPK/media/san11res1.bin` entry `3`: 200x200 * 11 bytes

Representative field stats from `san11pkres.bin` entry `4791`:

- `b00`: 0..19, 20 unique, top [[15, 14619], [6, 4339], [0, 3317], [7, 3098], [8, 2462], [1, 2329], [5, 2121], [3, 1585], [14, 1365], [9, 1324], [10, 1311], [2, 1136]]
- `b01`: 0..92, 91 unique, top [[90, 3091], [89, 1935], [87, 1882], [33, 1256], [40, 1136], [41, 1040], [24, 963], [5, 958], [52, 868], [56, 844], [39, 829], [34, 797]]
- `b02`: 0..0, 1 unique, top [[0, 40000]]
- `b03`: 0..2, 3 unique, top [[0, 39978], [2, 18], [1, 4]]
- `b04`: 0..6, 7 unique, top [[6, 34169], [2, 1873], [5, 1419], [4, 1325], [1, 510], [3, 437], [0, 267]]
- `b05`: 0..1, 2 unique, top [[0, 39409], [1, 591]]
- `b06`: 0..1, 2 unique, top [[0, 39604], [1, 396]]
- `b07`: 0..1, 2 unique, top [[0, 39810], [1, 190]]
- `b08`: 0..1, 2 unique, top [[0, 39805], [1, 195]]
- `b09`: 0..15, 16 unique, top [[14, 7392], [3, 4054], [13, 3527], [0, 3234], [12, 3153], [15, 2874], [11, 2690], [1, 2266], [2, 2185], [4, 2142], [10, 2017], [6, 1409]]
- `b10`: 0..1, 2 unique, top [[0, 39961], [1, 39]]

## Runtime-side facts from IDB

IDA contains `struc_map_grid` with five 4-byte fields, so the runtime grid cell is 20 bytes.

- `0x0` `field_0`
- `0x4` `field_4`
- `0x8` `field_8`
- `0xc` `field_C`
- `0x10` `field_10`

Relevant symbols:

- `0x483a50` `GetAdjacentCoordinateInDirection` (function)
- `0x483b00` `GetFacilityIDFromMapGridData` (function)
- `0x483b20` `GetFacilityPtrFromCoordinate` (function)
- `0x483c80` `GetAllAccessibleCoordinatesInRange` (function)
- `0x483db0` `AreCoordinatesAdjacent` (function)
- `0x483a50` `GetAdjacentCoordinateInDirection` (name)
- `0x483b00` `GetFacilityIDFromMapGridData` (name)
- `0x483b20` `GetFacilityPtrFromCoordinate` (name)
- `0x483c80` `GetAllAccessibleCoordinatesInRange` (name)
- `0x483db0` `AreCoordinatesAdjacent` (name)
- `0x6fb0e68` `struct_map_grid_ARRAY` (name)

## Working interpretation

- The 11-byte `SHEX0008` record is not a byte-for-byte dump of the 20-byte runtime `struc_map_grid`.
- IDB comments around `struct_map_grid_ARRAY` indicate coordinate packing as low 16 bits = x and high 16 bits = y.
- The same comments imply runtime indexing by 200x200 cells and 5 DWORDs per cell, equivalent to `20 * (x * 200 + y)` bytes.
- A city/facility-related ID appears to be extracted from a runtime grid DWORD by shifting right 5 bits and masking with `0x7f`; verify whether that is `field_0` or `field_4` in the decompiler before naming SHEX fields.
- `SHEX b00` and `b04` are still the best terrain/movement-class candidates. `b01` remains the strongest region/height/index candidate because of its 0..92 range and localized deltas between entries 4791 and 4863.
