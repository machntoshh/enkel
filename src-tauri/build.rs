use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn find_webview2_dll(start_dir: &Path) -> Option<PathBuf> {
    if !start_dir.exists() {
        return None;
    }
    let entries = fs::read_dir(start_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let candidate = path.join("x64").join("WebView2Loader.dll");
            if candidate.exists() && candidate.metadata().map(|m| m.len() > 10_000).unwrap_or(false)
            {
                return Some(candidate);
            }
            if let Some(found) = find_webview2_dll(&path) {
                return Some(found);
            }
        }
    }
    None
}

fn create_empty_ar_archive(path: &Path) {
    // Standard 8-byte GNU ar archive header ("!<arch>\n") — valid empty static library for lld/ld
    let _ = fs::write(path, b"!<arch>\n");
}

fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.png");
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");
    println!("cargo:rerun-if-changed=tauri.conf.json");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_env = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    if target_os == "windows" && target_env != "msvc" {
        let embedded_dest = out_dir.join("WebView2Loader_embedded.dll");
        if !embedded_dest.exists() {
            let cargo_home = env::var("CARGO_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| {
                    PathBuf::from(env::var("USERPROFILE").unwrap_or_default()).join(".cargo")
                });
            let reg_src = cargo_home.join("registry").join("src");
            if let Some(dll_src) = find_webview2_dll(&reg_src) {
                let _ = fs::copy(&dll_src, &embedded_dest);
            }
        }

        // Neutralize dynamic WebView2Loader.dll in webview2-com-sys build out_dir so lld uses our static symbols
        if let Some(build_root) = out_dir.parent().and_then(|p| p.parent()) {
            if let Ok(entries) = fs::read_dir(build_root) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("webview2-com-sys-") {
                        let x64_dir = entry.path().join("out").join("x64");
                        if x64_dir.exists() {
                            let dll_file = x64_dir.join("WebView2Loader.dll");
                            if dll_file.exists()
                                && !embedded_dest.exists()
                                && dll_file.metadata().map(|m| m.len() > 10_000).unwrap_or(false)
                            {
                                let _ = fs::copy(&dll_file, &embedded_dest);
                            }
                            let _ = fs::remove_file(&dll_file);
                            let _ = fs::remove_file(x64_dir.join("WebView2Loader.dll.lib"));
                            create_empty_ar_archive(&x64_dir.join("libWebView2Loader.dll.a"));
                        }
                    }
                }
            }
        }

        create_empty_ar_archive(&out_dir.join("libWebView2Loader.dll.a"));

        // Force static linking of libunwind by placing static libunwind.a in OUT_DIR as libunwind.dll.a
        if let Ok(rustc) = env::var("RUSTC") {
            if let Some(toolchain_root) = Path::new(&rustc).parent().and_then(|p| p.parent()) {
                let static_unwind = toolchain_root
                    .join("lib")
                    .join("rustlib")
                    .join("x86_64-pc-windows-gnullvm")
                    .join("lib")
                    .join("self-contained")
                    .join("libunwind.a");
                if static_unwind.exists() {
                    let _ = fs::copy(&static_unwind, out_dir.join("libunwind.dll.a"));
                    let _ = fs::copy(&static_unwind, out_dir.join("libunwind.a"));
                }
            }
        }

        println!("cargo:rustc-link-search=native={}", out_dir.display());
    }

    tauri_build::build()
}
