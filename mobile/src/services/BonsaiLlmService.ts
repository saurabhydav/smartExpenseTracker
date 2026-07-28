// On-Device LLM Service — Pure 100% Neural Network Execution via llama.rn
// NO fake responses, NO rule-based fallbacks. 100% real LLM inference.

import { llmEngine, GenerationResult } from './LlmEngine';
import { getFullAppContext, getAllInsights } from './AIAdvisorService';
import { BonsaiModelDownloader, BONSAI_MODEL } from './BonsaiModelDownloader';

export interface ChatHistoryMessage {
    sender: 'user' | 'ai';
    text: string;
}

export const BONSAI_CONFIG = {
    modelName: BONSAI_MODEL.modelName,
    modelFamily: BONSAI_MODEL.modelFamily,
    parameters: BONSAI_MODEL.parameters,
    quantization: BONSAI_MODEL.quantization,
    sizeMB: BONSAI_MODEL.expectedSizeMB,
    architecture: BONSAI_MODEL.architecture,
    isOffline: true,
};

/**
 * Build a comprehensive financial system prompt for the LLM
 */
async function buildFinancialSystemPrompt(userId: number): Promise<string> {
    try {
        const context = await getFullAppContext(userId);
        const insights = await getAllInsights(userId);

        const topInsights = insights
            .slice(0, 5)
            .map(i => `- ${i.message}`)
            .join('\n');

        return `You are a Smart Financial Assistant running 100% offline on the user's phone. You have access to their logged financial data:

CRITICAL IDENTITY & SAFETY RULES:
- You are a Financial Assistant, NOT an advisor.
- NEVER call yourself an "advisor", "financial advisor", or "AI advisor" under any circumstances.
- NEVER provide professional financial, investment, legal, or tax advice. You only summarize logged expenses and track budget statistics.
- If asked for investment advice, stock picks, or financial recommendations, politely remind the user: "I am a financial tracking assistant, not a financial advisor."

REAL APP FINANCIAL DATA:
${context.summaryText}

KEY INSIGHTS:
${topInsights || '- No specific insights available.'}

RULES:
- Answer the user's question using ONLY the real financial data above.
- Be concise, direct, and helpful.
- Reference actual spending amounts, categories, and numbers.
- Do NOT make up any numbers.`;

    } catch (error) {
        console.error('[BonsaiLlmService] Error building system prompt:', error);
        return `You are a Smart Financial Assistant. You track expenses and summarize budgets. You are NOT a financial advisor.`;
    }
}

/**
 * Main AI entrypoint — REAL neural network inference only.
 */
export async function getCodexPetAdvice(
    userId: number,
    userQuestion: string,
    chatHistory?: ChatHistoryMessage[],
    onToken?: (token: string) => void
): Promise<string> {
    // 1. Verify model is loaded into device RAM — auto-load if ready on disk
    if (!llmEngine.isModelLoaded()) {
        const status = await BonsaiModelDownloader.checkModelStatus();
        if (status === 'READY') {
            console.log('[BonsaiLlmService] Model binary ready on disk — auto-loading into RAM...');
            const loaded = await loadBonsaiModel();
            if (!loaded) {
                return `⚠️ **Model Memory Load Error**\n\nFailed to load the model binary into device RAM. Please ensure your device has enough free memory and try again.`;
            }
        } else if (status === 'DOWNLOADING') {
            return `⏳ **Model Download in Progress**\n\nPlease wait for the model download to complete.`;
        } else {
            return `⚠️ **Offline LLM Model Not Downloaded**\n\nPlease download the 271MB model file using the card above to activate offline AI chat.`;
        }
    }

    // 2. === REAL NEURAL NETWORK INFERENCE ===
    console.log('[BonsaiLlmService] Running REAL on-device LLM inference');

    const systemPrompt = await buildFinancialSystemPrompt(userId);

    const formattedHistory = (chatHistory || [])
        .slice(-6)
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.text,
        }));

    const result: GenerationResult = await llmEngine.generateResponse(
        systemPrompt,
        userQuestion,
        formattedHistory,
        onToken
    );

    if (!result.text || result.text.trim().length === 0) {
        return `I couldn't generate a response. Please try asking your question again.`;
    }

    // Clean up template tokens if any
    let cleanText = result.text
        .replace(/<\|im_end\|>/g, '')
        .replace(/<\|im_start\|>/g, '')
        .replace(/<\|endoftext\|>/g, '')
        .trim();

    return cleanText;
}

export async function loadBonsaiModel(model?: import('./BonsaiModelDownloader').BonsaiModelMetadata): Promise<boolean> {
    const targetModel = model || BONSAI_MODEL;
    const modelPath = targetModel.localPath;
    return await llmEngine.loadModel(modelPath);
}

export async function unloadBonsaiModel(): Promise<void> {
    await llmEngine.unloadModel();
}

export function cancelBonsaiGeneration(): void {
    llmEngine.cancelGeneration();
}

export function isBonsaiModelLoaded(modelId?: string): boolean {
    if (!llmEngine.isModelLoaded()) return false;
    if (!modelId) return true;
    const path = llmEngine.getLoadedModelPath();
    return path ? path.includes(modelId) || path.toLowerCase().includes(modelId.toLowerCase()) : false;
}

export function getLoadedModelPath(): string | null {
    return llmEngine.getLoadedModelPath();
}
