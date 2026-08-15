const assert = require("assert");
const mongoose = require("mongoose");
const genai = require("@google/genai");

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

// 1. Mock dependencies BEFORE requiring services
let lastSystemInstruction = "";

const OriginalGoogleGenAI = genai.GoogleGenAI;
class MockGoogleGenAI extends OriginalGoogleGenAI {
    constructor(config) {
        super(config);
        this.chats = {
            create: (chatConfig) => {
                lastSystemInstruction = chatConfig.config.systemInstruction;
                return {
                    sendMessage: async (msg) => {
                        return {
                            text: "Mocked Gemini Response discussing biomarkers."
                        };
                    }
                };
            }
        };
    }
}
genai.GoogleGenAI = MockGoogleGenAI;

// Mock embeddingService
require.cache[require.resolve("../services/embeddingService")] = {
    exports: {
        generateEmbedding: async (text) => new Array(768).fill(0.3)
    }
};

// Mock Mongoose ReportChunk model
const mockChunks = [
    { chunkText: "Biomarker Group: Lipid Panel\n- Total Cholesterol: 220 mg/dL | Status: High", metadata: { chunkType: "biomarker_group" } },
    { chunkText: "Doctor Notes: Maintain low-fat diet.", metadata: { chunkType: "doctor_notes" } }
];

let aggregateCalled = false;
let findCalled = false;

class MockReportChunk {
    static async aggregate(pipeline) {
        aggregateCalled = true;
        // Verify vector search pipeline
        const stage = pipeline[0].$vectorSearch;
        assert.ok(stage);
        assert.strictEqual(stage.index, "reportchunks");
        assert.strictEqual(stage.limit, 5);
        assert.ok(stage.filter.userId);
        assert.ok(stage.filter.reportId);
        return mockChunks;
    }
    
    static find(query) {
        findCalled = true;
        assert.ok(query.userId);
        assert.ok(query.reportId);
        return {
            sort: () => ({
                limit: () => ({
                    lean: async () => mockChunks
                })
            })
        };
    }
}
require.cache[require.resolve("../models/ReportChunk")] = {
    exports: MockReportChunk
};

// Set a fake key in env so it initializes successfully
process.env.GEMINI_API_KEY = "fake-key-for-test";
const { generateChatResponse } = require("../services/aiService");

async function testGenerateChatResponseWithVectorSearch() {
    log.info("Testing generateChatResponse with successful Vector Search...");
    
    aggregateCalled = false;
    findCalled = false;
    
    const reportDoc = {
        userId: new mongoose.Types.ObjectId(),
        _id: new mongoose.Types.ObjectId()
    };
    
    const response = await generateChatResponse(reportDoc, "Blood Test", "What is my cholesterol level?");
    
    assert.strictEqual(response, "Mocked Gemini Response discussing biomarkers.");
    assert.strictEqual(aggregateCalled, true);
    assert.strictEqual(findCalled, false);
    
    // Assert systemInstruction contains context from search chunks
    assert.ok(lastSystemInstruction.includes("=== REPORT CONTEXT CHUNKS ==="));
    assert.ok(lastSystemInstruction.includes("Total Cholesterol: 220"));
    assert.ok(lastSystemInstruction.includes("Maintain low-fat diet"));
    
    log.success("Vector Search prompt injection test passed.");
}

async function testGenerateChatResponseWithFallback() {
    log.info("Testing generateChatResponse with Vector Search failure (Fallback)...");
    
    aggregateCalled = false;
    findCalled = false;
    
    // Temporarily mock aggregate to throw an error (simulating local/non-Atlas MongoDB)
    const originalAggregate = MockReportChunk.aggregate;
    MockReportChunk.aggregate = async () => {
        throw new Error("Local instances do not support Atlas Search");
    };
    
    const reportDoc = {
        userId: new mongoose.Types.ObjectId(),
        _id: new mongoose.Types.ObjectId()
    };
    
    const response = await generateChatResponse(reportDoc, "Blood Test", "What is my cholesterol level?");
    
    assert.strictEqual(response, "Mocked Gemini Response discussing biomarkers.");
    assert.strictEqual(findCalled, true);
    
    // Assert systemInstruction contains context from fallback query
    assert.ok(lastSystemInstruction.includes("=== REPORT CONTEXT CHUNKS ==="));
    assert.ok(lastSystemInstruction.includes("Total Cholesterol: 220"));
    assert.ok(lastSystemInstruction.includes("Maintain low-fat diet"));
    
    // Restore aggregate
    MockReportChunk.aggregate = originalAggregate;
    
    log.success("Fallback query prompt injection test passed.");
}

async function runAll() {
    log.section("RUNNING AI SERVICE CHAT INTEGRATION TESTS");
    try {
        await testGenerateChatResponseWithVectorSearch();
        await testGenerateChatResponseWithFallback();
        log.section("ALL TESTS PASSED SUCCESSFULLY");
    } catch (error) {
        log.error("Test suite failed:", error);
        process.exit(1);
    }
}

runAll();
