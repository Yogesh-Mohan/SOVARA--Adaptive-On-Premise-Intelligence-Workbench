use serde::Serialize;
use std::sync::Mutex;
use sysinfo::System;
use nvml_wrapper::Nvml;

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    pub name: String,
    pub cores: usize,
    pub threads: usize,
    pub utilization: f32, // percentage
}

#[derive(Serialize, Clone)]
pub struct RamInfo {
    pub total_gb: f32,
    pub used_gb: f32,
    pub available_gb: f32,
    pub utilization: f32, // percentage
}

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub vram_total_gb: f32,
    pub vram_used_gb: f32,
    pub utilization: f32, // percentage
    pub available: bool,
}

#[derive(Serialize, Clone)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
}

#[derive(Serialize, Clone)]
pub struct SystemHardware {
    pub cpu: CpuInfo,
    pub ram: RamInfo,
    pub gpu: GpuInfo,
    pub os: OsInfo,
}

pub struct HardwareMonitorState {
    pub sys: Mutex<System>,
    pub nvml: Option<Nvml>,
}

impl HardwareMonitorState {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        
        // Attempt to initialize NVML for NVIDIA GPUs
        let nvml = match Nvml::init() {
            Ok(n) => Some(n),
            Err(e) => {
                log::warn!("Failed to initialize NVML: {}. NVIDIA GPU stats will be unavailable.", e);
                None
            }
        };

        Self {
            sys: Mutex::new(sys),
            nvml,
        }
    }
}

#[tauri::command]
pub fn get_system_hardware(state: tauri::State<HardwareMonitorState>) -> SystemHardware {
    let mut sys = state.sys.lock().unwrap();
    
    // Refresh only the necessary components to keep overhead low
    sys.refresh_cpu();
    sys.refresh_memory();

    // CPU Info
    let cpus = sys.cpus();
    let cpu_name = cpus.first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Unknown CPU".to_string());
    let threads = cpus.len();
    let cores = sys.physical_core_count().unwrap_or(threads / 2);
    
    let mut total_cpu_usage = 0.0;
    for cpu in cpus {
        total_cpu_usage += cpu.cpu_usage();
    }
    let avg_cpu_usage = if threads > 0 {
        total_cpu_usage / threads as f32
    } else {
        0.0
    };

    let cpu_info = CpuInfo {
        name: cpu_name,
        cores,
        threads,
        utilization: avg_cpu_usage,
    };

    // RAM Info
    let total_ram_bytes = sys.total_memory();
    let used_ram_bytes = sys.used_memory();
    let available_ram_bytes = sys.available_memory();
    
    // Convert to GB
    let bytes_to_gb = 1024.0 * 1024.0 * 1024.0;
    let total_gb = total_ram_bytes as f32 / bytes_to_gb;
    let used_gb = used_ram_bytes as f32 / bytes_to_gb;
    let available_gb = available_ram_bytes as f32 / bytes_to_gb;
    
    let ram_utilization = if total_gb > 0.0 {
        (used_gb / total_gb) * 100.0
    } else {
        0.0
    };

    let ram_info = RamInfo {
        total_gb: (total_gb * 10.0).round() / 10.0,
        used_gb: (used_gb * 10.0).round() / 10.0,
        available_gb: (available_gb * 10.0).round() / 10.0,
        utilization: ram_utilization.round(),
    };

    // GPU Info (NVIDIA via NVML)
    let mut gpu_info = GpuInfo {
        name: "Unavailable".to_string(),
        vendor: "Unknown".to_string(),
        vram_total_gb: 0.0,
        vram_used_gb: 0.0,
        utilization: 0.0,
        available: false,
    };

    if let Some(nvml) = &state.nvml {
        if let Ok(device) = nvml.device_by_index(0) {
            gpu_info.available = true;
            gpu_info.vendor = "NVIDIA".to_string();
            
            if let Ok(name) = device.name() {
                gpu_info.name = name;
            }
            
            if let Ok(memory) = device.memory_info() {
                gpu_info.vram_total_gb = (memory.total as f32 / bytes_to_gb * 10.0).round() / 10.0;
                gpu_info.vram_used_gb = (memory.used as f32 / bytes_to_gb * 10.0).round() / 10.0;
            }
            
            if let Ok(util) = device.utilization_rates() {
                gpu_info.utilization = util.gpu as f32;
            }
        }
    }

    // OS Info
    let os_name = sysinfo::System::name().unwrap_or_else(|| "Unknown OS".to_string());
    let os_version = sysinfo::System::os_version().unwrap_or_else(|| "".to_string());

    let os_info = OsInfo {
        name: os_name,
        version: os_version,
    };

    SystemHardware {
        cpu: cpu_info,
        ram: ram_info,
        gpu: gpu_info,
        os: os_info,
    }
}
