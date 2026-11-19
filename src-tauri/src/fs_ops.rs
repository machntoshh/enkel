use crate::models::{
    DocumentPayload, ImageAssetResult, RenameResult, SaveResult, SearchResultItem, TreeNode,
};
use base64::Engine;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Normalizes a relative path to forward slashes without leading/trailing slashes.
pub fn normalize_rel_path(rel: &str) -> String {
    rel.replace('\\', "/")
        .trim_matches('/')
        .to_string()
}

/// Accepts `.md` as primary format (and `.txt` for backwards compatibility with existing notes).
pub fn is_supported_note_file(file_name: &str) -> bool {
    let lower = file_name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".txt")
}

/// Validates a relative path to ensure it contains no parent directory (`..`), root, or prefix components.
pub fn validate_relative_components(rel: &str) -> Result<PathBuf, String> {
    let normalized = normalize_rel_path(rel);
    if normalized.is_empty() {
        return Ok(PathBuf::new());
    }

    let path = Path::new(&normalized);
    let mut clean = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::Normal(os_str) => {
                let s = os_str.to_string_lossy();
                if s.is_empty() || s.contains('\0') {
                    return Err("Componente de caminho inválido.".to_string());
                }
                clean.push(os_str);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Operação bloqueada: caminho fora do diretório autorizado.".to_string());
            }
        }
    }
    Ok(clean)
}

/// Resolves a relative path safely inside the workspace root.
pub fn resolve_safe_path(workspace_root: &Path, rel: &str) -> Result<PathBuf, String> {
    let clean_rel = validate_relative_components(rel)?;
    let full = workspace_root.join(clean_rel);

    if let (Ok(canon_root), Ok(canon_full)) = (workspace_root.canonicalize(), full.canonicalize()) {
        if !canon_full.starts_with(&canon_root) {
            return Err("Acesso negado fora do espaço de trabalho.".to_string());
        }
    }
    Ok(full)
}

/// Validates a single entry name (file or folder name without slashes).
pub fn validate_entry_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return Err("Nome inválido.".to_string());
    }
    let forbidden = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    if trimmed.chars().any(|c| forbidden.contains(&c) || c.is_control()) {
        return Err("O nome contém caracteres não permitidos pelo sistema de arquivos.".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn file_modified_seconds(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or_else(now_unix_seconds)
}

/// Atomically writes bytes to a target file via a sibling temporary file + sync_all + rename.
pub fn atomic_write_bytes(target_path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = target_path
        .parent()
        .ok_or_else(|| "Diretório pai inválido.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Falha ao garantir diretório do documento: {e}"))?;

    let file_name = target_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "doc.md".to_string());

    let tmp_name = format!(".{file_name}.enkel.tmp");
    let tmp_path = parent.join(tmp_name);

    {
        let mut tmp_file = fs::File::create(&tmp_path)
            .map_err(|e| format!("Falha ao criar arquivo temporário de escrita segura: {e}"))?;
        tmp_file
            .write_all(bytes)
            .map_err(|e| format!("Falha ao gravar dados no disco: {e}"))?;
        tmp_file
            .sync_all()
            .map_err(|e| format!("Falha ao sincronizar buffer de disco: {e}"))?;
    }

    fs::rename(&tmp_path, target_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Falha ao concluir salvamento atômico do arquivo: {e}")
    })?;

    Ok(())
}

/// Recursively scans the workspace directory for folders and `.md` (or `.txt`) files.
/// Ignores hidden entries (`.`) and the internal `assets` resource directory at the root.
pub fn scan_workspace_tree(workspace_root: &Path) -> Result<Vec<TreeNode>, String> {
    if !workspace_root.exists() {
        fs::create_dir_all(workspace_root)
            .map_err(|e| format!("Não foi possível criar o diretório de trabalho: {e}"))?;
    }
    let _ = fs::create_dir_all(workspace_root.join("assets").join("imagens"));
    scan_dir_recursive(workspace_root, workspace_root, true)
}

fn scan_dir_recursive(
    workspace_root: &Path,
    current_dir: &Path,
    is_root: bool,
) -> Result<Vec<TreeNode>, String> {
    let mut dirs = Vec::new();
    let mut files = Vec::new();

    let entries = fs::read_dir(current_dir)
        .map_err(|e| format!("Erro ao listar diretório {}: {e}", current_dir.display()))?;

    for entry_res in entries {
        let entry = match entry_res {
            Ok(e) => e,
            Err(_) => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name.starts_with('.') {
            continue;
        }
        if is_root && file_name.eq_ignore_ascii_case("assets") {
            continue;
        }

        let path = entry.path();
        let rel_path = path
            .strip_prefix(workspace_root)
            .map(|p| normalize_rel_path(&p.to_string_lossy()))
            .unwrap_or_else(|_| file_name.clone());

        if path.is_dir() {
            let children = scan_dir_recursive(workspace_root, &path, false)?;
            dirs.push(TreeNode {
                name: file_name,
                rel_path,
                is_dir: true,
                children: Some(children),
            });
        } else if path.is_file() && is_supported_note_file(&file_name) {
            files.push(TreeNode {
                name: file_name,
                rel_path,
                is_dir: false,
                children: None,
            });
        }
    }

    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    dirs.extend(files);
    Ok(dirs)
}

pub fn read_markdown_document(workspace_root: &Path, rel_path: &str) -> Result<DocumentPayload, String> {
    let norm = normalize_rel_path(rel_path);
    if !is_supported_note_file(&norm) {
        return Err("O Enkel aceita documentos Markdown (.md).".to_string());
    }

    let full_path = resolve_safe_path(workspace_root, &norm)?;
    if !full_path.exists() || !full_path.is_file() {
        return Err(format!("Documento não encontrado: {norm}"));
    }

    let content = fs::read_to_string(&full_path)
        .map_err(|e| format!("Erro ao ler o documento {norm}: {e}"))?;
    let name = full_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| norm.clone());
    let updated_at = file_modified_seconds(&full_path);

    Ok(DocumentPayload {
        rel_path: norm,
        name,
        content,
        updated_at,
    })
}

pub fn save_markdown_document(
    workspace_root: &Path,
    rel_path: &str,
    content: &str,
) -> Result<SaveResult, String> {
    let norm = normalize_rel_path(rel_path);
    if !is_supported_note_file(&norm) {
        return Err("Apenas documentos .md podem ser salvos.".to_string());
    }

    let full_path = resolve_safe_path(workspace_root, &norm)?;
    atomic_write_bytes(&full_path, content.as_bytes())?;
    let updated_at = file_modified_seconds(&full_path);

    Ok(SaveResult {
        rel_path: norm,
        updated_at,
    })
}

pub fn create_markdown_document(
    workspace_root: &Path,
    parent_rel_path: &str,
    raw_name: &str,
) -> Result<DocumentPayload, String> {
    let clean_name = validate_entry_name(raw_name)?;
    let final_name = if clean_name.to_lowercase().ends_with(".md") {
        clean_name
    } else if clean_name.to_lowercase().ends_with(".txt") {
        format!("{}.md", &clean_name[..clean_name.len() - 4])
    } else {
        format!("{clean_name}.md")
    };

    let parent_norm = normalize_rel_path(parent_rel_path);
    let rel_path = if parent_norm.is_empty() {
        final_name.clone()
    } else {
        format!("{parent_norm}/{final_name}")
    };

    let full_path = resolve_safe_path(workspace_root, &rel_path)?;
    if full_path.exists() {
        return Err(format!("Já existe um arquivo chamado \"{final_name}\" neste local."));
    }

    let title_stem = final_name.trim_end_matches(".md").trim_end_matches(".MD");
    let initial_content = format!("# {title_stem}\n\n");
    atomic_write_bytes(&full_path, initial_content.as_bytes())?;

    let updated_at = file_modified_seconds(&full_path);
    Ok(DocumentPayload {
        rel_path,
        name: final_name,
        content: initial_content,
        updated_at,
    })
}

pub fn create_workspace_folder(
    workspace_root: &Path,
    parent_rel_path: &str,
    raw_name: &str,
) -> Result<String, String> {
    let clean_name = validate_entry_name(raw_name)?;
    if clean_name.eq_ignore_ascii_case("assets") && normalize_rel_path(parent_rel_path).is_empty() {
        return Err("O nome 'assets' na raiz é reservado para as imagens dos documentos.".to_string());
    }

    let parent_norm = normalize_rel_path(parent_rel_path);
    let rel_path = if parent_norm.is_empty() {
        clean_name
    } else {
        format!("{parent_norm}/{clean_name}")
    };

    let full_path = resolve_safe_path(workspace_root, &rel_path)?;
    if full_path.exists() {
        return Err("Já existe uma pasta ou arquivo com este nome.".to_string());
    }

    fs::create_dir_all(&full_path)
        .map_err(|e| format!("Erro ao criar pasta: {e}"))?;

    Ok(rel_path)
}

pub fn rename_workspace_entry(
    workspace_root: &Path,
    old_rel_path: &str,
    raw_new_name: &str,
) -> Result<RenameResult, String> {
    let old_norm = normalize_rel_path(old_rel_path);
    if old_norm.is_empty() {
        return Err("Caminho original inválido.".to_string());
    }

    let old_full = resolve_safe_path(workspace_root, &old_norm)?;
    if !old_full.exists() {
        return Err("O item a ser renomeado não existe.".to_string());
    }

    let is_dir = old_full.is_dir();
    let clean_new = validate_entry_name(raw_new_name)?;
    let final_new_name = if !is_dir && !is_supported_note_file(&clean_new) {
        format!("{clean_new}.md")
    } else {
        clean_new
    };

    let parent_rel = match old_norm.rfind('/') {
        Some(idx) => &old_norm[..idx],
        None => "",
    };

    let new_rel_path = if parent_rel.is_empty() {
        final_new_name
    } else {
        format!("{parent_rel}/{final_new_name}")
    };

    if new_rel_path == old_norm {
        return Ok(RenameResult {
            old_rel_path: old_norm,
            new_rel_path,
            is_dir,
        });
    }

    let new_full = resolve_safe_path(workspace_root, &new_rel_path)?;
    if new_full.exists() {
        return Err("Já existe outro item com este nome no mesmo diretório.".to_string());
    }

    fs::rename(&old_full, &new_full)
        .map_err(|e| format!("Falha ao renomear no sistema de arquivos: {e}"))?;

    Ok(RenameResult {
        old_rel_path: old_norm,
        new_rel_path,
        is_dir,
    })
}

pub fn delete_workspace_entry(workspace_root: &Path, rel_path: &str) -> Result<(), String> {
    let norm = normalize_rel_path(rel_path);
    if norm.is_empty() {
        return Err("Não é permitido excluir a raiz do espaço de trabalho.".to_string());
    }

    let full_path = resolve_safe_path(workspace_root, &norm)?;
    if !full_path.exists() {
        return Ok(());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path)
            .map_err(|e| format!("Erro ao excluir pasta: {e}"))?;
    } else {
        fs::remove_file(&full_path)
            .map_err(|e| format!("Erro ao excluir arquivo: {e}"))?;
    }
    Ok(())
}

pub fn save_image_asset(
    workspace_root: &Path,
    filename_hint: &str,
    bytes_base64: &str,
) -> Result<ImageAssetResult, String> {
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(bytes_base64.trim())
        .map_err(|e| format!("Dados de imagem inválidos: {e}"))?;

    let ext = Path::new(filename_hint)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let safe_ext = match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => ext,
        _ => "png".to_string(),
    };

    let stem: String = Path::new(filename_hint)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "imagem".to_string())
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_lowercase();

    let clean_stem = if stem.is_empty() || stem == "clipboard" {
        "img".to_string()
    } else {
        stem.chars().take(32).collect()
    };

    let images_dir = workspace_root.join("assets").join("imagens");
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Erro ao criar pasta assets/imagens: {e}"))?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let mut file_name = format!("{clean_stem}-{ts}.{safe_ext}");
    let mut counter = 1u32;
    while images_dir.join(&file_name).exists() {
        file_name = format!("{clean_stem}-{ts}-{counter}.{safe_ext}");
        counter += 1;
    }

    let target_path = images_dir.join(&file_name);
    atomic_write_bytes(&target_path, &raw_bytes)?;

    let rel_markdown_path = format!("assets/imagens/{file_name}");
    Ok(ImageAssetResult {
        rel_markdown_path,
        file_name,
    })
}

pub fn resolve_image_to_data_url(
    workspace_root: &Path,
    doc_rel_path: &str,
    image_ref: &str,
) -> Result<String, String> {
    let cleaned_ref = image_ref.trim().trim_start_matches("./");
    let mut candidate = resolve_safe_path(workspace_root, cleaned_ref).ok();

    if candidate.as_ref().map(|p| !p.exists()).unwrap_or(true) {
        let doc_parent = match normalize_rel_path(doc_rel_path).rfind('/') {
            Some(idx) => &doc_rel_path[..idx],
            None => "",
        };
        if !doc_parent.is_empty() {
            let combined = format!("{doc_parent}/{cleaned_ref}");
            candidate = resolve_safe_path(workspace_root, &combined).ok();
        }
    }

    let full_path = candidate.ok_or_else(|| "Caminho de imagem inválido.".to_string())?;
    if !full_path.exists() || !full_path.is_file() {
        return Err("Arquivo de imagem não encontrado no espaço de trabalho.".to_string());
    }

    let bytes = fs::read(&full_path).map_err(|e| format!("Erro ao ler imagem: {e}"))?;
    let ext = full_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

pub fn search_workspace_documents(
    workspace_root: &Path,
    query: &str,
) -> Result<Vec<SearchResultItem>, String> {
    let mut docs = Vec::new();
    collect_markdown_files(workspace_root, workspace_root, &mut docs)?;

    let q = query.trim().to_lowercase();
    let mut results = Vec::new();

    for (rel_path, full_path) in docs {
        let name = full_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| rel_path.clone());

        let content = fs::read_to_string(&full_path).unwrap_or_default();

        if q.is_empty() {
            let first_line = content
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("Documento vazio")
                .trim()
                .chars()
                .take(90)
                .collect::<String>();
            results.push(SearchResultItem {
                rel_path,
                name,
                line_number: None,
                snippet: first_line,
            });
            continue;
        }

        let name_matches = rel_path.to_lowercase().contains(&q);
        let mut matched_line: Option<(usize, String)> = None;

        for (idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&q) {
                matched_line = Some((idx + 1, line.trim().chars().take(100).collect()));
                break;
            }
        }

        if let Some((line_num, snippet)) = matched_line {
            results.push(SearchResultItem {
                rel_path,
                name,
                line_number: Some(line_num),
                snippet,
            });
        } else if name_matches {
            let first_line = content
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("Documento Markdown")
                .trim()
                .chars()
                .take(90)
                .collect::<String>();
            results.push(SearchResultItem {
                rel_path,
                name,
                line_number: None,
                snippet: first_line,
            });
        }

        if results.len() >= 60 {
            break;
        }
    }

    Ok(results)
}

fn collect_markdown_files(
    workspace_root: &Path,
    current_dir: &Path,
    out: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    if !current_dir.exists() {
        return Ok(());
    }
    let entries = fs::read_dir(current_dir)
        .map_err(|e| format!("Erro ao ler diretório: {e}"))?;

    let mut sorted_entries: Vec<_> = entries.flatten().collect();
    sorted_entries.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());

    for entry in sorted_entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if current_dir == workspace_root && name.eq_ignore_ascii_case("assets") {
            continue;
        }
        if path.is_dir() {
            collect_markdown_files(workspace_root, &path, out)?;
        } else if path.is_file() && is_supported_note_file(&name) {
            if let Ok(rel) = path.strip_prefix(workspace_root) {
                out.push((normalize_rel_path(&rel.to_string_lossy()), path));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn make_temp_workspace(test_name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("enkel_md_test_{}_{}", test_name, now_unix_seconds()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_blocks_path_traversal() {
        let ws = make_temp_workspace("traversal");
        assert!(resolve_safe_path(&ws, "../secret.md").is_err());
        assert!(resolve_safe_path(&ws, "Estudos/../../secret.md").is_err());
        assert!(resolve_safe_path(&ws, "Estudos/QA/automacao.md").is_ok());
        let _ = fs::remove_dir_all(&ws);
    }

    #[test]
    fn test_folder_and_document_lifecycle() {
        let ws = make_temp_workspace("lifecycle");

        let folder = create_workspace_folder(&ws, "", "Estudos").unwrap();
        assert_eq!(folder, "Estudos");
        let subfolder = create_workspace_folder(&ws, "Estudos", "QA").unwrap();
        assert_eq!(subfolder, "Estudos/QA");

        let doc = create_markdown_document(&ws, "Estudos/QA", "playwright").unwrap();
        assert_eq!(doc.rel_path, "Estudos/QA/playwright.md");
        assert!(doc.content.starts_with("# playwright"));

        save_markdown_document(&ws, &doc.rel_path, "# Playwright\n\nTestes end-to-end.").unwrap();
        let loaded = read_markdown_document(&ws, &doc.rel_path).unwrap();
        assert_eq!(loaded.content, "# Playwright\n\nTestes end-to-end.");

        let hits = search_workspace_documents(&ws, "end-to-end").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "Estudos/QA/playwright.md");

        let renamed = rename_workspace_entry(&ws, "Estudos/QA/playwright.md", "automacao.md").unwrap();
        assert_eq!(renamed.new_rel_path, "Estudos/QA/automacao.md");

        delete_workspace_entry(&ws, "Estudos/QA/automacao.md").unwrap();
        assert!(read_markdown_document(&ws, "Estudos/QA/automacao.md").is_err());

        let _ = fs::remove_dir_all(&ws);
    }

    #[test]
    fn test_image_asset_persistence() {
        let ws = make_temp_workspace("images");
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let saved = save_image_asset(&ws, "captura.png", png_b64).unwrap();
        assert!(saved.rel_markdown_path.starts_with("assets/imagens/captura-"));
        assert!(saved.rel_markdown_path.ends_with(".png"));

        let data_url = resolve_image_to_data_url(&ws, "Estudos/nota.md", &saved.rel_markdown_path).unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));

        let _ = fs::remove_dir_all(&ws);
    }
}
