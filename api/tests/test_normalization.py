from app.normalization import normalize_group_payload


def test_normalizes_model_lane_values_and_fills_missing_lanes():
    payload = {
        "lanes": [
            {
                "lane": 1,
                "name": "孔鈺婷",
                "bib": 3101,
                "result_raw": "18'10",
                "status": "entered",
                "place": "3",
            },
            {
                "lane": 2,
                "name": "丁韻霖",
                "bib": "3201",
                "result_raw": "缺",
                "status": "absent",
                "place": None,
            },
        ]
    }

    group = normalize_group_payload(1, payload)

    assert len(group.lanes) == 8
    assert group.lanes[0].bib == "3101"
    assert group.lanes[0].result.raw == "18'10"
    assert group.lanes[0].result.milliseconds == 18100
    assert group.lanes[0].result.status == "finished"
    assert group.lanes[0].place == 3
    assert group.lanes[1].result.status == "absent"
    assert group.lanes[2].result.status == "blank"


def test_unused_lane_is_blank_even_if_model_reports_entered():
    payload = {
        "lanes": [
            {
                "lane": 7,
                "name": None,
                "bib": None,
                "result_raw": None,
                "status": "entered",
                "place": None,
            }
        ]
    }

    group = normalize_group_payload(1, payload)

    assert group.lanes[6].result.status == "blank"
    assert group.lanes[6].name is None


def test_duplicate_lane_uses_first_record():
    payload = {
        "lanes": [
            {"lane": 1, "name": "第一位", "result_raw": "18'10"},
            {"lane": 1, "name": "重複", "result_raw": "19'00"},
        ]
    }

    group = normalize_group_payload(2, payload)

    assert group.lanes[0].name == "第一位"


def test_status_only_public_leave_and_makeup_fill_raw_text():
    payload = {
        "lanes": [
            {"lane": 1, "name": "甲", "status": "excused"},
            {"lane": 2, "name": "乙", "status": "makeup"},
        ]
    }

    group = normalize_group_payload(1, payload)

    assert group.lanes[0].result.raw == "公假"
    assert group.lanes[0].result.status == "excused"
    assert group.lanes[1].result.raw == "補賽"
    assert group.lanes[1].result.status == "makeup"
