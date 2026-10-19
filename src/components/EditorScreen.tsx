import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson2,
  FileSpreadsheet,
  Image,
  LoaderCircle,
  Rows3,
} from "lucide-react";
import { useState } from "react";

import type {
  EventInfo,
  FormDocument,
  GroupLoadState,
  GroupRecord,
  LaneRecord,
  EventKind,
  StageCode,
} from "../types";
import { laneNeedsReview } from "../lib/result";
import { GroupTable } from "./GroupTable";

interface EditorScreenProps {
  document: FormDocument;
  fullImageUrl: string | null;
  groupImageUrls: string[];
  groupStates: Record<number, GroupLoadState>;
  groupErrors: Record<number, string>;
  metadataLoading: boolean;
  warnings: string[];
  exportReady: boolean;
  attentionCount: number;
  recordCount: number;
  eventKind: EventKind;
  onNew: () => void;
  onEventChange: (event: EventInfo) => void;
  onStageChange: (stage: StageCode) => void;
  onLaneChange: (group: number, lane: LaneRecord) => void;
  onRetryGroup: (group: number) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
}

export function EditorScreen({
  document,
  fullImageUrl,
  groupImageUrls,
  groupStates,
  groupErrors,
  metadataLoading,
  warnings,
  exportReady,
  attentionCount,
  recordCount,
  eventKind,
  onNew,
  onEventChange,
  onStageChange,
  onLaneChange,
  onRetryGroup,
  onExportJson,
  onExportCsv,
  onExportXlsx,
}: EditorScreenProps) {
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [showFullImage, setShowFullImage] = useState(false);
  const currentGroup =
    document.groups.find((group) => group.group === selectedGroup) ?? null;
  const currentState = groupStates[selectedGroup] ?? "idle";
  const failedGroups = Object.values(groupStates).filter(
    (state) => state === "error",
  ).length;
  const loadingGroups = Object.values(groupStates).filter(
    (state) => state === "loading",
  ).length;
  const summaryIssues = [
    failedGroups ? `${failedGroups} 組失敗` : "",
    !document.event.title?.trim() ? "請輸入賽事名稱" : "",
    attentionCount ? `${attentionCount} 格待確認` : "",
    recordCount === 0 ? "沒有選手資料" : "",
  ].filter(Boolean);
  const imageUrl = showFullImage
    ? fullImageUrl
    : groupImageUrls[selectedGroup - 1] ?? fullImageUrl;

  return (
    <div className="editor-page">
      <header className="editor-header">
        <div className="editor-title-row">
          <button className="icon-text-button" type="button" onClick={onNew}>
            <ArrowLeft size={17} />
            新照片
          </button>
          <div>
            <p className="eyebrow">校正工作區</p>
            <h1>{document.event.title || "未命名終點紀錄表"}</h1>
          </div>
        </div>
        <div className="export-actions" aria-label="匯出">
          <button
            className="button button-secondary"
            type="button"
            onClick={onExportJson}
            disabled={!exportReady}
          >
            <FileJson2 size={16} />
            JSON
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={onExportCsv}
            disabled={!exportReady}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={onExportXlsx}
            disabled={!exportReady}
          >
            <FileSpreadsheet size={16} />
            XLSX
          </button>
        </div>
      </header>

      <section className="event-bar" aria-label="賽事資訊">
        <label>
          <span>賽別</span>
          <select
            value={document.stage}
            onChange={(event) =>
              onStageChange(event.target.value as StageCode)
            }
          >
            <option value="at">at 預賽</option>
            <option value="bt">bt 初賽</option>
            <option value="ct">ct 復賽</option>
            <option value="dt">dt 決賽</option>
          </select>
        </label>
        <label>
          <span>賽事名稱</span>
          <input
            value={document.event.title ?? ""}
            placeholder={metadataLoading ? "正在辨識..." : "輸入賽事名稱"}
            onChange={(event) =>
              onEventChange({ ...document.event, title: event.target.value || null })
            }
          />
        </label>
        <label>
          <span>位置</span>
          <input
            value={document.event.location ?? ""}
            placeholder="終點"
            onChange={(event) =>
              onEventChange({
                ...document.event,
                location: event.target.value || null,
              })
            }
          />
        </label>
        <label>
          <span>頁碼</span>
          <input
            type="number"
            min="1"
            value={document.event.page ?? ""}
            placeholder="1"
            onChange={(event) =>
              onEventChange({
                ...document.event,
                page: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
        <div className="recognition-summary" role="status">
          {metadataLoading || loadingGroups > 0 ? (
            <>
              <LoaderCircle className="spin" size={17} />
              <span>
                辨識中，剩餘 {loadingGroups + (metadataLoading ? 1 : 0)} 項
              </span>
            </>
          ) : summaryIssues.length ? (
            <>
              <AlertTriangle size={17} />
              <span>{summaryIssues.join("，")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={17} />
              <span>資料已可匯出</span>
            </>
          )}
        </div>
      </section>

      {warnings.length ? (
        <div className="warning-strip" role="alert">
          <AlertTriangle size={17} />
          <span>{warnings.join(" ")}</span>
        </div>
      ) : null}

      <main className="editor-grid">
        <section className="image-panel" aria-label="原始表單">
          <div className="panel-toolbar">
            <div className="panel-label">
              <Image size={17} />
              <span>{showFullImage ? "整張表單" : `第 ${selectedGroup} 組`}</span>
            </div>
            <button
              className="icon-text-button"
              type="button"
              onClick={() => setShowFullImage((value) => !value)}
            >
              {showFullImage ? <Rows3 size={16} /> : <Image size={16} />}
              {showFullImage ? "查看組別" : "查看全表"}
            </button>
          </div>
          <div
            className={`image-stage ${showFullImage ? "is-full" : "is-group"}`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="校正後的終點紀錄表" />
            ) : (
              <div className="image-placeholder">沒有可預覽的圖片</div>
            )}
          </div>
        </section>

        <section className="data-panel" aria-label="資料校正">
          <nav className="group-tabs" aria-label="選擇組別">
            {Array.from({ length: 8 }, (_, index) => index + 1).map((group) => {
              const state = groupStates[group] ?? "idle";
              const hasReview =
                document.groups
                  .find((item) => item.group === group)
                  ?.lanes.some(laneNeedsReview) ?? false;
              return (
                <button
                  key={group}
                  className={`group-tab${selectedGroup === group ? " is-active" : ""}`}
                  type="button"
                  aria-current={selectedGroup === group ? "page" : undefined}
                  aria-label={`第 ${group} 組${hasReview ? "，有欄位待確認" : ""}`}
                  onClick={() => {
                    setSelectedGroup(group);
                    setShowFullImage(false);
                  }}
                >
                  <span>{group}</span>
                  <i
                    className={`group-state state-${state}${hasReview ? " has-review" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </nav>

          <div className="group-heading">
            <div>
              <p className="eyebrow">GROUP {String(selectedGroup).padStart(2, "0")}</p>
              <h2>第 {selectedGroup} 組</h2>
            </div>
            <span className="lane-note">8 條跑道</span>
          </div>

          <GroupTable
            group={currentGroup}
            loading={currentState === "loading"}
            error={groupErrors[selectedGroup] ?? null}
            eventKind={eventKind}
            onChange={(lane) => onLaneChange(selectedGroup, lane)}
            onRetry={() => onRetryGroup(selectedGroup)}
          />

          <footer className="data-footer">
            <span>空白跑道不會列入 CSV 與 XLSX</span>
            <span>{recordCount} 筆選手資料</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
