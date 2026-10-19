import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import type { HealthStatus } from "../types";

interface StartScreenProps {
  health: HealthStatus | null;
  healthLoading: boolean;
  uploadError: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
  onSample: () => void;
  onRefreshHealth: () => void;
}

export function StartScreen({
  health,
  healthLoading,
  uploadError,
  uploading,
  onFile,
  onSample,
  onRefreshHealth,
}: StartScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(file: File | undefined) {
    if (file) {
      onFile(file);
    }
  }

  return (
    <div className="start-page">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            F2J
          </span>
          <span>終點紀錄表轉檔</span>
        </div>
        <ModelStatus
          health={health}
          loading={healthLoading}
          onRefresh={onRefreshHealth}
        />
      </header>

      <main className="start-main">
        <section className="upload-section">
          <div className="section-heading">
            <p className="eyebrow">A4 橫式紀錄表</p>
            <h1>照片轉成可校正資料</h1>
          </div>

          <div
            className={`drop-zone${dragging ? " is-dragging" : ""}${uploading ? " is-busy" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => selectFile(event.target.files?.[0])}
              disabled={uploading}
            />
            <div className="drop-zone-icon" aria-hidden="true">
              {uploading ? (
                <LoaderCircle className="spin" size={30} />
              ) : (
                <Upload size={30} />
              )}
            </div>
            <div>
              <p className="drop-title">
                {uploading ? "正在定位表格" : "拖入照片"}
              </p>
              <p className="drop-hint">JPEG、PNG 或 WebP，最大 25 MB</p>
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={17} />
              選擇檔案
            </button>
          </div>

          <div className="start-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onSample}
              disabled={uploading}
            >
              <FileCheck2 size={17} />
              載入已校正範例
            </button>
            <span className="start-note">示範照片：IMG_5222.jpeg</span>
          </div>

          {uploadError ? (
            <div className="inline-alert" role="alert">
              <AlertTriangle size={18} />
              <span>{uploadError}</span>
            </div>
          ) : null}
        </section>

        <aside className="local-model-panel" aria-label="AI 模型狀態">
          <div className="local-model-heading">
            <span className="panel-index">
              {health?.provider === "deepseek" ? "CLOUD" : "LOCAL"}
            </span>
            {health?.loaded ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertTriangle size={19} />
            )}
          </div>
          <dl className="model-facts">
            <div>
              <dt>模型</dt>
              <dd>{health?.model ?? "google/gemma-4-e4b"}</dd>
            </div>
            <div>
              <dt>狀態</dt>
              <dd>{health?.message ?? "檢查 LM Studio 中"}</dd>
            </div>
          </dl>
          {!health?.loaded ? (
            <code className="model-command">
              {health?.provider === "deepseek"
                ? "DEEPSEEK_API_KEY=... pnpm dev"
                : "lms load google/gemma-4-e4b --gpu max -y"}
            </code>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function ModelStatus({
  health,
  loading,
  onRefresh,
}: {
  health: HealthStatus | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div
      className={`status-pill ${health?.loaded ? "status-ok" : "status-warn"}`}
    >
      <span className="status-dot" aria-hidden="true" />
      <span>{loading ? "檢查 AI 模型" : health?.message ?? "AI 模型未連線"}</span>
      <button
        className="icon-button icon-button-small"
        type="button"
        aria-label="重新檢查模型"
        title="重新檢查模型"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={loading ? "spin" : ""} size={15} />
      </button>
    </div>
  );
}
