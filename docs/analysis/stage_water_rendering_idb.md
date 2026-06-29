# Stage water rendering IDB notes

This note records the IDB evidence for the world-map water pass. The immediate
question was whether the gray/white mixed pattern seen over sea in the
experimental 3D viewer could be a global cloud layer. Current evidence points
the other way: water is a dedicated stage render pass with its own texture,
vertex/index buffers, animation/repetition options, and draw calls.

## Method

Use `python-idb` against the dumped IDB, not `objdump` against the packed game
EXE. The bytes in `game/San11WPK/San11WPK.exe` do not line up cleanly with the
IDB ranges used here.

Example setup:

```bash
cd extractor
uv run --group ida --with capstone python - <<'PY'
from pathlib import Path
import idb

with idb.from_file("ida/input/san11pk_dump.exe.idb") as db:
    api = idb.IDAPython(db)
    for ea in api.idautils.Heads(0x422eb0, 0x42315d):
        print(f"{ea:08x}: {api.idc.GetDisasm(ea)}")
PY
```

Useful investigation loop:

1. Search exported IDB names for strings such as `water`, `ShowWater`,
   `WaterAnimTime`, and `WaterRepetition`.
2. Use `api.idautils.XrefsTo(address)` to find code references to each string.
3. For target functions, disassemble with `api.idautils.Heads(start, end)` and
   `api.idc.GetDisasm(ea)`.
4. Trace calls into small D3D wrapper functions. In this IDB, helpers around
   `0x44d040..0x44d1c0` wrap Direct3D device methods and make buffer creation,
   stream binding, FVF, render state, and draw calls easier to recognize.
5. Compare IDB resource paths with `extracted/stage/paths/*` and
   `extracted/resources/output/wftx_images.csv`.

When the IDAPython string helpers are missing, read ASCII strings directly from
IDB bytes:

```python
def cstr(api, ea, maxlen=200):
    data = api.idc.GetManyBytes(ea, maxlen)
    if isinstance(data, str):
        data = data.encode("latin1")
    end = data.find(b"\x00")
    if end >= 0:
        data = data[:end]
    return data.decode("latin1", "replace")
```

## String and option evidence

Relevant strings:

```text
0x77b1fc  media/stage/water.wft
0x792a78  ShowWater
0x792c34  WaterAnimTime
0x792c44  WaterRepetition
```

String xrefs:

```text
media/stage/water.wft -> 0x422658 in sub_4224d0
media/stage/water.wft -> 0x422f94 in sub_422eb0
ShowWater             -> 0x43e412 in sub_43e230
ShowWater             -> 0x43ebcb in sub_43e9f0
WaterAnimTime         -> 0x43e91c in sub_43e230
WaterAnimTime         -> 0x43f065 in sub_43e9f0
WaterRepetition       -> 0x43e93a in sub_43e230
WaterRepetition       -> 0x43f082 in sub_43e9f0
```

`sub_43e230` reads options through `CWinApp::GetProfileIntA`; `sub_43e9f0`
writes them through `CWinApp::WriteProfileInt`. The relevant defaults are:

```text
ShowWater       default 1
WaterAnimTime   default 10000
WaterRepetition default 1
```

The option fields seen in `sub_43e230` are:

```text
ShowWater       -> config object +0xa0
WaterAnimTime   -> config object +0x208
WaterRepetition -> config object +0x20c
```

These option functions do not render water by themselves, but they confirm that
water is a first-class stage feature with animation/repetition controls.

## Water object and buffers

The data table around `0x77b218` looks like a vtable/object method table for
the water stage component:

```text
0x77b218  sub_422eb0
0x77b21c  sub_4226c0
0x77b220  sub_422710
0x77b224  sub_422690
...
0x77b268  sub_423300
```

Important functions:

```text
sub_422eb0  water.wft load/init path
sub_422710  creates water vertex buffer
sub_4227e0  binds water buffers and render state
sub_422c20  water draw/update path
sub_422af0  writes visible water cells into the dynamic vertex buffer
sub_422980  writes one water quad worth of vertices
```

`sub_422eb0` loads `media/stage/water.wft` and creates an index buffer:

```text
index buffer offset in object: this +0x555c
index buffer size:             0x7fe0 = 32736 bytes
index type:                    16-bit
loop count:                    0xaa8 = 2728
indices per loop:              6
```

That shape matches many water quads/strips. It does not look like a global
full-screen overlay.

`sub_422710` creates a dynamic vertex buffer:

```text
vertex buffer offset in object: this +0x5558
vertex buffer size:             0x3ff00
FVF:                            0x142
```

`0x142` is consistent with `XYZ | DIFFUSE | TEX1`. The vertex writer
`sub_422980` writes 24-byte vertices:

```text
float x
float y
float z
u32   diffuse
float u
float v
```

The diffuse color toggles between values shaped like `0x20ffffff` and
`0xffffffff` depending on per-cell flags. That gives water its own alpha/white
highlight variation.

## Render path

`sub_4227e0` sets up the water render state:

```text
bind this+0x5558 as stream source
bind this+0x555c as index buffer
set FVF 0x142
set texture stage/render states including alpha/blend-related states
```

D3D wrapper identifications used here:

```text
0x44d040 -> IDirect3DDevice9::CreateVertexBuffer wrapper
0x44d070 -> IDirect3DDevice9::CreateIndexBuffer wrapper
0x44d0d0 -> stream source wrapper
0x44d100 -> indices wrapper
0x44d120 -> FVF / vertex declaration wrapper
0x44d160 -> lock wrapper
0x44d180 -> unlock wrapper
0x44d190 -> DrawIndexedPrimitive wrapper
0x44d1c0 -> texture stage state wrapper
```

`sub_422c20` is the water draw path:

```text
sub_422c20
  -> sub_4227e0       set water render state
  -> 0x44d160         lock dynamic vertex buffer
  -> sub_422af0       write water vertices
  -> 0x44d180         unlock vertex buffer
  -> 0x401490         bind texture through a renderer/global texture object
  -> 0x44d190         DrawIndexedPrimitive
```

The draw call uses primitive type `5`, with index counts derived from the
water-cell batches. This confirms a real water geometry pass.

The upper stage renderer calls this pass:

```text
sub_41db10 -> sub_422c20
sub_5a13e0 -> sub_41db10
sub_5a1d50 -> sub_41db10
```

In `sub_5a1d50`, the water pass is guarded by:

```text
mov eax, [0x8a5910]
test eax, eax
je skip_water
```

`0x8a5910` is not yet named, but this is a clear runtime switch for the water
pass. It is separate from the terrain/color map pass.

## Resource implication

The current best resource candidate for `media/stage/water.wft` is the group:

```text
san11pkres.bin entry 4800  WFTX0010  64x64  24bpp  unknown=36  large extra payload
san11pkres.bin entry 4801  WFTX0010  64x64  24bpp  unknown=36  large extra payload
san11pkres.bin entry 4802  WFTX0010  64x64  24bpp  unknown=36  large extra payload
san11pkres.bin entry 4803  WFTX0010  64x64  24bpp  unknown=36  large extra payload
```

Reasons:

- the entries are immediately after `envinfo.sea` candidate entry `4799`;
- they precede `hex.wft` candidate entry `4804`;
- each entry exports a small 64x64 tile and carries `unknown=36` plus a large
  still-unexplained extra payload, which fits animated/repeated water better
  than tree or terrain labels;
- the exported tile visually looks like a regular blue/white point or ripple
  pattern;
- IDB confirms `water.wft` has `WaterAnimTime` and `WaterRepetition` options.

This is still a candidate binding, not a final proof. The remaining proof would
be to trace the path resolver/resource loader from `sub_422eb0` through
`0x44f640`/`0x44f6e0` to the concrete LINK entry index.

## Viewer implication

The gray/white mixed water in the experimental 3D viewer should not be treated
as a global cloud layer or as raw GCOL/K3ST color. A closer rendering model is:

```text
terrain pass:
  default.* and other stage data likely drive terrain shape
  K3ST/GCOL remain channel/color evidence until their runtime role is proven

water pass:
  water mask selects visible water cells
  water.wft provides repeated/animated 64x64 tile candidates
  vertex diffuse alpha adds local fade/highlight variation
  WaterAnimTime and WaterRepetition control animation speed/repetition
```

For the frontend, this means sea rendering should eventually be a separate
transparent mesh/pass over the terrain, with optional UV scrolling or entry
selection from the `4800..4803` WFTX tiles. The terrain shader should stop
trying to explain all water color from GCOL/K3ST sampling alone. The large WFTX
extra payload in these entries remains unresolved and should not be called a
decoded layer stack yet.
