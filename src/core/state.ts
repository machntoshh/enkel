import { DocumentPayload, TreeNode } from "./ipc";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

export interface AppState {
  workspacePath: string;
  tree: TreeNode[];
  expandedFolders: Set<string>;
  selectedFolderRelPath: string;
  activeDoc: DocumentPayload | null;
  currentContent: string;
  saveStatus: SaveStatus;
  rawMarkdownMode: boolean;
  sidebarCollapsed: boolean;
}

export const state: AppState = {
  workspacePath: "",
  tree: [],
  expandedFolders: new Set<string>(),
  selectedFolderRelPath: "",
  activeDoc: null,
  currentContent: "",
  saveStatus: "saved",
  rawMarkdownMode: false,
  sidebarCollapsed: false,
};

export function expandParentChain(relPath: string): void {
  const normalized = relPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (parts.length <= 1) return;
  let accum = "";
  for (let i = 0; i < parts.length - 1; i++) {
    accum = accum ? `${accum}/${parts[i]}` : parts[i];
    state.expandedFolders.add(accum);
  }
}

export function getParentFolder(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}
