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
 * Formats the selected report's context into a structured, readable string for the model.
 * @param {Object} reportDoc - The single selected report document
 * @param {string} reportType - The identified report type
 * @returns {string}
 */
const formatSelectedReportContext = (reportDoc, reportType) => {
    if (!reportDoc) {
        return "No medical report data is available.";
    }

    let formatted = `=== SELECTED REPORT ===\n`;
    formatted += `Report Type: ${reportType}\n`;
    formatted += `Date of Report: ${reportDoc.reportDate ? new Date(reportDoc.reportDate).toLocaleDateString() : 'Unknown'}\n`;
    if (reportDoc.description) {
        formatted += `Description/Notes: ${reportDoc.description}\n`;
    }
    formatted += `Biomarkers/Tests:\n`;

    if (Array.isArray(reportDoc.biomarkers) && reportDoc.biomarkers.length > 0) {
        reportDoc.biomarkers.forEach(b => {
            const rangeStr = b.referenceRange
                ? `(Normal Range: ${b.referenceRange.min} - ${b.referenceRange.max} ${b.unit || ''})`
                : '';
            formatted += `- ${b.name}: ${b.result} ${b.unit || ''} ${rangeStr} | Status: ${b.status || 'Unknown'}\n`;
            if (b.description) {
                formatted += `  Info: ${b.description}\n`;
            }
        });
    } else {
        formatted += `No biomarkers or test results extracted.\n`;
    }

    return formatted;
};

/**
 * Aligns raw message history from frontend to the structure expected by the Gemini SDK.
 * @param {Array} messages - Chat history in raw format
 * @returns {Array} Formatted history array
 */
const formatChatHistory = (messages) => {
    if (!Array.isArray(messages)) return [];

    const rawHistory = [];
    for (const msg of messages) {
        const role = msg.sender === "user" ? "user" : (msg.sender === "bot" || msg.sender === "model" ? "model" : null);
        const text = msg.text || msg.message;
        if (role && typeof text === "string" && text.trim()) {
            rawHistory.push({ role, text: text.trim() });
        }
    }

    const alignedHistory = [];
    for (const item of rawHistory) {
        if (alignedHistory.length === 0) {
            if (item.role === "user") {
                alignedHistory.push(item);
            }
        } else {
            const prevItem = alignedHistory[alignedHistory.length - 1];
            if (prevItem.role === item.role) {
                prevItem.text += "\n" + item.text;
            } else {
                alignedHistory.push(item);
            }
        }
    }

    return alignedHistory.map(item => ({
        role: item.role,
        parts: [{ text: item.text }]
    }));
};

/**
 * Generates an AI response for the user's question, using the provided medical report context.
 * @param {Object} reportDoc - The single selected report document
 * @param {string} reportType - The automatically identified report type (e.g. "Blood Test", "CBC", etc.)
 * @param {string} question - The user's query
 * @param {Array} chatHistory - Raw message history from the front-end
 * @returns {Promise<string>} Gemini response text
 */
const generateChatResponse = async (reportDoc, reportType, question, chatHistory = []) => {
    try {
        const ai = getAiInstance();
        
        // 1. Retrieve top 5 semantic chunks using vector search
        const { generateEmbedding } = require("./embeddingService");
        const ReportChunk = require("../models/ReportChunk");
        const mongoose = require("mongoose");

        // Convert userId and reportId to mongoose.Types.ObjectId to match schema type
        const targetUserId = new mongoose.Types.ObjectId(reportDoc.userId.toString());
        // report chunks are indexed/associated by fileId (reportDoc.fileId). If fileId is missing, fall back to reportDoc._id.
        const rawReportId = reportDoc.fileId || reportDoc._id;
        const targetReportId = new mongoose.Types.ObjectId(rawReportId.toString());

        // Comprehensive debug logs for activeReportId received from frontend and comparison with database formats
        console.log("[DEBUG] activeReportId received from frontend (reportDoc._id):", reportDoc._id, "type:", typeof reportDoc._id, "constructor:", reportDoc._id?.constructor?.name);
        console.log("[DEBUG] Linked fileId (used as reportId in ReportChunk):", reportDoc.fileId, "type:", typeof reportDoc.fileId, "constructor:", reportDoc.fileId?.constructor?.name);
        console.log("[DEBUG] targetReportId converted for filter:", targetReportId, "type:", typeof targetReportId, "constructor:", targetReportId?.constructor?.name);

        let chunks = [];
        try {
            // Fetch a sample ReportChunk directly from DB to compare formats
            if (typeof ReportChunk.findOne === "function") {
                const sampleChunk = await ReportChunk.findOne({ userId: targetUserId }).lean();
                if (sampleChunk) {
                    console.log("[DEBUG] Sample ReportChunk from DB - reportId value:", sampleChunk.reportId, "type:", typeof sampleChunk.reportId, "constructor:", sampleChunk.reportId?.constructor?.name);
                } else {
                    console.log("[DEBUG] Sample ReportChunk: No chunk found for user in DB");
                }
            } else {
                console.log("[DEBUG] ReportChunk.findOne is not a function (mocked or unsupported environment)");
            }

            const queryVector = await generateEmbedding(question);
            
            // Ensure queryVector is a plain array of numbers
            if (!Array.isArray(queryVector) || queryVector.some(n => typeof n !== "number")) {
                throw new Error("Generated queryVector is not a plain array of numbers");
            }

            const vectorSearchPipeline = [
                {
                    $vectorSearch: {
                        index: "reportchunks",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 5,
                        filter: {
                            userId: targetUserId,
                            reportId: targetReportId
                        }
                    }
                }
            ];

            console.log("[RAG] Final filter object used:", JSON.stringify(vectorSearchPipeline[0].$vectorSearch.filter, null, 2));
            console.log("[RAG] Filter object constructors - userId:", vectorSearchPipeline[0].$vectorSearch.filter.userId?.constructor?.name, "reportId:", vectorSearchPipeline[0].$vectorSearch.filter.reportId?.constructor?.name);
            console.log("[RAG] Full Aggregation Pipeline Query:", JSON.stringify(vectorSearchPipeline, null, 2));

            // Isolate check: run the same query with the filter removed entirely to check if vector search itself returns chunks
            try {
                const noFilterPipeline = [
                    {
                        $vectorSearch: {
                            index: "reportchunks",
                            path: "embedding",
                            queryVector: queryVector,
                            numCandidates: 100,
                            limit: 5
                        }
                    }
                ];
                const noFilterResults = await ReportChunk.aggregate(noFilterPipeline);
                console.log(`[RAG Isolation Check] Aggregation with filter removed returned ${noFilterResults.length} chunks.`);
            } catch (isolationError) {
                console.warn("[RAG Isolation Check] Aggregation with filter removed failed:", isolationError.message);
            }

            chunks = await ReportChunk.aggregate(vectorSearchPipeline);
            console.log(`[RAG] Successfully retrieved ${chunks.length} chunks via Atlas Vector Search.`);
        } catch (vectorSearchError) {
            console.warn("[RAG] Atlas Vector Search failed or not supported. Falling back to query. Error:", vectorSearchError.message);
            // Fallback: get the 5 most recent chunks for the selected report
            chunks = await ReportChunk.find({ userId: targetUserId, reportId: targetReportId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();
            console.log(`[RAG Fallback] Successfully retrieved ${chunks.length} chunks via fallback query.`);
        }

        // 2. Format the chunks into context
        let formattedContext = `=== SELECTED REPORT TYPE: ${reportType} ===\n\n`;
        formattedContext += `=== REPORT CONTEXT CHUNKS ===\n`;
        if (chunks && chunks.length > 0) {
            chunks.forEach((chunk, index) => {
                formattedContext += `--- Chunk ${index + 1} ---\n${chunk.chunkText}\n\n`;
            });
        } else {
            formattedContext += "No relevant medical report context chunks found.\n";
        }
        
        const systemInstruction = [
            "You are MedInsight AI, a concise, precise, and professional medical assistant.",
            "Your job is to answer questions about the user's selected medical report and provide general health/lifestyle guidance.",
            "",
            "Here is the selected medical report context:",
            "-----------------------------------------",
            formattedContext,
            "-----------------------------------------",
            "",
            "Rules you MUST strictly follow:",
            "1. Use the retrieved report context provided above to answer questions about the user's specific test results, values, ranges, and status.",
            "2. If a biomarker or test value is not present in the selected report context, and the user is asking about their specific report data, you MUST respond with: \"Not mentioned in this report.\" Only say information is unavailable when the user is asking about their specific report data and it is genuinely missing.",
            "3. For general health, lifestyle, educational, or guidance questions (e.g. how to maintain healthy levels, what a biomarker means generally, dietary advice), answer using your own medical knowledge. You are NOT restricted to the retrieved context for these general questions.",
            "4. Do NOT invent, assume, or hallucinate any specific biomarkers, reference ranges, statuses, diagnoses, or test results belonging to the user's actual report.",
            "5. First, note that the report type is identified as: " + reportType + ".",
            "6. Discuss ONLY tests and biomarkers that belong to this report type. Ignore and do not discuss unrelated medical information.",
            "7. Keep your answers direct, short, and focused on the user's query. Avoid all disclaimers, legal warnings, or generic medical remarks.",
            "8. Do not format list elements with bold.",
            "9. When a biomarker name includes a qualifier or sample type (e.g. 'Urine WBC', 'Semen WBC', 'Blood WBC', 'Stool RBC'), always include that full qualified name in the answer — never shorten it to just the general biomarker name (e.g. never say just 'WBC' or 'RBC' on its own).",
            "10. If the user's question is generic (e.g. 'What is my WBC count?') and the retrieved chunks contain multiple different qualified versions of that biomarker (e.g. both Urine WBC and Semen WBC), do not pick one arbitrarily — either list all matching types found with their values, or ask the user to clarify which one they mean."
        ].join("\n");

        const history = formatChatHistory(chatHistory);

        let attempt = 0;
        const retries = 5;
        const delay = 1000;

        while (attempt <= retries) {
            try {
                const chat = ai.chats.create({
                    model: "gemini-3.6-flash",
                    history: history,
                    config: {
                        systemInstruction: systemInstruction
                    }
                });

                const result = await chat.sendMessage({
                    message: question
                });

                return result.text;
            } catch (error) {
                attempt++;
                
                // Check if error is retryable (429 rate limit or 503 service unavailable / high demand)
                const isRetryable = error.status === 429 || error.status === 503 ||
                                    (error.message && (
                                        error.message.includes("429") || 
                                        error.message.includes("RESOURCE_EXHAUSTED") ||
                                        error.message.includes("503") || 
                                        error.message.includes("UNAVAILABLE")
                                    ));
                
                if (isRetryable && attempt <= retries) {
                    const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 500;
                    console.warn(`[CHAT] Transient AI service error (status: ${error.status}). Retrying attempt ${attempt}/${retries} in ${Math.round(backoffDelay)}ms...`);
                    await sleep(backoffDelay);
                } else {
                    console.error(`[CHAT] Failed to generate chat response on attempt ${attempt}:`, error);
                    if (attempt > retries) {
                        throw new Error(`Failed to generate chat response after ${retries} retries: ${error.message}`);
                    }
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error("Error generating response from Gemini service:", error);
        throw error;
    }
};

module.exports = {
    generateChatResponse
};
