from __future__ import annotations

from san11resource.stage.extract_stage_paths import LinkEntry, StagePath, build_candidates


def test_default_stg_candidate_uses_k3st_entry_from_idb_loader():
    paths = [
        StagePath(
            source="San11WPK.exe",
            sequence=0,
            offset=0,
            path="media/stage/default.stg",
            category="root",
            extension=".stg",
            basename="default.stg",
        )
    ]
    entries = [
        LinkEntry(
            source="san11pkres.bin",
            entry=4793,
            offset=1000,
            size=16793616,
            signature="K3ST0006",
        )
    ]

    candidates = build_candidates(paths, entries)

    assert len(candidates) == 1
    assert candidates[0].candidate_entry == 4793
    assert candidates[0].confidence == "high"
    assert "K3ST parser" in candidates[0].basis


def test_water_wft_candidates_use_extra_payload_wftx_entries():
    paths = [
        StagePath(
            source="San11WPK.exe",
            sequence=0,
            offset=0,
            path="media/stage/water.wft",
            category="root",
            extension=".wft",
            basename="water.wft",
        )
    ]
    entries = [
        LinkEntry(
            source="san11pkres.bin",
            entry=entry,
            offset=entry * 100,
            size=3039536,
            signature="WFTX0010",
        )
        for entry in range(4800, 4804)
    ]

    candidates = build_candidates(paths, entries)

    assert [candidate.candidate_entry for candidate in candidates] == [4800, 4801, 4802, 4803]
    assert all(candidate.path == "media/stage/water.wft" for candidate in candidates)
    assert all("unknown=36 and large extra data" in candidate.basis for candidate in candidates)
