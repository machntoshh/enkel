import { invoke } from "@tauri-apps/api/core";

export interface TreeNode {
  name: string;
  relPath: string;
  isDir: boolean;
  children?: TreeNode[];
}

export interface DocumentPayload {
  relPath: string;
  name: string;
  content: string;
  updatedAt: number;
}

export interface WorkspaceInitPayload {
  workspacePath: string;
  tree: TreeNode[];
  activeDocument: DocumentPayload | null;
  sidebarCollapsed: boolean;
}

export interface SaveResult {
  relPath: string;
  updatedAt: number;
}

export interface RenameResult {
  oldRelPath: string;
  newRelPath: string;
  isDir: boolean;
}

export interface ImageAssetResult {
  relMarkdownPath: string;
  fileName: string;
}

export interface SearchResultItem {
  relPath: string;
  name: string;
  lineNumber: number | null;
  snippet: string;
}

export const Backend = {
  async initWorkspace(): Promise<WorkspaceInitPayload> {
    return invoke<WorkspaceInitPayload>("init_workspace");
  },

  async selectWorkspaceDirectory(): Promise<WorkspaceInitPayload | null> {
    return invoke<WorkspaceInitPayload | null>("select_workspace_directory");
  },

  async getWorkspaceTree(): Promise<TreeNode[]> {
    return invoke<TreeNode[]>("get_workspace_tree");
  },

  async readDocument(relPath: string): Promise<DocumentPayload> {
    return invoke<DocumentPayload>("read_document", { relPath });
  },

  async saveDocument(relPath: string, content: string): Promise<SaveResult> {
    return invoke<SaveResult>("save_document", { relPath, content });
  },

  async createDocument(parentRelPath: string, name: string): Promise<DocumentPayload> {
    return invoke<DocumentPayload>("create_document", { parentRelPath, name });
  },

  async createFolder(parentRelPath: string, name: string): Promise<string> {
    return invoke<string>("create_folder", { parentRelPath, name });
  },

  async renameEntry(oldRelPath: string, newName: string): Promise<RenameResult> {
    return invoke<RenameResult>("rename_entry", { oldRelPath, newName });
  },

  async deleteEntry(relPath: string): Promise<void> {
    return invoke<void>("delete_entry", { relPath });
  },

  async saveImageFromBytes(filenameHint: string, bytesBase64: string): Promise<ImageAssetResult> {
    return invoke<ImageAssetResult>("save_image_from_bytes", {
      filenameHint,
      bytesBase64,
    });
  },

  async resolveWorkspaceImage(docRelPath: string, imageRef: string): Promise<string> {
    return invoke<string>("resolve_workspace_image", {
      docRelPath,
      imageRef,
    });
  },

  async searchDocuments(query: string): Promise<SearchResultItem[]> {
    return invoke<SearchResultItem[]>("search_documents", { query });
  },

  async setSidebarCollapsed(collapsed: boolean): Promise<void> {
    return invoke<void>("set_sidebar_collapsed", { collapsed });
  },

  async openExternalUrl(url: string): Promise<void> {
    return invoke<void>("open_external_url", { url });
  },
};
