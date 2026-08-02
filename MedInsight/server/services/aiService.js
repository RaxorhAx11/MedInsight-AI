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
        
        const formattedContext = formatSelectedReportContext(reportDoc, reportType);
        
        const systemInstruction = [
            "You are MedInsight AI, a concise, precise, and professional medical assistant.",
            "Your primary job is to answer questions specifically about the user's selected medical report.",
            "",
            "Here is the selected medical report context:",
            "-----------------------------------------",
            formattedContext,
            "-----------------------------------------",
            "",
            "Rules you MUST strictly follow:",
            "1. Answer questions ONLY using the information from the selected uploaded report provided above.",
            "2. Do NOT combine, infer, or reuse data from any other reports, external medical knowledge, or previous conversations.",
            "3. If a biomarker or test value is not present in the selected report, you MUST respond with: \"Not mentioned in this report.\"",
            "4. Do NOT invent, assume, or hallucinate any biomarkers, reference ranges, statuses, diagnoses, or test results.",
            "5. First, note that the report type is identified as: " + reportType + ".",
            "6. Discuss ONLY tests and biomarkers that belong to this report type. Ignore and do not discuss unrelated medical information.",
            "7. Keep your answers direct, short, and focused on the user's query. Avoid all disclaimers, legal warnings, or generic medical remarks.",
            "8. Do not format list elements with bold."
        ].join("\n");

        const history = formatChatHistory(chatHistory);

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
        console.error("Error generating response from Gemini service:", error);
        throw error;
    }
};

module.exports = {
    generateChatResponse
};
