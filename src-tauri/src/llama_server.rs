use std::sync::Mutex;
use std::process::{Command, Child, Stdio};
use std::path::PathBuf;
use tauri::{AppHandle, State};

pub struct LlamaServerState {
    pub process: Mutex<Option<Child>>,
    pub active_model: Mutex<Option<String>>,
}

impl LlamaServerState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            active_model: Mutex::new(None),
        }
    }
}

fn get_possible_dirs(_app: &AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.as_path();
        for _ in 0..5 {
            if let Some(parent) = dir.parent() {
                dirs.push(parent.to_path_buf());
                dir = parent;
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        if !dirs.contains(&cwd) {
            dirs.push(cwd.clone());
        }
        if let Some(parent) = cwd.parent() {
            let parent_buf = parent.to_path_buf();
            if !dirs.contains(&parent_buf) {
                dirs.push(parent_buf);
            }
        }
    }

    dirs
}

#[tauri::command]
pub async fn start_server(
    app: AppHandle,
    state: State<'_, LlamaServerState>,
    model_id: String,
    filename: String,
    ngl: i32,
) -> Result<(), String> {
    let mut process_guard = state.process.lock().unwrap();
    let mut model_guard = state.active_model.lock().unwrap();

    let full_model_id = format!("{}/{}", model_id, filename);

    if let Some(ref mut child) = *process_guard {
        if let Some(ref active) = *model_guard {
            if active == &full_model_id {
                if let Ok(None) = child.try_wait() {
                    return Ok(());
                }
            }
        }
        
        let _ = child.kill();
        let _ = child.wait();
        *process_guard = None;
    }

    let base_dirs = get_possible_dirs(&app);
    let mut model_path_opt = None;
    for base in &base_dirs {
        let path = base.join("models").join(&model_id).join(&filename);
        if path.exists() {
            model_path_opt = Some(path);
            break;
        }
    }

    let model_path = match model_path_opt {
        Some(p) => p,
        None => return Err(format!("Model file not found: {}/{}", model_id, filename)),
    };

    let mut server_exe_opt = None;
    for base in &base_dirs {
        let bin1 = base.join("bin").join("llama-server.exe");
        let bin2 = base.join("llama-bin").join("llama-server.exe");
        if bin1.exists() {
            server_exe_opt = Some(bin1);
            break;
        } else if bin2.exists() {
            server_exe_opt = Some(bin2);
            break;
        }
    }

    let server_exe = match server_exe_opt {
        Some(s) => s,
        None => return Err("llama-server.exe not found in bin or llama-bin".into()),
    };

    let child = Command::new(&server_exe)
        .arg("-m")
        .arg(&model_path)
        .arg("--port")
        .arg("8085")
        .arg("-c")
        .arg("8192")
        .arg("-ngl")
        .arg(ngl.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) 
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

    *process_guard = Some(child);
    *model_guard = Some(full_model_id);

    Ok(())
}

#[tauri::command]
pub async fn stop_server(state: State<'_, LlamaServerState>) -> Result<(), String> {
    let mut process_guard = state.process.lock().unwrap();
    if let Some(ref mut child) = *process_guard {
        let _ = child.kill();
        let _ = child.wait();
    }
    *process_guard = None;
    
    let mut model_guard = state.active_model.lock().unwrap();
    *model_guard = None;
    
    Ok(())
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, LlamaServerState>) -> Result<String, String> {
    let mut process_guard = state.process.lock().unwrap();
    if let Some(ref mut child) = *process_guard {
        if let Ok(None) = child.try_wait() {
            return Ok("running".into());
        }
    }
    Ok("stopped".into())
}

use std::os::windows::process::CommandExt;

