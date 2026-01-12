// packages/context/src/repository/RepositorySource.ts
import type { Language } from "../model/Language.js";
export type RepositoryId = {
  provider: "local" | "github";
  owner?: string;
  name: string;
  ref?: string; // branch | commit | tag
};

export type IndexableFile = {
  path: string;
  kind: "code" | "test" | "config" | "doc";
  language?: Language;
};

export interface RepositorySource {
  id: RepositoryId;

  listFiles(): Promise<IndexableFile[]>;
  readFile(path: string): Promise<string>;
}
