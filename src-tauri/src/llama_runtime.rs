
use std::process::Command;
use std::path::PathBuf;
use tauri::AppHandle;
use serde::Serialize;
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct RuntimeDetectionResult {
    pub cli_path: Option<String>,
    pub server_path: Option<String>,
    pub cuda_available: bool,
}

#[derive(Serialize, Debug)]
pub struct BenchmarkResult {
    pub load_success: bool,
    pub prompt_speed: Option<f32>,
    pub generation_speed: Option<f32>,
    pub error_msg: Option<String>,
}

fn get_possible_dirs(_app: &AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // Walk up from the running executable's location.
    // In dev mode:  target\debug\app.exe  →  target\debug → target → <workspace root>
    // In release:   the install dir itself is the workspace root.
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.as_path();
        // Walk up at most 5 levels looking for the workspace root
        for _ in 0..5 {
            if let Some(parent) = dir.parent() {
                dirs.push(parent.to_path_buf());
                dir = parent;
            }
        }
    }

    // Also include cwd (may be correct in some launch configurations)
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
pub fn detect_runtime(app: AppHandle) -> Result<RuntimeDetectionResult, String> {
    let base_dirs = get_possible_dirs(&app);
    
    let mut bin_dirs = Vec::new();
    for base in &base_dirs {
        bin_dirs.push(base.join("bin"));
        bin_dirs.push(base.join("llama-bin"));
    }
    
    let mut cli_path = None;
    let mut server_path = None;
    let mut cuda_available = false;

    for dir in bin_dirs {
        let cli = dir.join("llama-cli.exe");
        let server = dir.join("llama-server.exe");
        
        if cli.exists() && cli_path.is_none() {
            cli_path = Some(cli.to_string_lossy().to_string());
            
            let output = Command::new(&cli)
                .arg("--list-devices")
                .creation_flags(0x08000000)
                .output();
                
            if let Ok(out) = output {
                let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();
                let stderr = String::from_utf8_lossy(&out.stderr).to_lowercase();
                if stdout.contains("cuda") || stdout.contains("nvidia") || stderr.contains("cuda") || stderr.contains("nvidia") {
                    cuda_available = true;
                }
            }
        }
        if server.exists() && server_path.is_none() {
            server_path = Some(server.to_string_lossy().to_string());
        }
    }

    Ok(RuntimeDetectionResult {
        cli_path,
        server_path,
        cuda_available,
    })
}

#[tauri::command]
pub fn scan_local_models(app: AppHandle, model_id: String) -> Result<Vec<String>, String> {
    let base_dirs = get_possible_dirs(&app);
    
    let mut variants = Vec::new();
    for base in base_dirs {
        let model_dir = base.join("models").join(&model_id);
        if model_dir.exists() && model_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(model_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext == "gguf" {
                                if let Some(name) = path.file_name() {
                                    let filename = name.to_string_lossy().to_string();
                                    if !variants.contains(&filename) {
                                        variants.push(filename);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(variants)
}

#[tauri::command]
pub fn run_benchmark(app: AppHandle, model_id: String, variant: String, ngl: i32) -> Result<BenchmarkResult, String> {
    let detect = detect_runtime(app.clone()).unwrap_or(RuntimeDetectionResult { cli_path: None, server_path: None, cuda_available: false });
    let cli_path = match detect.cli_path {
        Some(p) => p,
        None => return Err("LLAMA_CPP_NOT_FOUND".into()),
    };

    let base_dirs = get_possible_dirs(&app);
    let mut model_path_opt = None;
    for base in base_dirs {
        let path = base.join("models").join(&model_id).join(&variant);
        if path.exists() {
            model_path_opt = Some(path);
            break;
        }
    }

    let model_path = match model_path_opt {
        Some(p) => p,
        None => return Err(format!("MODEL_NOT_FOUND: {}", variant)),
    };

    use std::process::Stdio;
    
    let child = Command::new(&cli_path)
        .arg("-m")
        .arg(&model_path)
        .arg("-ngl")
        .arg(ngl.to_string())
        .arg("-p")
        .arg("What is AI? Answer in one sentence.")
        .arg("-n")
        .arg("32")
        .arg("-st")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000)
        .spawn();

    let child = match child {
        Ok(c) => c,
        Err(_) => return Err("PROCESS_EXECUTION_FAILED".into()),
    };

    // Wait for the process with a timeout (60 seconds)
    let timeout = std::time::Duration::from_secs(60);
    let start = std::time::Instant::now();
    
    let output = match child.wait_with_output() {
        Ok(o) => {
            if start.elapsed() > timeout {
                return Ok(BenchmarkResult {
                    load_success: false,
                    prompt_speed: None,
                    generation_speed: None,
                    error_msg: Some("CPU_INFERENCE_FAILED: Timeout".into()),
                });
            }
            o
        },
        Err(_) => return Err("PROCESS_EXECUTION_FAILED".into()),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let full_output = format!("{}\n{}", stdout, stderr);

    let lower_output = full_output.to_lowercase();
    
    // Check for explicit loading errors
    if lower_output.contains("error loading model") 
        || lower_output.contains("failed to load model")
        || lower_output.contains("model is corrupted")
        || lower_output.contains("not within the file bounds") {
        return Ok(BenchmarkResult {
            load_success: false,
            prompt_speed: None,
            generation_speed: None,
            error_msg: Some("MODEL_LOAD_FAILED".into()),
        });
    }
    
    // Check for CUDA/GPU errors specifically
    if ngl > 0 && (lower_output.contains("cuda error") || lower_output.contains("out of memory") || lower_output.contains("ggml_cuda")) {
        return Ok(BenchmarkResult {
            load_success: false,
            prompt_speed: None,
            generation_speed: None,
            error_msg: Some("GPU_OFFLOAD_FAILED".into()),
        });
    }

    let mut prompt_speed: Option<f32> = None;
    let mut generation_speed: Option<f32> = None;

    for line in full_output.lines() {
        if line.contains("Prompt:") && line.contains("t/s") {
            if let Some(idx) = line.find("Prompt:") {
                let after = &line[idx + 7..];
                let cleaned: String = after.chars()
                    .take_while(|c| *c != 't')
                    .collect();
                if let Ok(val) = cleaned.trim().parse::<f32>() {
                    prompt_speed = Some(val);
                }
            }
        }
        if line.contains("Generation:") && line.contains("t/s") {
            if let Some(idx) = line.find("Generation:") {
                let after = &line[idx + 11..];
                let cleaned: String = after.chars()
                    .take_while(|c| *c != 't')
                    .collect();
                if let Ok(val) = cleaned.trim().parse::<f32>() {
                    generation_speed = Some(val);
                }
            }
        }
        if line.contains("eval time") && line.contains("t/s") {
            if let Some(paren_start) = line.rfind('(') {
                let after_paren = &line[paren_start + 1..];
                let num_str: String = after_paren.chars()
                    .take_while(|c| c.is_ascii_digit() || *c == '.')
                    .collect();
                if let Ok(val) = num_str.parse::<f32>() {
                    if line.contains("prompt eval time") {
                        prompt_speed = Some(val);
                    } else {
                        generation_speed = Some(val);
                    }
                }
            }
        }
    }

    let load_success = generation_speed.is_some() || prompt_speed.is_some() || output.status.success();

    let result = BenchmarkResult {
        load_success,
        prompt_speed,
        generation_speed,
        error_msg: if load_success { None } else { Some(if ngl > 0 { "GPU_OFFLOAD_FAILED".into() } else { "CPU_INFERENCE_FAILED".into() }) },
    };
    Ok(result)
}
