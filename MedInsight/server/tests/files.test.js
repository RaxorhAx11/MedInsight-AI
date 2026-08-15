const assert = require("assert");
const mongoose = require("mongoose");

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

// 1. Mock dependencies BEFORE requiring files.js router
const mockPdf = async (buffer, options) => {
    return {
        text: "Patient: John Doe\nDoctor Notes: Maintain low-sugar diet.\nHemoglobin: 14.5 g/dL"
    };
};
require.cache[require.resolve("pdf-parse")] = {
    exports: mockPdf
};

// Mock multer
const mockMulter = () => {
    return {
        single: (fieldname) => {
            return (req, res, cb) => {
                cb(null);
            };
        }
    };
};
mockMulter.memoryStorage = () => ({});
require.cache[require.resolve("multer")] = {
    exports: mockMulter
};

// Mock cloudStorageService
const mockUploadResult = { url: "http://mockurl.com/pdf.pdf", publicId: "mock_pub_id" };
require.cache[require.resolve("../services/cloudStorageService")] = {
    exports: {
        uploadFile: async () => mockUploadResult,
        deleteFile: async () => true
    }
};

// Mock embeddingService
require.cache[require.resolve("../services/embeddingService")] = {
    exports: {
        generateEmbedding: async (text) => new Array(768).fill(0.2)
    }
};

// Mock notifications and activity
require.cache[require.resolve("../services/notificationService")] = {
    exports: {
        createNotification: async () => true
    }
};
require.cache[require.resolve("../services/activityService")] = {
    exports: {
        logActivity: async () => true
    }
};

// Mock Mongoose Models
const savedFiles = [];
const savedChunks = [];

class MockFile {
    constructor(data) {
        Object.assign(this, data);
        this._id = new mongoose.Types.ObjectId();
    }
    async save() {
        savedFiles.push(this);
        return this;
    }
}
MockFile.find = () => ({ lean: () => [] });
require.cache[require.resolve("../models/file")] = {
    exports: { File: MockFile }
};

class MockReportChunk {
    constructor(data) {
        Object.assign(this, data);
    }
    static async insertMany(docs) {
        savedChunks.push(...docs);
        return docs;
    }
}
require.cache[require.resolve("../models/ReportChunk")] = {
    exports: MockReportChunk
};

// Require the router
const router = require("../routes/files");

// Find the POST handler from the router stack
const postRoute = router.stack.find(s => s.route && s.route.path === "/" && s.route.methods.post);
assert.ok(postRoute);
const mainPostHandler = postRoute.route.stack[postRoute.route.stack.length - 1].handle;

async function testUploadAndRAGGeneration() {
    log.info("Testing PDF report upload controller RAG integration...");
    
    // Construct mock request and response
    const req = {
        user: { _id: new mongoose.Types.ObjectId() },
        file: {
            originalname: "report.pdf",
            mimetype: "application/pdf",
            buffer: Buffer.from("dummy pdf data")
        },
        body: {
            description: "Yearly checkup",
            testDate: "2026-08-14"
        }
    };
    
    let resStatus = 200;
    let resBody = null;
    let resolvePromise;
    const responsePromise = new Promise(resolve => {
        resolvePromise = resolve;
    });

    const res = {
        status: (code) => {
            resStatus = code;
            return res;
        },
        send: (body) => {
            resBody = body;
            resolvePromise();
            return res;
        },
        json: (body) => {
            resBody = body;
            resolvePromise();
            return res;
        }
    };
    
    // Multer is globally mocked above
    
    // Run the main upload handler
    mainPostHandler(req, res);
    
    // Wait for the response to be sent
    await responsePromise;
    
    // Assert response status is 201 Created
    assert.strictEqual(resStatus, 201);
    assert.ok(resBody.message.includes("File uploaded and biomarker results extracted successfully"));
    assert.strictEqual(resBody.fileId, savedFiles[0]._id);
    
    // Assert ReportChunks are saved with embeddings
    savedChunks.forEach((c, idx) => console.log(`CONCISE CHUNK ${idx}: type=${c.chunkType}, textPrefix="${c.chunkText.replace(/\n/g, ' ').substring(0, 50)}"`));
    assert.strictEqual(savedChunks.length, 3); // 1 for Urinalysis group, 1 for Hemoglobin group, 1 for Doctor Notes
    
    // Verify CBC chunk (biomarker group)
    const cbcChunk = savedChunks.find(c => c.chunkType === "biomarker_group" && c.chunkText.includes("Hemoglobin"));
    assert.ok(cbcChunk);
    assert.strictEqual(cbcChunk.userId.toString(), req.user._id.toString());
    assert.strictEqual(cbcChunk.reportId.toString(), savedFiles[0]._id.toString());
    assert.strictEqual(cbcChunk.embedding.length, 768);
    assert.strictEqual(cbcChunk.embedding[0], 0.2);

    // Verify Urinalysis chunk (biomarker group)
    const urineChunk = savedChunks.find(c => c.chunkType === "biomarker_group" && c.chunkText.includes("Urine Glucose"));
    assert.ok(urineChunk);
    
    // Verify doctor notes chunk
    const notesChunk = savedChunks.find(c => c.chunkType === "doctor_notes");
    assert.ok(notesChunk);
    assert.ok(notesChunk.chunkText.includes("Maintain low-sugar diet"));
    
    log.success("Upload and RAG generation tests passed successfully!");
}

async function runAll() {
    log.section("RUNNING UPLOAD ROUTE INTEGRATION TESTS");
    try {
        await testUploadAndRAGGeneration();
        log.section("ALL TESTS PASSED SUCCESSFULLY");
    } catch (error) {
        log.error("Test suite failed:", error);
        process.exit(1);
    }
}

runAll();
