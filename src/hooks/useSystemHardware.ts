import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface CpuInfo {
  name: string;
  cores: number;
  threads: number;
  utilization: number;
}

export interface RamInfo {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  utilization: number;
}

export interface GpuInfo {
  name: string;
  vendor: string;
  vram_total_gb: number;
  vram_used_gb: number;
  utilization: number;
  available: boolean;
}

export interface OsInfo {
  name: string;
  version: string;
}

export interface SystemHardware {
  cpu: CpuInfo;
  ram: RamInfo;
  gpu: GpuInfo;
  os: OsInfo;
}

export function useSystemHardware(refreshIntervalMs = 2000) {
  const [hardware, setHardware] = useState<SystemHardware | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timer: number;

    async function fetchHardware() {
      // Guard: only invoke Tauri commands inside the Tauri desktop shell
      if (!window.__TAURI_INTERNALS__) {
        if (isMounted) {
          setError('Not running inside Tauri desktop shell');
          setLoading(false);
        }
        return;
      }
      try {
        const data = await invoke<SystemHardware>('get_system_hardware');
        if (isMounted) {
          setHardware(data);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to fetch hardware data", err);
          setError(err.toString());
          setLoading(false);
        }
      }
    }

    // Initial fetch
    fetchHardware();

    // Set up polling
    timer = window.setInterval(fetchHardware, refreshIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [refreshIntervalMs]);

  return { hardware, loading, error };
}
