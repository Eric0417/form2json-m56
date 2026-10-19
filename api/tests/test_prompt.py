from app.ai import group_prompt


def test_group_prompt_prioritizes_written_corrections():
    prompt = group_prompt(8)

    assert "被劃掉" in prompt
    assert "下方清楚的新值" in prompt
    assert "19'90" in prompt
    assert "下一組的姓名" in prompt
    assert "公假" in prompt
    assert "補賽" in prompt
