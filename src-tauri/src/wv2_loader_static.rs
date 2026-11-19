//! Self-contained static WebView2Loader bridge for non-MSVC Windows targets.
//! Embeds WebView2Loader.dll directly inside Enkel.exe so the portable executable
//! requires zero external DLL files alongside it.

use std::env;
use std::ffi::{c_int, c_void};
use std::fs;
use std::sync::OnceLock;

static EMBEDDED_WV2_DLL: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/WebView2Loader_embedded.dll"));

type HResult = i32;
type PCWSTR = *const u16;
type LPWSTR = *mut u16;
type HModule = *mut c_void;
type FarProc = *const c_void;

#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryW(lpLibFileName: PCWSTR) -> HModule;
    fn GetProcAddress(hModule: HModule, lpProcName: *const u8) -> FarProc;
}

struct SendModule(HModule);
unsafe impl Send for SendModule {}
unsafe impl Sync for SendModule {}

static WV2_MODULE: OnceLock<SendModule> = OnceLock::new();

fn get_wv2_module() -> HModule {
    WV2_MODULE
        .get_or_init(|| {
            let dll_path = env::temp_dir().join("Enkel_WebView2Loader_1_0.dll");
            let needs_write = match fs::metadata(&dll_path) {
                Ok(meta) => meta.len() != EMBEDDED_WV2_DLL.len() as u64,
                Err(_) => true,
            };
            if needs_write {
                let _ = fs::write(&dll_path, EMBEDDED_WV2_DLL);
            }
            let wide: Vec<u16> = dll_path
                .to_string_lossy()
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let h = unsafe { LoadLibraryW(wide.as_ptr()) };
            SendModule(h)
        })
        .0
}

#[no_mangle]
pub unsafe extern "system" fn CreateCoreWebView2EnvironmentWithOptions(
    browser_executable_folder: PCWSTR,
    user_data_folder: PCWSTR,
    environment_options: *mut c_void,
    environment_created_handler: *mut c_void,
) -> HResult {
    type FnType = unsafe extern "system" fn(PCWSTR, PCWSTR, *mut c_void, *mut c_void) -> HResult;
    let h = get_wv2_module();
    let sym = GetProcAddress(h, b"CreateCoreWebView2EnvironmentWithOptions\0".as_ptr());
    if sym.is_null() {
        return -2147467259; // E_FAIL
    }
    let func: FnType = std::mem::transmute(sym);
    func(
        browser_executable_folder,
        user_data_folder,
        environment_options,
        environment_created_handler,
    )
}

#[no_mangle]
pub unsafe extern "system" fn CreateCoreWebView2Environment(
    environment_created_handler: *mut c_void,
) -> HResult {
    type FnType = unsafe extern "system" fn(*mut c_void) -> HResult;
    let h = get_wv2_module();
    let sym = GetProcAddress(h, b"CreateCoreWebView2Environment\0".as_ptr());
    if sym.is_null() {
        return -2147467259;
    }
    let func: FnType = std::mem::transmute(sym);
    func(environment_created_handler)
}

#[no_mangle]
pub unsafe extern "system" fn GetAvailableCoreWebView2BrowserVersionString(
    browser_executable_folder: PCWSTR,
    version_info: *mut LPWSTR,
) -> HResult {
    type FnType = unsafe extern "system" fn(PCWSTR, *mut LPWSTR) -> HResult;
    let h = get_wv2_module();
    let sym = GetProcAddress(h, b"GetAvailableCoreWebView2BrowserVersionString\0".as_ptr());
    if sym.is_null() {
        return -2147467259;
    }
    let func: FnType = std::mem::transmute(sym);
    func(browser_executable_folder, version_info)
}

#[no_mangle]
pub unsafe extern "system" fn GetAvailableCoreWebView2BrowserVersionStringWithOptions(
    browser_executable_folder: PCWSTR,
    environment_options: *mut c_void,
    version_info: *mut LPWSTR,
) -> HResult {
    type FnType = unsafe extern "system" fn(PCWSTR, *mut c_void, *mut LPWSTR) -> HResult;
    let h = get_wv2_module();
    let sym = GetProcAddress(
        h,
        b"GetAvailableCoreWebView2BrowserVersionStringWithOptions\0".as_ptr(),
    );
    if sym.is_null() {
        return -2147467259;
    }
    let func: FnType = std::mem::transmute(sym);
    func(browser_executable_folder, environment_options, version_info)
}

#[no_mangle]
pub unsafe extern "system" fn CompareBrowserVersions(
    version1: PCWSTR,
    version2: PCWSTR,
    result: *mut c_int,
) -> HResult {
    type FnType = unsafe extern "system" fn(PCWSTR, PCWSTR, *mut c_int) -> HResult;
    let h = get_wv2_module();
    let sym = GetProcAddress(h, b"CompareBrowserVersions\0".as_ptr());
    if sym.is_null() {
        return -2147467259;
    }
    let func: FnType = std::mem::transmute(sym);
    func(version1, version2, result)
}
