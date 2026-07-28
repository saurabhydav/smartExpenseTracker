// Real LLM Inference Engine — PrismML Bonsai 1.7B via llama.rn (llama.cpp bindings)
// This runs REAL neural network inference on-device. No fake responses.

import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';

// LlamaContext type from llama.rn
type LlamaContext = Awaited<ReturnType<typeof initLlama>>;

const MODEL_DIR = `${RNFS.DocumentDirectoryPath}/models`;

export interface LlmEngineStatus {
    loaded: boolean;
    loading: boolean;
    generating: boolean;
    modelPath: string | null;
    error: string | null;
}

export interface GenerationResult {
    text: string;
    tokensGenerated: number;
    tokensPerSecond: number;
    totalTimeMs: number;
    stopped: boolean;
}

class LlmEngineService {
    private context: LlamaContext | null = null;
    private isLoading: boolean = false;
    private isGenerating: boolean = false;
    private currentModelPath: string | null = null;
    private lastError: string | null = null;

    /**
     * Load a GGUF model from device storage into memory using llama.cpp
     */
    async loadModel(modelPath: string): Promise<boolean> {
        const path = modelPath;

        // Already loaded this model
        if (this.context && this.currentModelPath === path) {
            console.log('[LlmEngine] Model already loaded:', path);
            return true;
        }

        // Prevent concurrent loads
        if (this.isLoading) {
            console.warn('[LlmEngine] Model is already loading, ignoring duplicate request');
            return false;
        }

        this.isLoading = true;
        this.lastError = null;

        try {
            // 1. Verify model file exists on disk
            const exists = await RNFS.exists(path);
            if (!exists) {
                this.lastError = 'Model file not found on device. Please download it first.';
                console.error('[LlmEngine]', this.lastError);
                return false;
            }

            // 2. Check file size is reasonable (at least 50MB for a real model)
            const stat = await RNFS.stat(path);
            const fileSizeMB = Number(stat.size) / (1024 * 1024);
            if (fileSizeMB < 50) {
                this.lastError = `Model file too small (${fileSizeMB.toFixed(1)}MB). File may be corrupted.`;
                console.error('[LlmEngine]', this.lastError);
                return false;
            }

            console.log(`[LlmEngine] Loading model: ${path} (${fileSizeMB.toFixed(0)}MB)`);

            // 3. Unload previous model if any
            if (this.context) {
                try {
                    await this.context.release();
                } catch (e) {
                    console.warn('[LlmEngine] Error releasing previous context:', e);
                }
                this.context = null;
            }

            // 4. Initialize llama.cpp context with the GGUF model
            const context = await initLlama({
                model: path,
                n_ctx: 2048,         // Context window — keep small for mobile RAM
                use_mlock: true,     // Lock model in RAM to prevent swapping
                n_gpu_layers: 0,     // CPU only for maximum compatibility
            });

            this.context = context;
            this.currentModelPath = path;

            console.log(`[LlmEngine] ✅ Model loaded successfully! Context size: 2048`);
            return true;

        } catch (error: any) {
            this.lastError = error?.message || 'Failed to load model — device may not have enough RAM';
            console.error('[LlmEngine] ❌ Model load failed:', error);
            this.context = null;
            this.currentModelPath = null;
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Unload model from memory to free RAM
     */
    async unloadModel(): Promise<void> {
        if (this.context) {
            try {
                await this.context.release();
                console.log('[LlmEngine] Model unloaded, RAM freed');
            } catch (e) {
                console.warn('[LlmEngine] Error unloading model:', e);
            }
            this.context = null;
            this.currentModelPath = null;
        }
    }

    /**
     * Check if model is loaded and ready for inference
     */
    isModelLoaded(): boolean {
        return this.context !== null;
    }

    /**
     * Get current engine status
     */
    getStatus(): LlmEngineStatus {
        return {
            loaded: this.context !== null,
            loading: this.isLoading,
            generating: this.isGenerating,
            modelPath: this.currentModelPath,
            error: this.lastError,
        };
    }

    /**
     * Build a Qwen3/Bonsai chat prompt from messages
     * Uses <|im_start|> / <|im_end|> chat template format
     */
    private buildChatPrompt(
        systemPrompt: string,
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    ): string {
        let prompt = '';

        // System message
        prompt += `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

        // Chat history (last 6 turns max to fit in context)
        const recentHistory = chatHistory.slice(-6);
        for (const msg of recentHistory) {
            prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
        }

        // Current user message
        prompt += `<|im_start|>user\n${userMessage}<|im_end|>\n`;

        // Start assistant response
        prompt += `<|im_start|>assistant\n`;

        return prompt;
    }

    /**
     * Generate a response using REAL neural network inference via llama.cpp
     * Supports token-by-token streaming via onToken callback
     */
    async generateResponse(
        systemPrompt: string,
        userMessage: string,
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
        onToken?: (token: string) => void
    ): Promise<GenerationResult> {
        // Validate model is loaded
        if (!this.context) {
            throw new Error('Model not loaded. Call loadModel() first.');
        }

        // Prevent concurrent generation
        if (this.isGenerating) {
            throw new Error('Already generating a response. Cancel the current one first.');
        }

        this.isGenerating = true;
        const startTime = Date.now();

        try {
            // Build the chat prompt using Qwen3 template
            const prompt = this.buildChatPrompt(systemPrompt, userMessage, chatHistory);

            console.log(`[LlmEngine] Starting inference... (prompt length: ${prompt.length} chars)`);

            // Create a timeout promise (45 seconds max)
            const timeoutMs = 45000;
            let timeoutId: ReturnType<typeof setTimeout>;
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    this.cancelGeneration();
                    reject(new Error('Generation timed out after 45 seconds'));
                }, timeoutMs);
            });

            // Run REAL neural network inference via llama.cpp
            const completionPromise = this.context.completion(
                {
                    prompt,
                    n_predict: 512,     // Max tokens to generate
                    stop: ['<|im_end|>', '<|endoftext|>', '<|im_start|>'],
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                },
                (data: { token: string }) => {
                    // Streaming callback — fires for each generated token
                    if (onToken && data.token) {
                        onToken(data.token);
                    }
                }
            );

            // Race between completion and timeout
            const result = await Promise.race([completionPromise, timeoutPromise]);
            clearTimeout(timeoutId!);

            const totalTimeMs = Date.now() - startTime;
            const tokensGenerated = result.timings?.predicted_n || 0;
            const tokensPerSecond = result.timings?.predicted_per_second || 
                (tokensGenerated > 0 ? (tokensGenerated / (totalTimeMs / 1000)) : 0);

            console.log(`[LlmEngine] ✅ Generation complete: ${tokensGenerated} tokens in ${(totalTimeMs / 1000).toFixed(1)}s (${tokensPerSecond.toFixed(1)} tok/s)`);

            return {
                text: result.text || '',
                tokensGenerated,
                tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
                totalTimeMs,
                stopped: Boolean(result.stopped_eos || result.stopped_limit),
            };

        } catch (error: any) {
            const totalTimeMs = Date.now() - startTime;
            console.error('[LlmEngine] ❌ Generation error:', error);

            return {
                text: '',
                tokensGenerated: 0,
                tokensPerSecond: 0,
                totalTimeMs,
                stopped: true,
            };
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Cancel an active generation
     */
    cancelGeneration(): void {
        if (this.context && this.isGenerating) {
            try {
                this.context.stopCompletion();
                console.log('[LlmEngine] Generation cancelled');
            } catch (e) {
                console.warn('[LlmEngine] Error cancelling generation:', e);
            }
        }
    }
}

// Export singleton instance
export const llmEngine = new LlmEngineService();
