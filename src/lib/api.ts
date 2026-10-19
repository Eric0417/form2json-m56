import type {
  EventInfo,
  GroupRecord,
  HealthStatus,
  JobResponse,
} from "../types";

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: string };
    return new Error(body.detail || `請求失敗 (${response.status})`);
  } catch {
    return new Error(`請求失敗 (${response.status})`);
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const response = await fetch("/api/health", { signal });
  if (!response.ok) {
    throw await responseError(response);
  }
  return (await response.json()) as HealthStatus;
}

export async function createJob(file: File): Promise<JobResponse> {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch("/api/jobs", {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return (await response.json()) as JobResponse;
}

export async function extractMetadata(jobId: string): Promise<EventInfo> {
  const response = await fetch(`/api/jobs/${jobId}/metadata`, {
    method: "POST",
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return (await response.json()) as EventInfo;
}

export async function extractGroup(
  jobId: string,
  group: number,
): Promise<GroupRecord> {
  const response = await fetch(`/api/jobs/${jobId}/groups/${group}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return (await response.json()) as GroupRecord;
}
