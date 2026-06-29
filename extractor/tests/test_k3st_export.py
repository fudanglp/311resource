from __future__ import annotations

import san11resource.map.analyze_map_candidates as candidates


def test_idb_ground_height_uses_expanded_control_b00(monkeypatch):
    monkeypatch.setattr(candidates, "K3ST_CONTROL_WIDTH", 2)
    monkeypatch.setattr(candidates, "K3ST_CONTROL_HEIGHT", 1)

    control = bytes(
        [
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            20,
            21,
            22,
            23,
            24,
            25,
            26,
            27,
        ]
    )

    assert candidates.expand_k3st_idb_ground_height_byte(control) == bytes([10, 20])


def test_control_diffuse_rgb_uses_b01_b02_b03(monkeypatch):
    monkeypatch.setattr(candidates, "K3ST_CONTROL_WIDTH", 2)
    monkeypatch.setattr(candidates, "K3ST_CONTROL_HEIGHT", 1)

    control = bytes(
        [
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            20,
            21,
            22,
            23,
            24,
            25,
            26,
            27,
        ]
    )

    assert candidates.extract_k3st_control_diffuse_rgb(control) == bytes([11, 12, 13, 21, 22, 23])


def test_derived_water_table_extracts_aux_height_and_corner_mask(monkeypatch):
    monkeypatch.setattr(candidates, "K3ST_CONTROL_WIDTH", 5)
    monkeypatch.setattr(candidates, "K3ST_CONTROL_HEIGHT", 5)
    monkeypatch.setattr(candidates, "K3ST_AUX_WIDTH", 4)
    monkeypatch.setattr(candidates, "K3ST_AUX_HEIGHT", 4)
    monkeypatch.setattr(candidates, "K3ST_DERIVED_WIDTH", 1)
    monkeypatch.setattr(candidates, "K3ST_DERIVED_HEIGHT", 1)

    control = bytearray(5 * 5 * candidates.K3ST_CONTROL_STRIDE)
    control[(0 * 5 + 0) * candidates.K3ST_CONTROL_STRIDE] = 40
    control[(4 * 5 + 0) * candidates.K3ST_CONTROL_STRIDE] = 80
    control[(0 * 5 + 4) * candidates.K3ST_CONTROL_STRIDE] = 30
    control[(4 * 5 + 4) * candidates.K3ST_CONTROL_STRIDE] = 90

    aux = bytearray(4 * 4 * candidates.K3ST_AUX_STRIDE)
    value = (64 << 44) | (2 << 52)
    aux[0:8] = value.to_bytes(8, "little")

    derived = candidates.derive_k3st_water_table(bytes(control), bytes(aux))

    assert derived[7] == 64
    assert derived[8] == 0x05
    assert derived[9] == 0x06


def test_extract_aux_water_fields_uses_cross_byte_qword_bits(monkeypatch):
    monkeypatch.setattr(candidates, "K3ST_AUX_WIDTH", 2)
    monkeypatch.setattr(candidates, "K3ST_AUX_HEIGHT", 1)

    aux = bytearray(2 * candidates.K3ST_AUX_STRIDE)
    aux[0:8] = ((0xAB << 44) | (0x02 << 52)).to_bytes(8, "little")
    aux[8:16] = (0x01 << 52).to_bytes(8, "little")

    height, has_water, flags = candidates.extract_k3st_aux_water_fields(bytes(aux))

    assert height == bytes([0xAB, 0x00])
    assert has_water == bytes([0xFF, 0x00])
    assert flags == bytes([0x02, 0x01])
