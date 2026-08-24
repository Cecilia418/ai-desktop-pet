export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

export interface UpdateProgress {
  readonly downloadedBytes: number;
  readonly contentLength: number | null;
}

export interface UpdateCandidate {
  readonly version: string;
  readonly notes: string | null;
  readonly date: string | null;
  readonly download: (
    onProgress: (progress: UpdateProgress) => void,
  ) => Promise<void>;
  readonly install: () => Promise<void>;
  readonly close?: () => Promise<void>;
}

export interface UpdateAdapter {
  readonly enabled: boolean;
  check(): Promise<UpdateCandidate | null>;
  relaunch(): Promise<void>;
}

export type ResumeAfterUpdatePreparation = () => void;

export interface UpdateSnapshot {
  readonly enabled: boolean;
  readonly status: UpdateStatus;
  readonly currentVersion: string | null;
  readonly availableVersion: string | null;
  readonly notes: string | null;
  readonly progress: number | null;
  readonly message: string | null;
}
