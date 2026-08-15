const assert = require("assert");
const genai = require("@google/genai");

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

// 1. Monkey patch GoogleGenAI constructor to intercept models.embedContent
const OriginalGoogleGenAI = genai.GoogleGenAI;

let mockEmbedContentFn = null;

class MockGoogleGenAI extends OriginalGoogleGenAI {
    constructor(config) {
        super(config);
        // Override the models.embedContent function
        this.models.embedContent = async (params) => {
            if (mockEmbedContentFn) {
                return mockEmbedContentFn(params);
            }
            return {
                embedding: {
                    values: new Array(768).fill(0.1)
                }
            };
        };
    }
}

// Reassign the exported class
genai.GoogleGenAI = MockGoogleGenAI;

// Require the service after setting up the mock
// Set a fake key in env so it initializes successfully
process.env.GEMINI_API_KEY = "fake-key-for-test";
const { generateEmbedding } = require("../services/embeddingService");

async function testInputValidation() {
    log.info("Testing input validation...");
    try {
        await generateEmbedding("");
        assert.fail("Should have thrown error for empty string");
    } catch (error) {
        assert.ok(error.message.includes("must be a non-empty string"));
    }

    try {
        await generateEmbedding(null);
        assert.fail("Should have thrown error for null");
    } catch (error) {
        assert.ok(error.message.includes("must be a non-empty string"));
    }
    
    log.success("Input validation tests passed.");
}

async function testSuccessfulEmbedding() {
    log.info("Testing successful embedding generation...");
    mockEmbedContentFn = async (params) => {
        assert.strictEqual(params.model, "gemini-embedding-2");
        assert.strictEqual(params.contents, "test text");
        return {
            embedding: {
                values: [0.1, 0.2, 0.3]
            }
        };
    };

    const vector = await generateEmbedding("test text");
    assert.deepStrictEqual(vector, [0.1, 0.2, 0.3]);
    log.success("Successful embedding generation passed.");
}

async function testRateLimitRetries() {
    log.info("Testing rate limit retries (exponential backoff)...");
    
    let callCount = 0;
    mockEmbedContentFn = async (params) => {
        callCount++;
        if (callCount < 3) {
            // Throw a rate limit error (status 429)
            const error = new Error("Rate limit exceeded");
            error.status = 429;
            throw error;
        }
        return {
            embedding: {
                values: [0.5, 0.6]
            }
        };
    };

    // Use a very short delay (10ms) so the tests run instantly
    const vector = await generateEmbedding("retry test", 5, 10);
    assert.strictEqual(callCount, 3); // 2 failed attempts, succeeds on 3rd
    assert.deepStrictEqual(vector, [0.5, 0.6]);
    log.success("Rate limit retry tests passed.");
}

async function testRateLimitFailureAfterMaxRetries() {
    log.info("Testing rate limit failure after maximum retries...");
    
    let callCount = 0;
    mockEmbedContentFn = async (params) => {
        callCount++;
        const error = new Error("Rate limit exceeded");
        error.status = 429;
        throw error;
    };

    try {
        // Retry 2 times
        await generateEmbedding("failure test", 2, 5);
        assert.fail("Should have thrown an error after exceeding max retries");
    } catch (error) {
        assert.ok(error.message.includes("Failed to generate embedding after 2 retries"));
        assert.strictEqual(callCount, 3); // Initial attempt + 2 retries = 3 total calls
    }
    log.success("Rate limit failure after max retries passed.");
}

async function testNonRateLimitErrorPropagation() {
    log.info("Testing propagation of non-rate-limit errors...");
    
    let callCount = 0;
    mockEmbedContentFn = async (params) => {
        callCount++;
        const error = new Error("Invalid request parameter");
        error.status = 400; // Bad Request
        throw error;
    };

    try {
        await generateEmbedding("immediate failure test", 5, 10);
        assert.fail("Should have thrown error immediately");
    } catch (error) {
        assert.strictEqual(error.status, 400);
        assert.strictEqual(callCount, 1); // Should not retry for 400 errors
    }
    log.success("Non-rate-limit error propagation passed.");
}

async function runAll() {
    log.section("RUNNING EMBEDDING SERVICE UNIT TESTS");
    try {
        await testInputValidation();
        await testSuccessfulEmbedding();
        await testRateLimitRetries();
        await testRateLimitFailureAfterMaxRetries();
        await testNonRateLimitErrorPropagation();
        log.section("ALL TESTS PASSED SUCCESSFULLY");
    } catch (error) {
        log.error("Test suite failed:", error);
        process.exit(1);
    }
}

runAll();
