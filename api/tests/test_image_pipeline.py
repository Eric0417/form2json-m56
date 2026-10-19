from pathlib import Path

import cv2
import numpy as np

from app.image_pipeline import prepare_form


SAMPLE = Path(__file__).resolve().parents[2] / "IMG_5222.jpeg"


def test_extracts_warped_form_and_eight_group_crops():
    prepared = prepare_form(SAMPLE.read_bytes())

    assert prepared.width == 2400
    assert prepared.height == 1700
    assert len(prepared.groups) == 8
    assert all(group.image_jpeg for group in prepared.groups)
    assert prepared.metadata_jpeg
    assert prepared.table_left < prepared.table_right
    assert prepared.table_top < prepared.table_bottom


def test_last_group_crop_includes_space_for_written_corrections():
    prepared = prepare_form(SAMPLE.read_bytes())
    image = cv2.imdecode(
        np.frombuffer(prepared.groups[-1].image_jpeg, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )

    assert image.shape[0] >= 240


def test_rejects_non_image_bytes():
    try:
        prepare_form(b"not an image")
    except ValueError as exc:
        assert "圖片" in str(exc)
    else:
        raise AssertionError("Expected invalid image to be rejected")
