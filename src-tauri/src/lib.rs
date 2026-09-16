mod hardware;
mod model_downloader;
mod llama_server;
mod llama_runtime;
mod file_reader;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(hardware::HardwareMonitorState::new())
    .manage(model_downloader::ModelDownloadState::new())
    .manage(llama_server::LlamaServerState::new())
    .invoke_handler(tauri::generate_handler![
        hardware::get_system_hardware,
        model_downloader::start_model_download,
        model_downloader::cancel_model_download,
        model_downloader::check_model_exists,
        model_downloader::delete_local_model,
        llama_server::start_server,
        llama_server::stop_server,
        llama_server::get_server_status,
        llama_runtime::detect_runtime,
        llama_runtime::scan_local_models,
        llama_runtime::run_benchmark,
        file_reader::read_file_content
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
