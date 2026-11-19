use crate::models::AppConfig;
use std::env;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

/// Returns the user's OS configuration directory for Enkel (independent of installation directory).
pub fn get_config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = env::var("APPDATA") {
            return PathBuf::from(appdata).join("Enkel");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Enkel");
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
            return PathBuf::from(xdg).join("enkel");
        }
        if let Ok(home) = env::var("HOME") {
            return PathBuf::from(home).join(".config").join("enkel");
        }
    }
    env::temp_dir().join("EnkelConfig")
}

/// Returns the default user Documents/Enkel workspace path (never inside the app install dir).
pub fn get_default_workspace_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(userprofile) = env::var("USERPROFILE") {
            let docs = PathBuf::from(&userprofile).join("Documents");
            if docs.exists() {
                return docs.join("Enkel");
            }
            return PathBuf::from(userprofile).join("Enkel");
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = env::var("HOME") {
            let docs = PathBuf::from(&home).join("Documents");
            if docs.exists() {
                return docs.join("Enkel");
            }
            return PathBuf::from(home).join("Enkel");
        }
    }
    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("EnkelWorkspace")
}

pub fn get_config_file_path() -> PathBuf {
    get_config_dir().join("config.json")
}

pub fn load_or_init_config() -> AppConfig {
    let config_file = get_config_file_path();
    if config_file.exists() {
        if let Ok(raw) = fs::read_to_string(&config_file) {
            if let Ok(parsed) = serde_json::from_str::<AppConfig>(&raw) {
                let ws_path = PathBuf::from(&parsed.workspace_path);
                if ws_path.exists() || fs::create_dir_all(&ws_path).is_ok() {
                    return parsed;
                }
            }
        }
    }

    let default_ws = get_default_workspace_dir();
    let _ = fs::create_dir_all(&default_ws);

    let default_cfg = AppConfig {
        workspace_path: default_ws.to_string_lossy().to_string(),
        last_open_file: None,
        sidebar_collapsed: false,
    };
    let _ = save_config(&default_cfg);
    default_cfg
}

pub fn save_config(cfg: &AppConfig) -> Result<(), String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar diretório de configuração: {e}"))?;

    let config_file = get_config_file_path();
    let tmp_file = dir.join("config.json.tmp");
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Erro ao serializar configuração: {e}"))?;

    {
        let mut f = fs::File::create(&tmp_file)
            .map_err(|e| format!("Erro ao gravar configuração temporária: {e}"))?;
        f.write_all(json.as_bytes())
            .map_err(|e| format!("Erro ao escrever configuração: {e}"))?;
        let _ = f.sync_all();
    }

    fs::rename(&tmp_file, &config_file)
        .map_err(|e| format!("Erro ao finalizar gravação de configuração: {e}"))?;
    Ok(())
}
