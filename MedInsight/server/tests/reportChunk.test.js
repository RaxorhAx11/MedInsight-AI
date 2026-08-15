const assert = require("assert");
const mongoose = require("mongoose");
const ReportChunk = require("../models/ReportChunk");

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

function testReportChunkValidation() {
    log.info("Testing ReportChunk validation with valid fields...");
    
    const validChunk = new ReportChunk({
        userId: new mongoose.Types.ObjectId(),
        reportId: new mongoose.Types.ObjectId(),
        chunkText: "Total Cholesterol: 180 mg/dL",
        chunkType: "biomarker_group",
        embedding: new Array(768).fill(0.1)
    });
    
    const err = validChunk.validateSync();
    assert.strictEqual(err, undefined, "Valid document validation should pass");
    log.success("ReportChunk valid schema validation passed.");
}

function testReportChunkMissingFields() {
    log.info("Testing ReportChunk validation with missing fields...");
    
    const invalidChunk = new ReportChunk({
        chunkText: "Missing userId, reportId, chunkType, and embedding"
    });
    
    const err = invalidChunk.validateSync();
    assert.ok(err, "Validation should fail for missing required fields");
    assert.ok(err.errors.userId, "userId should be required");
    assert.ok(err.errors.reportId, "reportId should be required");
    assert.ok(err.errors.chunkType, "chunkType should be required");
    assert.ok(err.errors.embedding, "embedding should be required");
    log.success("ReportChunk missing fields validation passed.");
}

function testReportChunkInvalidEmbeddingDimensions() {
    log.info("Testing ReportChunk validation with invalid embedding dimensions...");
    
    const invalidDimensions = [0, 5, 767, 769];
    
    for (const dim of invalidDimensions) {
        log.info(`Testing embedding dimension size: ${dim}...`);
        const invalidChunk = new ReportChunk({
            userId: new mongoose.Types.ObjectId(),
            reportId: new mongoose.Types.ObjectId(),
            chunkText: "Incorrect dimension size",
            chunkType: "biomarker_group",
            embedding: new Array(dim).fill(0.1)
        });
        
        const err = invalidChunk.validateSync();
        assert.ok(err, `Validation should fail for dimension size ${dim}`);
        assert.ok(err.errors.embedding, "embedding field should fail validation");
        assert.ok(err.errors.embedding.message.includes("must have exactly 768 dimensions"));
    }
    
    log.success("ReportChunk invalid embedding dimensions validation passed.");
}

function runAll() {
    log.section("RUNNING REPORTCHUNK MODEL VALIDATION TESTS");
    try {
        testReportChunkValidation();
        testReportChunkMissingFields();
        testReportChunkInvalidEmbeddingDimensions();
        log.section("ALL TESTS PASSED SUCCESSFULLY");
    } catch (error) {
        log.error("Test suite failed:", error);
        process.exit(1);
    }
}

runAll();
