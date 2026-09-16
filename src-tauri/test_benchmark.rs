use std::process::Command;
use std::os::windows::process::CommandExt;

fn main() {
    let cli_path = "C:\\Users\\MAHIL RAM\\OneDrive\\Desktop\\Sovereign AI\\sovereign-ai-workbench\\llama-bin\\llama-cli.exe";
    let model_path = "C:\\Users\\MAHIL RAM\\OneDrive\\Desktop\\Sovereign AI\\sovereign-ai-workbench\\models\\qwen2.5-1.5b\\qwen2.5-1.5b-instruct-q4_k_m.gguf";
    let ngl = 999;
    
    let child = Command::new(cli_path)
        .arg("-m")
        .arg(model_path)
        .arg("-ngl")
        .arg(ngl.to_string())
        .arg("-p")
        .arg("What is AI? Answer in one sentence.")
        .arg("-n")
        .arg("32")
        .arg("-st")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000)
        .spawn()
        .unwrap();

    println!("Waiting for process...");
    let output = child.wait_with_output().unwrap();
    println!("Process finished.");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let full_output = format!("{}\n{}", stdout, stderr);
    
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
    }
    
    println!("Parsed prompt: {:?}", prompt_speed);
    println!("Parsed gen: {:?}", generation_speed);
    println!("Lower output contains error: {}", full_output.to_lowercase().contains("error"));
}
