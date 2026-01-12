// neutral index facing chunking type
import type { RepositoryId } from "../repository/RepositorySource.js";
import type { Language } from "../model/Language.js";
export type Chunk = {
  id: string;
  repo: RepositoryId;

  path: string;
  kind: "code" | "test" | "config" | "doc";
  language?: Language;

  content: string;

  lineStart?: number;
  lineEnd?: number;
};
