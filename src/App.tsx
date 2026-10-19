import { useEffect, useState } from "react";

import { EditorScreen } from "./components/EditorScreen";
import { StartScreen } from "./components/StartScreen";
import { sampleDocument, sampleFormImage, sampleGroupImages } from "./data/sample";
import { createJob, extractGroup, extractMetadata, fetchHealth } from "./lib/api";
import { downloadBlob, downloadText } from "./lib/download";
import {
  emptyGroup,
  flattenRecords,
  toCsvText,
  toJsonText,
  toXlsxArray,
} from "./lib/exports";
import {
  eventKindFromTitle,
  laneNeedsReview,
  normalizeResult,
  stageFromTitle,
} from "./lib/result";
import type {
  EventInfo,
  FormDocument,
  GroupLoadState,
  HealthStatus,
  JobResponse,
  LaneRecord,
  StageCode,
} from "./types";

type View = "start" | "editor";

function initialStates(
  state: GroupLoadState,
): Record<number, GroupLoadState> {
  return Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [index + 1, state]),
  );
}

function emptyDocument(): FormDocument {
  return {
    stage: "bt",
    event: { title: null, location: null, page: null },
    groups: Array.from({ length: 8 }, (_, index) => emptyGroup(index + 1)),
  };
}

function safeFilename(document: FormDocument, extension: string): string {
  const title = document.event.title?.trim() || "終點紀錄表";
  return `${title.replaceAll(/[\\/:*?"<>|]/g, "-")}.${extension}`;
}

export default function App() {
  const [view, setView] = useState<View>("start");
  const [document, setDocument] = useState<FormDocument>(emptyDocument());
  const [job, setJob] = useState<JobResponse | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [groupImageUrls, setGroupImageUrls] = useState<string[]>([]);
  const [groupStates, setGroupStates] = useState(initialStates("idle"));
  const [groupErrors, setGroupErrors] = useState<Record<number, string>>({});
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function refreshHealth() {
    setHealthLoading(true);
    try {
      setHealth(await fetchHealth());
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    void refreshHealth();
    const timer = window.setInterval(() => void refreshHealth(), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  function loadSample() {
    setDocument(structuredClone(sampleDocument));
    setFullImageUrl(sampleFormImage);
    setGroupImageUrls(sampleGroupImages);
    setJob(null);
    setGroupStates(initialStates("ready"));
    setGroupErrors({});
    setWarnings([]);
    setMetadataLoading(false);
    setUploadError(null);
    setView("editor");
  }

  async function loadMetadata(jobId: string) {
    setMetadataLoading(true);
    try {
      const event = await extractMetadata(jobId);
      setDocument((current) => {
        const nextStage = stageFromTitle(event.title) ?? current.stage;
        const eventKind = eventKindFromTitle(event.title);
        return {
          ...current,
          event,
          stage: nextStage,
          groups: current.groups.map((group) => ({
            ...group,
            lanes: group.lanes.map((lane) => ({
              ...lane,
              result: lane.result.raw
                ? normalizeResult(lane.result.raw, eventKind)
                : lane.result,
            })),
          })),
        };
      });
    } catch (error) {
      setWarnings((current) => [
        ...current,
        error instanceof Error ? error.message : "賽事資訊辨識失敗。",
      ]);
    } finally {
      setMetadataLoading(false);
    }
  }

  async function loadGroup(jobId: string, group: number) {
    setGroupStates((current) => ({ ...current, [group]: "loading" }));
    setGroupErrors((current) => {
      const next = { ...current };
      delete next[group];
      return next;
    });
    try {
      const result = await extractGroup(jobId, group);
      setDocument((current) => {
        const eventKind = eventKindFromTitle(current.event.title);
        const adjusted = {
          ...result,
          lanes: result.lanes.map((lane) => ({
            ...lane,
            result: lane.result.raw
              ? normalizeResult(lane.result.raw, eventKind)
              : lane.result,
          })),
        };
        return {
          ...current,
          groups: current.groups.map((item) =>
            item.group === group ? adjusted : item,
          ),
        };
      });
      setGroupStates((current) => ({ ...current, [group]: "ready" }));
    } catch (error) {
      setGroupStates((current) => ({ ...current, [group]: "error" }));
      setGroupErrors((current) => ({
        ...current,
        [group]: error instanceof Error ? error.message : "組別辨識失敗。",
      }));
    }
  }

  async function runRecognition(jobResponse: JobResponse) {
    const queue = [1, 2, 3, 4, 5, 6, 7, 8];
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const group = queue[cursor];
        cursor += 1;
        await loadGroup(jobResponse.job_id, group);
      }
    }
    await Promise.all([
      loadMetadata(jobResponse.job_id),
      worker(),
      worker(),
    ]);
  }

  async function uploadImage(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const jobResponse = await createJob(file);
      setJob(jobResponse);
      setDocument(emptyDocument());
      setFullImageUrl(jobResponse.warped_url);
      setGroupImageUrls(
        jobResponse.groups.map((group) => group.crop_url),
      );
      setGroupStates(initialStates("idle"));
      setGroupErrors({});
      setWarnings(jobResponse.warnings);
      setView("editor");
      void runRecognition(jobResponse);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "無法處理這張照片。",
      );
    } finally {
      setUploading(false);
    }
  }

  function updateEvent(event: EventInfo) {
    setDocument((current) => {
      const eventKind = eventKindFromTitle(event.title);
      return {
        ...current,
        event,
        groups: current.groups.map((group) => ({
          ...group,
          lanes: group.lanes.map((lane) => ({
            ...lane,
            result: lane.result.raw
              ? normalizeResult(lane.result.raw, eventKind)
              : lane.result,
          })),
        })),
      };
    });
  }

  function updateStage(stage: StageCode) {
    setDocument((current) => ({ ...current, stage }));
  }

  function updateLane(group: number, lane: LaneRecord) {
    setDocument((current) => ({
      ...current,
      groups: current.groups.map((item) =>
        item.group === group
          ? {
              ...item,
              lanes: item.lanes.map((itemLane) =>
                itemLane.lane === lane.lane ? lane : itemLane,
              ),
            }
          : item,
      ),
    }));
  }

  async function retryGroup(group: number) {
    if (!job) {
      return;
    }
    await loadGroup(job.job_id, group);
  }

  function newDocument() {
    setView("start");
    setJob(null);
    setDocument(emptyDocument());
    setFullImageUrl(null);
    setGroupImageUrls([]);
    setWarnings([]);
    setGroupErrors({});
  }

  function exportJson() {
    downloadText(
      safeFilename(document, "json"),
      toJsonText(document),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    downloadText(
      safeFilename(document, "csv"),
      toCsvText(document),
      "text/csv;charset=utf-8",
    );
  }

  function exportXlsx() {
    downloadBlob(
      safeFilename(document, "xlsx"),
      new Blob([toXlsxArray(document)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }

  if (view === "start") {
    return (
      <StartScreen
        health={health}
        healthLoading={healthLoading}
        uploadError={uploadError}
        uploading={uploading}
        onFile={(file) => void uploadImage(file)}
        onSample={loadSample}
        onRefreshHealth={() => void refreshHealth()}
      />
    );
  }

  const allGroupsReady = Object.values(groupStates).every(
    (state) => state === "ready",
  );
  const attentionCount = document.groups.reduce(
    (count, group) =>
      count +
      group.lanes.filter(laneNeedsReview).length,
    0,
  );
  const recordCount = flattenRecords(document).length;
  const eventKind = eventKindFromTitle(document.event.title);
  const exportReady =
    allGroupsReady &&
    !metadataLoading &&
    Boolean(document.event.title?.trim()) &&
    attentionCount === 0 &&
    recordCount > 0;

  return (
    <EditorScreen
      document={document}
      fullImageUrl={fullImageUrl}
      groupImageUrls={groupImageUrls}
      groupStates={groupStates}
      groupErrors={groupErrors}
      metadataLoading={metadataLoading}
      warnings={warnings}
      exportReady={exportReady}
      attentionCount={attentionCount}
      recordCount={recordCount}
      eventKind={eventKind}
      onNew={newDocument}
      onEventChange={updateEvent}
      onStageChange={updateStage}
      onLaneChange={updateLane}
      onRetryGroup={(group) => void retryGroup(group)}
      onExportJson={exportJson}
      onExportCsv={exportCsv}
      onExportXlsx={exportXlsx}
    />
  );
}
