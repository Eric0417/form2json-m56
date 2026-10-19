from app.scores import normalize_result


def test_normalizes_centiseconds():
    assert normalize_result("18'10") == (18100, "finished")


def test_normalizes_milliseconds():
    assert normalize_result("18'123") == (18123, "finished")


def test_normalizes_single_fraction_digit():
    assert normalize_result("18'6") == (18600, "finished")


def test_accepts_decimal_input():
    assert normalize_result("18.10") == (18100, "finished")


def test_accepts_encoded_track_times():
    assert normalize_result("4557") == (45570, "finished")
    assert normalize_result("11918") == (79180, "finished")


def test_marks_absent_as_absent():
    assert normalize_result("缺") == (None, "absent")


def test_marks_public_leave_and_makeup():
    assert normalize_result("公假") == (None, "excused")
    assert normalize_result("補賽") == (None, "makeup")


def test_marks_blank_as_blank():
    assert normalize_result("  ") == (None, "blank")
    assert normalize_result(None) == (None, "blank")


def test_keeps_unreadable_text():
    assert normalize_result("1B'1O") == (None, "unreadable")
