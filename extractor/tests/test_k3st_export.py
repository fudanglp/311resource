from __future__ import annotations

import san11resource.map.analyze_map_candidates as candidates


def test_idb_ground_height_uses_shifted_expanded_record_offset(monkeypatch):
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

    assert candidates.expand_k3st_idb_ground_height_byte(control) == bytes([0, 12])


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
