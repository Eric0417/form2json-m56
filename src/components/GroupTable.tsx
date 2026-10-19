import type {
  EventKind,
  GroupRecord,
  LaneRecord,
  RecordMark,
  ResultStatus,
} from "../types";
import {
  formatResult,
  laneNeedsReview,
  normalizeResult,
} from "../lib/result";

interface GroupTableProps {
  group: GroupRecord | null;
  loading: boolean;
  error: string | null;
  eventKind: EventKind;
  onChange: (lane: LaneRecord) => void;
  onRetry: () => void;
}

const STATUS_OPTIONS: Array<{ value: ResultStatus; label: string }> = [
  { value: "finished", label: "完賽" },
  { value: "absent", label: "缺賽" },
  { value: "excused", label: "公假" },
  { value: "makeup", label: "補賽" },
  { value: "blank", label: "空白" },
  { value: "unreadable", label: "待確認" },
];

export function GroupTable({
  group,
  loading,
  error,
  eventKind,
  onChange,
  onRetry,
}: GroupTableProps) {
  if (loading) {
    return (
      <div className="table-state" role="status">
        <span className="state-spinner" />
        <strong>正在辨識這一組</strong>
        <span>姓名、成績與名次會保留供人工校正。</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-state table-state-error" role="alert">
        <strong>這一組辨識失敗</strong>
        <span>{error}</span>
        <button className="button button-secondary" type="button" onClick={onRetry}>
          重新辨識
        </button>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="table-state">
        <strong>尚未取得組別資料</strong>
      </div>
    );
  }

  function update(lane: LaneRecord, patch: Partial<LaneRecord>) {
    onChange({ ...lane, ...patch });
  }

  function changeRaw(lane: LaneRecord, raw: string) {
    const result = normalizeResult(raw, eventKind);
    update(lane, {
      result,
      place: result.status === "blank" ? null : lane.place,
      record_mark:
        result.status === "blank" ? null : lane.record_mark,
    });
  }

  function changeStatus(lane: LaneRecord, status: ResultStatus) {
    if (status === "absent") {
      update(lane, {
        result: {
          raw: "缺",
          milliseconds: null,
          centimeters: null,
          status: "absent",
        },
        place: null,
        record_mark: null,
      });
      return;
    }
    if (status === "excused" || status === "makeup") {
      update(lane, {
        result: {
          raw: status === "excused" ? "公假" : "補賽",
          milliseconds: null,
          centimeters: null,
          status,
        },
        place: null,
        record_mark: null,
      });
      return;
    }
    if (status === "blank") {
      update(lane, {
        result: {
          raw: null,
          milliseconds: null,
          centimeters: null,
          status: "blank",
        },
        place: null,
        record_mark: null,
      });
      return;
    }
    if (status === "unreadable") {
      update(lane, {
        result: {
          ...lane.result,
          milliseconds: null,
          centimeters: null,
          status: "unreadable",
        },
      });
      return;
    }
    const parsed = normalizeResult(lane.result.raw, eventKind);
    update(lane, {
      result: {
        raw: lane.result.raw,
        milliseconds:
          parsed.status === "finished" ? parsed.milliseconds : null,
        centimeters:
          parsed.status === "finished" ? parsed.centimeters : null,
        status: "finished",
      },
    });
  }

  return (
    <div className="record-table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th scope="col">跑道</th>
            <th scope="col">姓名</th>
            <th scope="col">號碼</th>
            <th scope="col">原始成績</th>
            <th scope="col">狀態</th>
            <th scope="col">名次</th>
            <th scope="col">紀錄</th>
            <th scope="col">標準值</th>
          </tr>
        </thead>
        <tbody>
          {group.lanes.map((lane) => (
            <tr
              key={lane.lane}
              className={
                laneNeedsReview(lane) ? "row-warning" : undefined
              }
            >
              <th scope="row" className="lane-number">
                {lane.lane}
              </th>
              <td>
                <input
                  className="cell-input cell-name"
                  value={lane.name ?? ""}
                  aria-label={`第 ${lane.lane} 線姓名`}
                  onChange={(event) =>
                    update(lane, { name: event.target.value || null })
                  }
                />
              </td>
              <td>
                <input
                  className="cell-input cell-bib"
                  value={lane.bib ?? ""}
                  inputMode="numeric"
                  aria-label={`第 ${lane.lane} 線號碼`}
                  onChange={(event) =>
                    update(lane, { bib: event.target.value || null })
                  }
                />
              </td>
              <td>
                <input
                  className="cell-input cell-result"
                  value={lane.result.raw ?? ""}
                  placeholder="—"
                  aria-label={`第 ${lane.lane} 線原始成績`}
                  onChange={(event) => changeRaw(lane, event.target.value)}
                />
              </td>
              <td>
                <select
                  className={`cell-select status-${lane.result.status}`}
                  value={lane.result.status}
                  aria-label={`第 ${lane.lane} 線狀態`}
                  onChange={(event) =>
                    changeStatus(lane, event.target.value as ResultStatus)
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  className="cell-input cell-place"
                  type="number"
                  min="1"
                  max="8"
                  value={lane.place ?? ""}
                  aria-label={`第 ${lane.lane} 線名次`}
                  onChange={(event) =>
                    update(lane, {
                      place: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </td>
              <td className="normalized-value">
                <select
                  className="cell-select record-mark-select"
                  value={lane.record_mark ?? ""}
                  aria-label={`第 ${lane.lane} 線紀錄`}
                  onChange={(event) =>
                    update(lane, {
                      record_mark: (event.target.value ||
                        null) as RecordMark | null,
                    })
                  }
                >
                  <option value="">無</option>
                  <option value="x">平上屆 x</option>
                  <option value="^">破上屆 ^</option>
                  <option value="*">破歷屆 *</option>
                </select>
              </td>
              <td className="normalized-value">
                {formatResult(lane.result, eventKind)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
