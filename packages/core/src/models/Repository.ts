export type RepositoryType = "code" | "vault";

export interface Repository {
  id: string;
  rootPath: string;
  type: RepositoryType;
  indexedAt: Date;
  displayName?: string;
}
