pub mod config;
pub mod fs_ops;
pub mod models;
#[cfg(all(target_os = "windows", not(target_env = "msvc")))]
pub mod wv2_loader_static;

use config::{load_or_init_config, save_config};
use fs_ops::{
    create_markdown_document, create_workspace_folder, delete_workspace_entry,
    read_markdown_document, rename_workspace_entry, resolve_image_to_data_url, save_image_asset,
    save_markdown_document, scan_workspace_tree, search_workspace_documents,
};
use models::{
    AppConfig, DocumentPayload, ImageAssetResult, RenameResult, SaveResult, SearchResultItem,
    TreeNode, WorkspaceInitPayload,
};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<AppConfig>,
}

fn find_first_file_in_tree(nodes: &[TreeNode]) -> Option<String> {
    for node in nodes {
        if !node.is_dir {
            return Some(node.rel_path.clone());
        }
        if let Some(children) = &node.children {
            if let Some(found) = find_first_file_in_tree(children) {
                return Some(found);
            }
        }
    }
    None
}

#[tauri::command]
fn init_workspace(state: State<'_, AppState>) -> Result<WorkspaceInitPayload, String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado da aplicação.".to_string())?;

    let ws_root = PathBuf::from(&cfg.workspace_path);
    let tree = scan_workspace_tree(&ws_root)?;

    let mut active_document: Option<DocumentPayload> = None;
    if let Some(last_rel) = cfg.last_open_file.clone() {
        if let Ok(doc) = read_markdown_document(&ws_root, &last_rel) {
            active_document = Some(doc);
        }
    }

    if active_document.is_none() {
        if let Some(first_rel) = find_first_file_in_tree(&tree) {
            if let Ok(doc) = read_markdown_document(&ws_root, &first_rel) {
                cfg.last_open_file = Some(doc.rel_path.clone());
                let _ = save_config(&cfg);
                active_document = Some(doc);
            }
        }
    }

    Ok(WorkspaceInitPayload {
        workspace_path: cfg.workspace_path.clone(),
        tree,
        active_document,
        sidebar_collapsed: cfg.sidebar_collapsed,
    })
}

#[tauri::command]
fn select_workspace_directory(
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceInitPayload>, String> {
    let current_dir = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };

    let picked = rfd::FileDialog::new()
        .set_title("Selecionar diretório de trabalho do Enkel")
        .set_directory(&current_dir)
        .pick_folder();

    let Some(new_ws_path) = picked else {
        return Ok(None);
    };

    let tree = scan_workspace_tree(&new_ws_path)?;
    let mut active_document: Option<DocumentPayload> = None;

    if let Some(first_rel) = find_first_file_in_tree(&tree) {
        if let Ok(doc) = read_markdown_document(&new_ws_path, &first_rel) {
            active_document = Some(doc);
        }
    }

    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    cfg.workspace_path = new_ws_path.to_string_lossy().to_string();
    cfg.last_open_file = active_document.as_ref().map(|d| d.rel_path.clone());
    save_config(&cfg)?;

    Ok(Some(WorkspaceInitPayload {
        workspace_path: cfg.workspace_path.clone(),
        tree,
        active_document,
        sidebar_collapsed: cfg.sidebar_collapsed,
    }))
}

#[tauri::command]
fn get_workspace_tree(state: State<'_, AppState>) -> Result<Vec<TreeNode>, String> {
    let ws_root = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };
    scan_workspace_tree(&ws_root)
}

#[tauri::command]
fn read_document(state: State<'_, AppState>, rel_path: String) -> Result<DocumentPayload, String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    let ws_root = PathBuf::from(&cfg.workspace_path);
    let doc = read_markdown_document(&ws_root, &rel_path)?;
    cfg.last_open_file = Some(doc.rel_path.clone());
    let _ = save_config(&cfg);
    Ok(doc)
}

#[tauri::command]
fn save_document(
    state: State<'_, AppState>,
    rel_path: String,
    content: String,
) -> Result<SaveResult, String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    let ws_root = PathBuf::from(&cfg.workspace_path);
    let res = save_markdown_document(&ws_root, &rel_path, &content)?;
    cfg.last_open_file = Some(res.rel_path.clone());
    let _ = save_config(&cfg);
    Ok(res)
}

#[tauri::command]
fn create_document(
    state: State<'_, AppState>,
    parent_rel_path: String,
    name: String,
) -> Result<DocumentPayload, String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    let ws_root = PathBuf::from(&cfg.workspace_path);
    let doc = create_markdown_document(&ws_root, &parent_rel_path, &name)?;
    cfg.last_open_file = Some(doc.rel_path.clone());
    let _ = save_config(&cfg);
    Ok(doc)
}

#[tauri::command]
fn create_folder(
    state: State<'_, AppState>,
    parent_rel_path: String,
    name: String,
) -> Result<String, String> {
    let ws_root = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };
    create_workspace_folder(&ws_root, &parent_rel_path, &name)
}

#[tauri::command]
fn rename_entry(
    state: State<'_, AppState>,
    old_rel_path: String,
    new_name: String,
) -> Result<RenameResult, String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    let ws_root = PathBuf::from(&cfg.workspace_path);
    let res = rename_workspace_entry(&ws_root, &old_rel_path, &new_name)?;

    if let Some(last) = cfg.last_open_file.clone() {
        if last == res.old_rel_path {
            cfg.last_open_file = Some(res.new_rel_path.clone());
            let _ = save_config(&cfg);
        } else if last.starts_with(&format!("{}/", res.old_rel_path)) {
            let suffix = &last[res.old_rel_path.len()..];
            cfg.last_open_file = Some(format!("{}{}", res.new_rel_path, suffix));
            let _ = save_config(&cfg);
        }
    }

    Ok(res)
}

#[tauri::command]
fn delete_entry(state: State<'_, AppState>, rel_path: String) -> Result<(), String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    let ws_root = PathBuf::from(&cfg.workspace_path);
    delete_workspace_entry(&ws_root, &rel_path)?;

    if let Some(last) = cfg.last_open_file.clone() {
        if last == rel_path || last.starts_with(&format!("{rel_path}/")) {
            cfg.last_open_file = None;
            let _ = save_config(&cfg);
        }
    }
    Ok(())
}

#[tauri::command]
fn save_image_from_bytes(
    state: State<'_, AppState>,
    filename_hint: String,
    bytes_base64: String,
) -> Result<ImageAssetResult, String> {
    let ws_root = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };
    save_image_asset(&ws_root, &filename_hint, &bytes_base64)
}

#[tauri::command]
fn resolve_workspace_image(
    state: State<'_, AppState>,
    doc_rel_path: String,
    image_ref: String,
) -> Result<String, String> {
    let ws_root = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };
    resolve_image_to_data_url(&ws_root, &doc_rel_path, &image_ref)
}

#[tauri::command]
fn search_documents(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    let ws_root = {
        let cfg = state
            .config
            .lock()
            .map_err(|_| "Falha ao acessar estado.".to_string())?;
        PathBuf::from(&cfg.workspace_path)
    };
    search_workspace_documents(&ws_root, &query)
}

#[tauri::command]
fn set_sidebar_collapsed(state: State<'_, AppState>, collapsed: bool) -> Result<(), String> {
    let mut cfg = state
        .config
        .lock()
        .map_err(|_| "Falha ao acessar estado.".to_string())?;
    cfg.sidebar_collapsed = collapsed;
    save_config(&cfg)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err("Apenas URLs HTTP/HTTPS são permitidas.".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", trimmed])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Falha ao abrir link no navegador: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_or_init_config();

    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(initial_config),
        })
        .setup(|app| {
            if let Some(icon) = app.default_window_icon().cloned() {
                if let Some(win) = tauri::Manager::get_webview_window(app, "main") {
                    let _ = win.set_icon(icon);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_workspace,
            select_workspace_directory,
            get_workspace_tree,
            read_document,
            save_document,
            create_document,
            create_folder,
            rename_entry,
            delete_entry,
            save_image_from_bytes,
            resolve_workspace_image,
            search_documents,
            set_sidebar_collapsed,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o aplicativo Enkel");
}
