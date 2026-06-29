from __future__ import annotations

import struct

from san11resource.resource.export_resources import export_link


def image_block(width: int, height: int, bpp: int, pixels: bytes, *, mip_count: int = 0) -> bytes:
    return struct.pack("<HHBBBB", width, height, bpp, 0, mip_count, 0) + pixels


def test_link_wftx_export_records_multiple_images(tmp_path):
    payload = (
        b"WFTX0010"
        + struct.pack("<II", 40, 2)
        + image_block(1, 1, 24, bytes([0, 0, 255, 0]))
        + image_block(1, 1, 24, bytes([0, 255, 0, 0]))
    )
    link_path = tmp_path / "sample.bin"
    link_path.write_bytes(b"LINK" + struct.pack("<III", 1, 0, 0) + struct.pack("<II", 24, len(payload)) + payload)

    link_records, wftx_records = export_link(link_path, tmp_path / "out")

    assert len(link_records) == 1
    assert link_records[0].kind == "wftx"
    assert link_records[0].note == "2 WFTX images exported"
    assert len(wftx_records) == 2
    assert [record.layer_index for record in wftx_records] == [0, 1]
    assert wftx_records[0].note == "image 1/2; mip 0/0; extra_blocks=0"
    assert wftx_records[1].note == "image 2/2; mip 0/0; extra_blocks=0"
    assert "_img00.png" in wftx_records[0].output
    assert "_img01.png" in wftx_records[1].output


def test_link_wftx_export_accepts_mipped_image(tmp_path):
    pixels = bytes([0, 0, 255, 0] * 4) + bytes([0, 255, 0, 0])
    payload = (
        b"WFTX0010"
        + struct.pack("<II", 44, 1)
        + image_block(2, 2, 24, pixels, mip_count=1)
    )
    link_path = tmp_path / "sample.bin"
    link_path.write_bytes(b"LINK" + struct.pack("<III", 1, 0, 0) + struct.pack("<II", 24, len(payload)) + payload)

    link_records, wftx_records = export_link(link_path, tmp_path / "out")

    assert len(link_records) == 1
    assert link_records[0].kind == "wftx"
    assert link_records[0].note == ""
    assert len(wftx_records) == 1
    assert wftx_records[0].width == 2
    assert wftx_records[0].height == 2
    assert wftx_records[0].note == "image 1/1; mip 0/1; extra_blocks=0"
