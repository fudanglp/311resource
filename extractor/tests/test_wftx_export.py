from __future__ import annotations

import struct

from san11resource.resource.export_resources import export_link


def test_link_wftx_export_records_multilayer_note(tmp_path):
    payload = (
        b"WFTX0010"
        + struct.pack("<IIHHI", 30, 7, 1, 1, (2 << 16) | 24)
        + bytes([0, 0, 255, 0, 255, 0])
    )
    link_path = tmp_path / "sample.bin"
    link_path.write_bytes(b"LINK" + struct.pack("<III", 1, 0, 0) + struct.pack("<II", 24, len(payload)) + payload)

    link_records, wftx_records = export_link(link_path, tmp_path / "out")

    assert len(link_records) == 1
    assert link_records[0].kind == "wftx"
    assert link_records[0].note == "2 WFTX layers exported"
    assert len(wftx_records) == 2
    assert [record.layer_index for record in wftx_records] == [0, 1]
    assert wftx_records[0].note == "layer 1/2"
    assert wftx_records[1].note == "layer 2/2"
    assert "_layer00.png" in wftx_records[0].output
    assert "_layer01.png" in wftx_records[1].output
