// Real Multi-Model Downloader for Bonsai LLMs (Standard Q4_K_M GGUF format)

import RNFS from 'react-native-fs';

export interface BonsaiDownloadProgress {
    bytesWritten: number;
    contentLength: number;
    percent: number;
    speedMbps: number;
    remainingSeconds: number;
}

export type BonsaiModelStatus =
    | 'NOT_DOWNLOADED'
    | 'DOWNLOADING'
    | 'PAUSED'
    | 'VERIFYING'
    | 'READY'
    | 'LOADING_MODEL'
    | 'MODEL_LOADED'
    | 'ERROR';

export interface BonsaiModelMetadata {
    id: string;
    modelName: string;
    modelFamily: string;
    architecture: string;
    description: string;
    targetDevice: string;
    parameters: string;
    quantization: string;
    expectedSizeBytes: number;
    expectedSizeMB: number;
    localFileName: string;
    localPath: string;
    tempPath: string;
    downloadUrl: string;
    ramRequired: string;
    minRamGB: number;
    minFreeStorageMB: number;
}

// 3 Real Bonsai Models Metadata
export const BONSAI_MODELS: BonsaiModelMetadata[] = [
    {
        id: 'bonsai-360m',
        modelName: 'Bonsai 360M (Fast & Lightweight)',
        modelFamily: 'Bonsai / SmolLM2',
        architecture: 'llama',
        description: 'Fast, battery efficient offline AI engine. Highly optimized for all smartphones.',
        targetDevice: 'All Phones (1GB+ RAM)',
        parameters: '360M',
        quantization: 'Q4_K_M (GGUF)',
        expectedSizeBytes: 270589952,
        expectedSizeMB: 271,
        localFileName: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
        localPath: `${RNFS.DocumentDirectoryPath}/models/SmolLM2-360M-Instruct-Q4_K_M.gguf`,
        tempPath: `${RNFS.DocumentDirectoryPath}/models/SmolLM2-360M-Instruct-Q4_K_M.part`,
        downloadUrl: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf?download=true',
        ramRequired: '~0.5 GB RAM',
        minRamGB: 1.0,
        minFreeStorageMB: 500,
    },
    {
        id: 'bonsai-1.5b',
        modelName: 'Bonsai 1.5B (High Intelligence)',
        modelFamily: 'Bonsai / Qwen2.5',
        architecture: 'qwen2',
        description: 'Deep financial reasoning engine for detailed budget analysis and complex queries.',
        targetDevice: 'Mid-Range (4GB+ RAM)',
        parameters: '1.5B',
        quantization: 'Q4_K_M (GGUF)',
        expectedSizeBytes: 986000000,
        expectedSizeMB: 980,
        localFileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        localPath: `${RNFS.DocumentDirectoryPath}/models/qwen2.5-1.5b-instruct-q4_k_m.gguf`,
        tempPath: `${RNFS.DocumentDirectoryPath}/models/qwen2.5-1.5b-instruct-q4_k_m.part`,
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true',
        ramRequired: '~2.0 GB RAM',
        minRamGB: 3.5,
        minFreeStorageMB: 2500,
    },
    {
        id: 'bonsai-3b',
        modelName: 'Bonsai 3B (Pro Financial Engine)',
        modelFamily: 'Bonsai / Llama3.2',
        architecture: 'llama',
        description: 'Maximum financial reasoning capacity & multi-turn contextual assistant capabilities.',
        targetDevice: 'Flagship Phones (8GB+ RAM)',
        parameters: '3.2B',
        quantization: 'Q4_K_M (GGUF)',
        expectedSizeBytes: 2020000000,
        expectedSizeMB: 2020,
        localFileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        localPath: `${RNFS.DocumentDirectoryPath}/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf`,
        tempPath: `${RNFS.DocumentDirectoryPath}/models/Llama-3.2-3B-Instruct-Q4_K_M.part`,
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf?download=true',
        ramRequired: '~4.0 GB RAM',
        minRamGB: 6.0,
        minFreeStorageMB: 5000,
    },
];

export const BONSAI_MODEL = BONSAI_MODELS[0];

class BonsaiModelDownloaderEngine {
    private activeDownloadId: number | null = null;
    private status: BonsaiModelStatus = 'NOT_DOWNLOADED';
    private activeModel: BonsaiModelMetadata = BONSAI_MODELS[0];
    private lastBytes = 0;
    private lastTime = Date.now();
    private lastProgressTime = 0;
    private speedSamples: number[] = [];
    private statusListeners = new Set<(status: BonsaiModelStatus, error?: string) => void>();
    private progressListeners = new Set<(progress: BonsaiDownloadProgress) => void>();

    constructor() {
        this.ensureModelsDirectory();
    }

    private async ensureModelsDirectory(): Promise<void> {
        try {
            const dir = `${RNFS.DocumentDirectoryPath}/models`;
            const exists = await RNFS.exists(dir);
            if (!exists) {
                await RNFS.mkdir(dir);
            }
        } catch (e) {
            console.error('[BonsaiDownloader] Error creating models directory:', e);
        }
    }

    async getFreeStorageMB(): Promise<number> {
        try {
            const info = await RNFS.getFSInfo();
            return Math.round(info.freeSpace / (1024 * 1024));
        } catch {
            return 2048;
        }
    }

    async checkModelCompatibility(model: BonsaiModelMetadata): Promise<{ isCompatible: boolean; reason?: string }> {
        const freeStorage = await this.getFreeStorageMB();
        if (freeStorage < model.minFreeStorageMB) {
            return {
                isCompatible: false,
                reason: `Requires at least ${(model.minFreeStorageMB / 1024).toFixed(1)} GB free storage space (Free: ${freeStorage} MB).`
            };
        }

        // Note: minRamGB check for heavy 3B models
        if (model.minRamGB > 4.0) {
            console.log(`[BonsaiDownloader] Model ${model.modelName} requires high device RAM (${model.minRamGB}GB).`);
        }

        return { isCompatible: true };
    }

    async checkSpecificModelStatus(model: BonsaiModelMetadata): Promise<BonsaiModelStatus> {
        try {
            await this.ensureModelsDirectory();
            const exists = await RNFS.exists(model.localPath);
            if (exists) {
                const stat = await RNFS.stat(model.localPath);
                const fileSize = Number(stat.size);
                const minSizeBytes = model.expectedSizeBytes - 500_000;

                if (fileSize >= minSizeBytes) {
                    return 'READY';
                } else {
                    console.warn(`[BonsaiDownloader] Incomplete file found for ${model.modelName} (${fileSize} bytes). Unlinking...`);
                    await RNFS.unlink(model.localPath);
                }
            }

            const partExists = await RNFS.exists(model.tempPath);
            if (partExists) return 'PAUSED';

            return 'NOT_DOWNLOADED';
        } catch (e) {
            return 'NOT_DOWNLOADED';
        }
    }

    async checkModelStatus(): Promise<BonsaiModelStatus> {
        return this.checkSpecificModelStatus(this.activeModel);
    }

    async deleteSpecificModel(model: BonsaiModelMetadata): Promise<void> {
        try {
            if (this.activeDownloadId !== null) {
                RNFS.stopDownload(this.activeDownloadId);
                this.activeDownloadId = null;
            }
            const exists = await RNFS.exists(model.localPath);
            if (exists) await RNFS.unlink(model.localPath);

            const partExists = await RNFS.exists(model.tempPath);
            if (partExists) await RNFS.unlink(model.tempPath);

            if (this.activeModel.id === model.id) {
                this.setStatus('NOT_DOWNLOADED');
            }
        } catch (e) {
            console.error('[BonsaiDownloader] Delete specific model error:', e);
        }
    }

    async deleteModel(): Promise<void> {
        return this.deleteSpecificModel(this.activeModel);
    }

    async startSpecificDownload(
        model: BonsaiModelMetadata,
        onStatus?: (st: BonsaiModelStatus) => void
    ): Promise<void> {
        this.activeModel = model;
        await this.ensureModelsDirectory();

        const comp = await this.checkModelCompatibility(model);
        if (!comp.isCompatible) {
            throw new Error(comp.reason || 'Device not compatible with this model.');
        }

        if (onStatus) onStatus('DOWNLOADING');
        this.setStatus('DOWNLOADING');

        this.lastBytes = 0;
        this.lastTime = Date.now();
        this.speedSamples = [];

        let highestBytesWritten = 0;
        const partExists = await RNFS.exists(model.tempPath);
        if (partExists) {
            const stat = await RNFS.stat(model.tempPath);
            highestBytesWritten = Number(stat.size);
        }

        const maxRetries = 25;
        let attempt = 0;
        let isSuccess = false;

        while (attempt < maxRetries && !isSuccess) {
            attempt++;
            try {
                let existingBytes = 0;
                const partStatExists = await RNFS.exists(model.tempPath);
                if (partStatExists) {
                    const stat = await RNFS.stat(model.tempPath);
                    existingBytes = Number(stat.size);
                    highestBytesWritten = Math.max(highestBytesWritten, existingBytes);
                }

                // If already completed or close enough, move file and finish
                if (existingBytes >= model.expectedSizeBytes - 500_000) {
                    const destExists = await RNFS.exists(model.localPath);
                    if (destExists) await RNFS.unlink(model.localPath);
                    await RNFS.moveFile(model.tempPath, model.localPath);
                    if (onStatus) onStatus('READY');
                    this.setStatus('READY');
                    isSuccess = true;
                    break;
                }

                const headers: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; SM-E146B) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
                };

                // Resume from existing bytes using Range header if partial file exists
                if (existingBytes > 0) {
                    headers['Range'] = `bytes=${existingBytes}-`;
                    console.log(`[BonsaiDownloader] Resuming download attempt #${attempt} from byte ${existingBytes}...`);
                }

                const ret = RNFS.downloadFile({
                    fromUrl: model.downloadUrl,
                    toFile: model.tempPath,
                    headers,
                    connectionTimeout: 60000,
                    readTimeout: 60000,
                    background: true,
                    discretionary: true,
                    progress: (res) => {
                        const now = Date.now();
                        const timeDiff = (now - this.lastTime) / 1000;
                        let speedMbps = 0;

                        if (timeDiff >= 0.5) {
                            const bytesDiff = Math.max(0, res.bytesWritten - this.lastBytes);
                            const currentSpeed = (bytesDiff / (1024 * 1024)) / timeDiff;

                            this.speedSamples.push(currentSpeed);
                            if (this.speedSamples.length > 5) this.speedSamples.shift();
                            speedMbps = this.speedSamples.reduce((a: number, b: number) => a + b, 0) / this.speedSamples.length;

                            this.lastBytes = res.bytesWritten;
                            this.lastTime = now;
                        }

                        // Ensure currentBytesOnDisk is strictly monotonic (never jumps backward)
                        const calculatedBytes = existingBytes + res.bytesWritten;
                        highestBytesWritten = Math.max(highestBytesWritten, calculatedBytes);
                        const currentBytesOnDisk = highestBytesWritten;

                        const totalExpected = model.expectedSizeBytes;
                        const isFinal = currentBytesOnDisk >= totalExpected;

                        // Throttle React state updates to once every 400ms
                        if (!isFinal && now - this.lastProgressTime < 400) {
                            return;
                        }
                        this.lastProgressTime = now;

                        const rawPercent = Math.round((currentBytesOnDisk / totalExpected) * 100);
                        const percent = Math.min(99, Math.max(1, rawPercent));
                        const remainingBytes = Math.max(0, totalExpected - currentBytesOnDisk);
                        const remainingSeconds = speedMbps > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMbps) : 0;

                        const progressPayload: BonsaiDownloadProgress = {
                            bytesWritten: currentBytesOnDisk,
                            contentLength: totalExpected,
                            percent: isFinal ? 100 : percent,
                            speedMbps: Math.round(speedMbps * 100) / 100,
                            remainingSeconds,
                        };

                        this.progressListeners.forEach(listener => {
                            try { listener(progressPayload); } catch (e) {}
                        });
                    },
                });

                this.activeDownloadId = ret.jobId;
                const result = await ret.promise;

                if (result.statusCode === 200 || result.statusCode === 206) {
                    const stat = await RNFS.stat(model.tempPath);
                    const fileSize = Number(stat.size);
                    const minSizeBytes = model.expectedSizeBytes - 500_000;

                    if (fileSize >= minSizeBytes) {
                        const destExists = await RNFS.exists(model.localPath);
                        if (destExists) await RNFS.unlink(model.localPath);
                        await RNFS.moveFile(model.tempPath, model.localPath);
                        if (onStatus) onStatus('READY');
                        this.setStatus('READY');
                        isSuccess = true;
                        break;
                    } else {
                        console.warn(`[BonsaiDownloader] Attempt #${attempt} completed but file is incomplete (${fileSize} bytes). Retrying...`);
                        await new Promise(r => setTimeout(r, 1500));
                    }
                } else if (result.statusCode === 416) {
                    // Range Not Satisfiable — temp file is complete!
                    const destExists = await RNFS.exists(model.localPath);
                    if (destExists) await RNFS.unlink(model.localPath);
                    await RNFS.moveFile(model.tempPath, model.localPath);
                    if (onStatus) onStatus('READY');
                    this.setStatus('READY');
                    isSuccess = true;
                    break;
                } else {
                    console.warn(`[BonsaiDownloader] Download HTTP ${result.statusCode}. Retrying attempt #${attempt}...`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (e: any) {
                const msg = e?.message || e?.toString() || '';
                if (msg.includes('aborted') || msg.includes('cancelled')) {
                    if (onStatus) onStatus('PAUSED');
                    this.setStatus('PAUSED');
                    return;
                }
                console.warn(`[BonsaiDownloader] Attempt #${attempt} hit transient network error: ${msg}. Auto-retrying...`);
                await new Promise(r => setTimeout(r, Math.min(10000, attempt * 1500)));
            } finally {
                this.activeDownloadId = null;
            }
        }

        if (!isSuccess && this.status !== 'PAUSED') {
            if (onStatus) onStatus('ERROR');
            this.setStatus('ERROR', 'Download failed after multiple retries.');
        }
    }

    async startDownload(): Promise<void> {
        return this.startSpecificDownload(this.activeModel);
    }

    async pauseDownload(): Promise<void> {
        if (this.activeDownloadId !== null) {
            RNFS.stopDownload(this.activeDownloadId);
            this.activeDownloadId = null;
        }
        this.setStatus('PAUSED');
    }

    public getStatus(): BonsaiModelStatus {
        return this.status;
    }

    public getModelPath(): string {
        return this.activeModel.localPath;
    }

    public getActiveModelId(): string {
        return this.activeModel.id;
    }

    async isAnyModelDownloaded(): Promise<boolean> {
        try {
            for (const model of BONSAI_MODELS) {
                const exists = await RNFS.exists(model.localPath);
                if (exists) {
                    const stat = await RNFS.stat(model.localPath);
                    const fileSize = Number(stat.size);
                    const minSizeBytes = model.expectedSizeBytes - 500_000;
                    if (fileSize >= minSizeBytes) {
                        return true;
                    }
                }
            }
            return false;
        } catch {
            return false;
        }
    }

    public addProgressListener(cb: (progress: BonsaiDownloadProgress) => void): () => void {
        this.progressListeners.add(cb);
        return () => this.progressListeners.delete(cb);
    }

    public addStatusListener(cb: (status: BonsaiModelStatus, error?: string) => void): () => void {
        this.statusListeners.add(cb);
        return () => this.statusListeners.delete(cb);
    }

    public setProgressCallback(cb: (progress: BonsaiDownloadProgress) => void) {
        this.addProgressListener(cb);
    }

    public setStatusCallback(cb: (status: BonsaiModelStatus, error?: string) => void) {
        this.addStatusListener(cb);
    }

    private setStatus(newStatus: BonsaiModelStatus, error?: string) {
        this.status = newStatus;
        this.statusListeners.forEach(listener => {
            try { listener(newStatus, error); } catch (e) {}
        });
    }
}

export const BonsaiModelDownloader = new BonsaiModelDownloaderEngine();
