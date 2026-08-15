const assert = require("assert");
const { chunkReportData, getBiomarkerGroup, formatRange, extractDoctorNotes } = require("../services/ragChunking");

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

function testGetBiomarkerGroup() {
    log.info("Testing getBiomarkerGroup...");
    assert.strictEqual(getBiomarkerGroup("Total Cholesterol"), "Lipid Panel");
    assert.strictEqual(getBiomarkerGroup("LDLCholesterol"), "Lipid Panel");
    assert.strictEqual(getBiomarkerGroup("Hemoglobin"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("WBC"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("RBC"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("Platelets"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("Hematocrit"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("hct"), "Complete Blood Count (CBC)");
    assert.strictEqual(getBiomarkerGroup("Creatinine"), "Kidney Function Test (KFT)");
    assert.strictEqual(getBiomarkerGroup("Urine pH"), "Urinalysis");
    assert.strictEqual(getBiomarkerGroup("Stool Consistency"), "Stool Analysis");
    assert.strictEqual(getBiomarkerGroup("Sperm Motility"), "Semen Analysis");
    assert.strictEqual(getBiomarkerGroup("HSIL"), "Pap Smear");
    assert.strictEqual(getBiomarkerGroup("Swab Culture Result"), "Swab Test");
    assert.strictEqual(getBiomarkerGroup("Random Test Name"), "Other Biomarkers");
    log.success("getBiomarkerGroup tests passed.");
}

function testFormatRange() {
    log.info("Testing formatRange...");
    assert.strictEqual(formatRange({ min: 10, max: 20 }), "10 - 20");
    assert.strictEqual(formatRange({ min: 5 }), ">= 5");
    assert.strictEqual(formatRange({ max: 15 }), "<= 15");
    assert.strictEqual(formatRange("Normal"), "Normal");
    assert.strictEqual(formatRange(null), "");
    log.success("formatRange tests passed.");
}

function testExtractDoctorNotes() {
    log.info("Testing extractDoctorNotes...");
    const text1 = "Some random text.\nDoctor Notes:\nPatient is healthy. Avoid sugar.";
    assert.ok(extractDoctorNotes(text1).includes("Patient is healthy"));
    
    const text2 = "No notes section here at all.";
    assert.strictEqual(extractDoctorNotes(text2), "");
    
    const text3 = "Summary:\nEverything looks good.";
    assert.ok(extractDoctorNotes(text3).includes("Everything looks good."));
    log.success("extractDoctorNotes tests passed.");
}

function testChunkReportData() {
    log.info("Testing chunkReportData...");
    const extractedText = "Patient name: John Doe\nDoctor Notes: Keep doing regular exercise and follow up in six months.";
    const biomarkers = [
        { name: "Total Cholesterol", value: 180, unit: "mg/dL", range: { max: 200 }, status: "Normal" },
        { name: "LDL Cholesterol", value: 110, unit: "mg/dL", range: { max: 100 }, status: "High" },
        { name: "Hemoglobin", result: 14.5, unit: "g/dL", referenceRange: { min: 13.8, max: 17.2 }, status: "Normal" }
    ];
    const metadata = {
        reportId: "report123",
        userId: "user456",
        reportDate: new Date("2026-08-14")
    };
    
    const chunks = chunkReportData(extractedText, biomarkers, metadata);
    
    // We expect:
    // 1 chunk for Lipid Panel
    // 1 chunk for CBC
    // 1 chunk for doctor notes
    assert.strictEqual(chunks.length, 3);
    
    // Check lipid panel chunk
    const lipidChunk = chunks.find(c => c.metadata.groupName === "Lipid Panel");
    assert.ok(lipidChunk);
    assert.strictEqual(lipidChunk.metadata.chunkType, "biomarker_group");
    assert.strictEqual(lipidChunk.metadata.reportId, "report123");
    assert.ok(lipidChunk.text.includes("Total Cholesterol: 180"));
    assert.ok(lipidChunk.text.includes("LDL Cholesterol: 110"));
    
    // Check CBC chunk
    const cbcChunk = chunks.find(c => c.metadata.groupName === "Complete Blood Count (CBC)");
    assert.ok(cbcChunk);
    assert.strictEqual(cbcChunk.metadata.chunkType, "biomarker_group");
    assert.ok(cbcChunk.text.includes("Hemoglobin: 14.5"));
    
    // Check doctor notes chunk
    const notesChunk = chunks.find(c => c.metadata.chunkType === "doctor_notes");
    assert.ok(notesChunk);
    assert.ok(notesChunk.text.includes("Keep doing regular exercise"));
    assert.strictEqual(notesChunk.metadata.reportId, "report123");
    
    log.success("chunkReportData tests passed.");
}

function runAll() {
    log.section("RUNNING RAG CHUNKING UNIT TESTS");
    try {
        testGetBiomarkerGroup();
        testFormatRange();
        testExtractDoctorNotes();
        testChunkReportData();
        log.section("ALL TESTS PASSED SUCCESSFULLY");
    } catch (error) {
        log.error("Test suite failed:", error);
        process.exit(1);
    }
}

runAll();
