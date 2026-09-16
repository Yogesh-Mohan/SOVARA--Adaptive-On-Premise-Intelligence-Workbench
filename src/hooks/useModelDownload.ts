import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DownloadProgress {
    model_id: string;
    downloaded_bytes: number;
    total_bytes: number;
    percentage: number;
    speed_mbps: number;
    eta_seconds: number;
}

export type DownloadStatus = 'Not Downloaded' | 'Downloading' | 'Downloaded' | 'Error';

export function useModelDownload(modelId: string, filename: string) {
    const [status, setStatus] = useState<DownloadStatus>('Not Downloaded');
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkExists = useCallback(async () => {
        try {
            const exists = await invoke<boolean>('check_model_exists', { modelId, filename });
            if (exists) {
                setStatus('Downloaded');
            } else if (status === 'Downloaded') {
                setStatus('Not Downloaded');
            }
        } catch (e) {
            console.error("Failed to check model existence", e);
        }
    }, [filename, status]);

    useEffect(() => {
        checkExists();
    }, [checkExists]);

    useEffect(() => {
        const unlisten = listen<DownloadProgress>('model-download-progress', (event) => {
            if (event.payload.model_id === modelId) {
                setProgress(event.payload);
                if (event.payload.percentage === 100) {
                    setStatus('Downloaded');
                    setProgress(null);
                } else {
                    setStatus('Downloading');
                }
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [modelId]);

    const startDownload = async (repoId: string) => {
        try {
            setStatus('Downloading');
            setError(null);
            setProgress({
                model_id: modelId,
                downloaded_bytes: 0,
                total_bytes: 0,
                percentage: 0,
                speed_mbps: 0,
                eta_seconds: 0
            });
            await invoke('start_model_download', {
                modelId,
                repoId,
                filename
            });
        } catch (e: any) {
            if (e !== "Download cancelled") {
                setError(e.toString());
                setStatus('Error');
            }
        }
    };

    const cancelDownload = async () => {
        try {
            await invoke('cancel_model_download', { modelId });
            setStatus('Not Downloaded');
            setProgress(null);
        } catch (e) {
            console.error("Failed to cancel download", e);
        }
    };

    const deleteModel = async () => {
        try {
            await invoke('delete_local_model', { modelId, filename });
            setStatus('Not Downloaded');
            setProgress(null);
        } catch (e) {
            console.error("Failed to delete model", e);
        }
    };

    return {
        status,
        progress,
        error,
        startDownload,
        cancelDownload,
        deleteModel,
        checkExists
    };
}
