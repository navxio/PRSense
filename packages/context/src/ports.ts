export interface RepositorySource {
  listFilest(): Promise<string[]>;
  readFile(path: string): Promise<string>;
}
