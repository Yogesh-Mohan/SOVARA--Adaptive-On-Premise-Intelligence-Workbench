use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use reqwest::Client;
use futures_util::StreamExt;
use std::time::Instant;
use tokio::fs::{File, create_dir_all, remove_file};

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub speed_mbps: f64,
    pub eta_seconds: f64,
}

pub struct ModelDownloadState {
    pub cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl ModelDownloadState {
    pub fn new() -> Self {
        Self {
            cancel_flags: Mutex::new(HashMap::new()),
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
pub async fn check_model_exists(app: AppHandle, model_id: String, filename: String) -> Result<bool, String> {
    let base_dirs = get_possible_dirs(&app);
    for base in &base_dirs {
        let path = base.join("models").join(&model_id).join(&filename);
        if path.exists() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn delete_local_model(app: AppHandle, model_id: String, filename: String) -> Result<(), String> {
    let base_dirs = get_possible_dirs(&app);
    for base in &base_dirs {
        let path = base.join("models").join(&model_id).join(&filename);
        if path.exists() {
            remove_file(path).await.map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_model_download(
    state: tauri::State<'_, ModelDownloadState>,
    model_id: String,
) -> Result<(), String> {
    let flags = state.cancel_flags.lock().unwrap();
    if let Some(flag) = flags.get(&model_id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn start_model_download(
    app: AppHandle,
    state: tauri::State<'_, ModelDownloadState>,
    model_id: String,
    repo_id: String,
    filename: String,
) -> Result<(), String> {
    // Setup cancellation flag
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut flags = state.cancel_flags.lock().unwrap();
        flags.insert(model_id.clone(), Arc::clone(&cancel_flag));
    }

    let base_dirs = get_possible_dirs(&app);
    let workspace_root = base_dirs.first().ok_or("Cannot find workspace root")?;
    
    let models_dir = workspace_root.join("models").join(&model_id);
    create_dir_all(&models_dir).await.map_err(|e| e.to_string())?;
    
    let file_path = models_dir.join(&filename);
    let temp_file_path = models_dir.join(format!("{}.download", filename));

    // Prepare HTTP request
    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo_id, filename);
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to download. Status: {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    
    let mut file = File::create(&temp_file_path).await.map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();
    
    let mut downloaded: u64 = 0;
    let mut last_emit_time = Instant::now();
    let mut last_emit_bytes = 0;

    while let Some(chunk_result) = stream.next().await {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            drop(file);
            let _ = remove_file(&temp_file_path).await;
            
            let mut flags = state.cancel_flags.lock().unwrap();
            flags.remove(&model_id);
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk_result.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        
        downloaded += chunk.len() as u64;

        let now = Instant::now();
        let elapsed_since_emit = now.duration_since(last_emit_time).as_secs_f64();
        
        if elapsed_since_emit >= 0.5 {
            let bytes_since_emit = downloaded - last_emit_bytes;
            let speed_bps = bytes_since_emit as f64 / elapsed_since_emit;
            let speed_mbps = speed_bps / (1024.0 * 1024.0);
            
            let percentage = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            };
            
            let eta_seconds = if speed_bps > 0.0 && total_size > downloaded {
                (total_size - downloaded) as f64 / speed_bps
            } else {
                0.0
            };

            let progress = DownloadProgress {
                model_id: model_id.clone(),
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage,
                speed_mbps,
                eta_seconds,
            };

            let _ = app.emit("model-download-progress", progress);
            
            last_emit_time = now;
            last_emit_bytes = downloaded;
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file); 
    
    tokio::fs::rename(&temp_file_path, &file_path).await.map_err(|e| e.to_string())?;
    
    let mut flags = state.cancel_flags.lock().unwrap();
    flags.remove(&model_id);

    let _ = app.emit("model-download-progress", DownloadProgress {
        model_id,
        downloaded_bytes: total_size,
        total_bytes: total_size,
        percentage: 100.0,
        speed_mbps: 0.0,
        eta_seconds: 0.0,
    });

    Ok(())
}
