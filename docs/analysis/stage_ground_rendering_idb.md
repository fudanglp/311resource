# Stage ground rendering IDB notes

This note records the current trace from the world-map ground draw path to
terrain vertex color and material texture binding.

## Main draw path

The stage draw function around `0x422020` runs several terrain passes. The
important calls are:

```text
0x422020 path
  SetTextureStageState / SetVertexShader / SetVertexDeclaration
  -> 0x421a10 -> 0x420f10

  if [0x8a5908]:
    SetTextureStageState variants
    -> 0x421aa0 -> 0x421400

  if [0x8a5904]:
    SetTextureStageState variants
    -> 0x4218f0 -> one of 0x420140/0x4205e0/0x420a70/0x41fcb0

  if [this+0x1c6cf58]:
    SetTextureStageState variants
    -> 0x41f7e0
```

`0x4218f0`, `0x421a10`, and `0x421aa0` are dispatchers. They choose the lower
writer/draw function based on level or pass settings; they are not the final
color source by themselves.

All these terrain draw functions eventually use a dynamic 12-byte-per-vertex
stream shaped like:

```text
u32   diffuse
float u
float v
```

The position/height data is therefore not in this dynamic stream. It is bound
through the stage vertex declaration and other prebuilt stage buffers.

## Runtime diffuse color

`0x41dc00` is the small helper that writes one terrain vertex:

```text
vertex[0] = alpha << 24 | record[1] << 16 | record[2] << 8 | record[3]
vertex[4] = u
vertex[8] = v
```

If `record[9] & 1` is set, the helper subtracts a brightness amount from
`record[1..3]`, clamps at zero, then packs the result. The alpha argument is
usually derived from bits in the per-tile flag byte.

The key correction is that `record[1..3]` should be treated as runtime terrain
diffuse RGB, not as purely raw K3ST bytes:

- `0x418fb0` parses `K3ST0006` and initializes the expanded terrain records at
  `this+0x800008+index*10`.
- `0x4191f0` parses `GCOL0001` and writes the seasonal `1025x1025x3` payload
  back into the same expanded records at offsets `+1/+2/+3`.
- The ground draw helper `0x41dc00` then reads those same `+1/+2/+3` bytes.

So the normal seasonal runtime path is:

```text
K3ST default.stg initializes terrain records
GCOL color_*.sea overwrites record RGB bytes +1/+2/+3
ground draw packs record RGB bytes into D3D diffuse
```

The exported `control_diffuse_b01_b02_b03` image is still useful, but it is a
raw K3ST diagnostic unless it is overlaid/replaced with the selected seasonal
GCOL data.

## GCOL loader evidence

`0x5a2ec0` is the seasonal stage loader path. For the same season index it calls:

```text
0x40f2f0  load media/stage/ground/ground_*.wft
0x4043a0  load media/stage/distantview/*.wft
0x41af90  parse color_*.sea, dispatching GCOL to 0x4191f0
```

The `color_*.sea` path table is at `0x8b9834`:

```text
media/stage/color_spring.sea
media/stage/color_summer.sea
media/stage/color_autumn.sea
media/stage/color_winter.sea
```

The parser `0x4191f0` checks `GCOL0001` and then loops `1025*1025` times,
copying three payload bytes per point into expanded terrain record offsets
`+1/+2/+3`.

## Ground WFT texture evidence

`0x40f2f0` is the seasonal ground texture loader. It reads:

```text
0x76356c ids: 0x12c1, 0x12c2, 0x12c0, 0x12c3
0x8a0778 paths:
  media/stage/ground/ground_spring.wft
  media/stage/ground/ground_summer.wft
  media/stage/ground/ground_autumn.wft
  media/stage/ground/ground_winter.wft
```

These ids match LINK entries `4801/4802/4800/4803`.

`0x40f2f0` loads the WFT through the resource loader and then looks for a
`DXT1` texture payload. In the draw functions, texture binding happens by
reading a material/texture entry from `this+0x1be7a88` and passing its first
field to `0x401490`, which wraps D3D texture binding through device vtable
`+0x104`.

The exact build path from loaded `ground_*.wft` surfaces into the
`this+0x1be7a88` material array still needs one more trace, but the current
evidence says the draw path uses WFT-derived material textures, while GCOL is
consumed as vertex diffuse RGB.

## Practical renderer implication

For the viewer, a closer model is:

```text
height/control:
  K3ST record byte +0 and derived water fields

vertex diffuse:
  selected seasonal GCOL RGB written into runtime record +1/+2/+3
  packed by 0x41dc00 as D3D diffuse

material texture:
  selected seasonal ground_*.wft DXT1 material textures
  bound per terrain batch through this+0x1be7a88 -> 0x401490

UV:
  selected from map-grid flags by 0x41d870/0x41d8e0 and pass-specific scale
```

This means a preview that uses only raw K3ST `control_b01..b03` will be close
as a diagnostic layer, but it is not the final in-game color path. The seasonal
GCOL should be treated as the authoritative diffuse RGB input for the ground
passes after stage loading.
