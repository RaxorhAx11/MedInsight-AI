const { GoogleGenAI } = require("@google/genai");

let aiInstance = null;

/**
 * Initializes and returns the GoogleGenAI instance.
 * @returns {GoogleGenAI}
 */
const getAiInstance = () => {
    if (aiInstance) return aiInstance;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates an embedding vector for the given text using Google's gemini-embedding-2 model.
 * Includes rate-limit retry logic with exponential backoff.
 * 
 * @param {string} text - The input text to embed
 * @param {number} [retries=5] - Maximum number of retries for rate limits
 * @param {number} [delay=1000] - Initial delay in milliseconds for exponential backoff
 * @returns {Promise<Array<number>>} The embedding vector
 */
const generateEmbedding = async (text, retries = 5, delay = 1000) => {
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Input text must be a non-empty string.");
    }

    let attempt = 0;
    while (attempt <= retries) {
        try {
            const ai = getAiInstance();
            const response = await ai.models.embedContent({
                model: "gemini-embedding-2",
                contents: text.trim(),
                config: {
                    outputDimensionality: 768
                }
            });

            if (response) {
                if (response.embedding && Array.isArray(response.embedding.values)) {
                    return response.embedding.values;
                }
                if (response.embeddings && response.embeddings[0] && Array.isArray(response.embeddings[0].values)) {
                    return response.embeddings[0].values;
                }
            }
            throw new Error("Invalid response structure from Gemini Embedding API.");
        } catch (error) {
            attempt++;
            
            // Check if error is due to rate limits (429/RESOURCE_EXHAUSTED) or service unavailable (503/UNAVAILABLE)
            const isRetryable = error.status === 429 || error.status === 503 ||
                                (error.message && (
                                    error.message.includes("429") || 
                                    error.message.includes("RESOURCE_EXHAUSTED") ||
                                    error.message.includes("503") ||
                                    error.message.includes("UNAVAILABLE")
                                ));
            
            if (isRetryable && attempt <= retries) {
                // Exponential backoff with random jitter (0 to 500ms)
                const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.warn(`[EMBEDDING] Transient error (status: ${error.status}). Retrying attempt ${attempt}/${retries} in ${Math.round(backoffDelay)}ms...`);
                await sleep(backoffDelay);
            } else {
                console.error(`[EMBEDDING] Failed to generate embedding on attempt ${attempt}:`, error);
                if (attempt > retries) {
                    throw new Error(`Failed to generate embedding after ${retries} retries: ${error.message}`);
                }
                throw error;
            }
        }
    }
};

module.exports = {
    generateEmbedding
};
