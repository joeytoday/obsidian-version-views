import type { TFile } from 'obsidian';

export interface VersionMeta {
  filename: string;
  timestamp: number;
  name?: string;  // 版本名称，如 "V1", "V2"
  description?: string;
  originalPath: string;
}

export interface VersionFile {
  content: string;
  meta: VersionMeta;
}

export interface VersionViewSettings {
  storageFolder: string;
  maxVersions: number;
  autoSave: boolean;
}

export interface VersionDisplayInfo {
  meta: VersionMeta;
  file: TFile;
}
