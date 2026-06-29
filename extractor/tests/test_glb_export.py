from __future__ import annotations

import json
import struct

from san11resource.model.export_wkmd import write_glb


def read_glb(path):
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    assert version == 2
    assert total_length == len(data)

    json_length, json_type = struct.unpack_from("<I4s", data, 12)
    assert json_type == b"JSON"
    json_start = 20
    gltf = json.loads(data[json_start : json_start + json_length].rstrip(b" ").decode("utf-8"))

    bin_header = json_start + json_length
    bin_length, bin_type = struct.unpack_from("<I4s", data, bin_header)
    assert bin_type == b"BIN\x00"
    assert bin_header + 8 + bin_length == len(data)
    return gltf, data[bin_header + 8 :]


def test_write_glb_mesh(tmp_path):
    output = tmp_path / "triangle.glb"
    write_glb(
        output,
        vertices=[(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)],
        normals=[(0.0, 0.0, 1.0)] * 3,
        uvs=[(0.0, 0.0), (1.0, 0.0), (0.0, 1.0)],
        triangle_groups=[("mesh", [(0, 1, 2)])],
    )

    gltf, binary = read_glb(output)
    primitive = gltf["meshes"][0]["primitives"][0]
    assert primitive["attributes"]["POSITION"] == 0
    assert primitive["attributes"]["NORMAL"] == 1
    assert primitive["attributes"]["TEXCOORD_0"] == 2
    assert gltf["accessors"][0]["count"] == 3
    assert gltf["accessors"][0]["min"] == [0.0, 0.0, 0.0]
    assert gltf["accessors"][0]["max"] == [1.0, 1.0, 0.0]
    assert gltf["accessors"][3]["count"] == 3
    assert gltf["buffers"][0]["byteLength"] == len(binary)
