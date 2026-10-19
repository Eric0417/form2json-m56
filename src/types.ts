export type ResultStatus =
  | "finished"
  | "absent"
  | "excused"
  | "makeup"
  | "blank"
  | "unreadable";

export type StageCode = "at" | "bt" | "ct" | "dt";
export type EventKind = "track" | "jump";
export type RecordMark = "x" | "^" | "*";

export interface ResultRecord {
  raw: string | null;
  milliseconds: number | null;
  centimeters: number | null;
  status: ResultStatus;
}

export interface LaneRecord {
  lane: number;
  name: string | null;
  bib: string | null;
  result: ResultRecord;
  place: number | null;
  record_mark: RecordMark | null;
}

export interface GroupRecord {
  group: number;
  lanes: LaneRecord[];
}

export interface EventInfo {
  title: string | null;
  location: string | null;
  page: number | null;
}

export interface FormDocument {
  stage: StageCode;
  event: EventInfo;
  groups: GroupRecord[];
}

export interface JobGroup {
  group: number;
  crop_url: string;
}

export interface JobResponse {
  job_id: string;
  width: number;
  height: number;
  warped_url: string;
  metadata_url: string;
  groups: JobGroup[];
  warnings: string[];
}

export interface HealthStatus {
  provider: "lmstudio" | "deepseek" | string;
  reachable: boolean;
  model: string;
  available: boolean;
  loaded: boolean;
  loaded_models: string[];
  message: string;
}

export type GroupLoadState = "idle" | "loading" | "ready" | "error";
