/**
 * RAG Pipeline Comprehensive Regression Test
 * 
 * This script connects to the database, retrieve and chunks inputs for 2 reports (CBC & Stool),
 * generates real embeddings, wait for indexing, performs vector search flow,
 * checks report isolation, user isolation, value accuracy, non-existent data handling,
 * general knowledge answering, and confirms native Atlas $vectorSearch usage.
 */

// Load environment variables first
require("../utils/envLoader");
const mongoose = require("mongoose");
const connectDB = require("../db");
const ReportChunk = require("../models/ReportChunk");
const { generateEmbedding } = require("../services/embeddingService");
const { chunkReportData, getBiomarkerGroup } = require("../services/ragChunking");
const { generateChatResponse } = require("../services/aiService");

// Helper to truncate text for table output
const truncateText = (text, maxLength = 80) => {
    if (!text) return "";
    const cleanText = text.replace(/\s+/g, " ").trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength - 3) + "...";
};

async function runTest() {
    console.log("\n========================================================");
    console.log("   RUNNING RAG PIPELINE COMPREHENSIVE REGRESSION TEST   ");
    console.log("========================================================\n");

    // 1. Connect to DB
    await connectDB();

    const results = {
        "1. Chunking Correctness": "PENDING",
        "2. Report Isolation": "PENDING",
        "3. User Isolation": "PENDING",
        "4. Value Accuracy": "PENDING",
        "5. Non-existent Data Handling": "PENDING",
        "6. General Knowledge Questions": "PENDING",
        "7. Native Vector Search Confirmation": "PENDING"
    };

    const testUserId = new mongoose.Types.ObjectId();
    const reportAId = new mongoose.Types.ObjectId(); // CBC report
    const reportBId = new mongoose.Types.ObjectId(); // Stool report

    console.log(`[SETUP] Test User ID: ${testUserId}`);
    console.log(`[SETUP] Report A (CBC) ID: ${reportAId}`);
    console.log(`[SETUP] Report B (Stool) ID: ${reportBId}\n`);

    // Define source reports (using "WBC" which maps to Complete Blood Count (CBC))
    const rawTextA = "CBC Lab Report\nPatient Name: Test User\nWBC: 6.8 10^3/uL\nHemoglobin: 14.5 g/dL\nPlatelets: 250 10^3/uL\nDoctor Notes: All values are within normal limits.";
    const biomarkersA = [
        { name: "WBC", result: 6.8, unit: "10^3/uL", referenceRange: { min: 4.5, max: 11.0 }, status: "Normal", description: "White blood cell count" },
        { name: "Hemoglobin", result: 14.5, unit: "g/dL", referenceRange: { min: 13.5, max: 17.5 }, status: "Normal", description: "Oxygen carrying protein" },
        { name: "Platelets", result: 250, unit: "10^3/uL", referenceRange: { min: 150, max: 450 }, status: "Normal", description: "Platelet cells count" }
    ];

    const rawTextB = "Stool Analysis Report\nPatient Name: Test User\nStool pH: 6.2\nStool Color: Brown\nStool Consistency: Formed\nDoctor Notes: Stool analysis appears normal.";
    const biomarkersB = [
        { name: "Stool pH", result: 6.2, unit: "", referenceRange: { min: 6.0, max: 7.5 }, status: "Normal", description: "Fecal pH level" },
        { name: "Stool Color", result: "Brown", unit: "", referenceRange: { min: "Brown", max: "Brown" }, status: "Normal", description: "Color of stool" },
        { name: "Stool Consistency", result: "Formed", unit: "", referenceRange: { min: "Formed", max: "Formed" }, status: "Normal", description: "Stool consistency classification" }
    ];

    try {
        // --- CHECK 1: CHUNKING CORRECTNESS ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 1: Chunking Correctness");
        console.log("--------------------------------------------------------");
        
        const chunksA = chunkReportData(rawTextA, biomarkersA, {
            reportId: reportAId,
            userId: testUserId,
            reportDate: new Date(),
            description: "CBC Report"
        });

        const chunksB = chunkReportData(rawTextB, biomarkersB, {
            reportId: reportBId,
            userId: testUserId,
            reportDate: new Date(),
            description: "Stool Report"
        });

        console.log(`\n[CBC Chunks generated: ${chunksA.length}]`);
        chunksA.forEach((c, idx) => {
            console.log(`  Chunk #${idx + 1} (Type: ${c.metadata.chunkType}):\n  """\n  ${c.text.split("\n").join("\n  ")}\n  """`);
        });

        console.log(`\n[Stool Chunks generated: ${chunksB.length}]`);
        chunksB.forEach((c, idx) => {
            console.log(`  Chunk #${idx + 1} (Type: ${c.metadata.chunkType}):\n  """\n  ${c.text.split("\n").join("\n  ")}\n  """`);
        });

        // Verification logic for Check 1
        const wbcGroup = getBiomarkerGroup("WBC");
        const pHGroup = getBiomarkerGroup("Stool pH");
        console.log(`\nBiomarker Classification Verification:`);
        console.log(`- WBC classified under: "${wbcGroup}" (Expected: "Complete Blood Count (CBC)")`);
        console.log(`- Stool pH classified under: "${pHGroup}" (Expected: "Stool Analysis")`);

        let check1Passed = true;
        if (wbcGroup !== "Complete Blood Count (CBC)") check1Passed = false;
        if (pHGroup !== "Stool Analysis") check1Passed = false;

        // Verify that CBC chunks don't contain stool biomarkers and vice versa
        const containsStoolInA = chunksA.some(c => c.text.toLowerCase().includes("stool"));
        const containsCbcInB = chunksB.some(c => c.text.toLowerCase().includes("hemoglobin") || c.text.toLowerCase().includes("wbc"));
        if (containsStoolInA || containsCbcInB) {
            console.error("[FAIL] Cross-contamination in generated chunks!");
            check1Passed = false;
        }

        results["1. Chunking Correctness"] = check1Passed ? "PASS" : "FAIL";
        console.log(`Check 1: ${results["1. Chunking Correctness"]}\n`);


        // --- SEED DATABASE ---
        console.log("Generating embeddings and seeding database chunks...");
        const chunkDocs = [];
        for (const chunk of [...chunksA, ...chunksB]) {
            console.log(`Generating embedding for: "${truncateText(chunk.text, 50)}"...`);
            const embedding = await generateEmbedding(chunk.text);
            chunkDocs.push({
                userId: testUserId,
                reportId: chunk.metadata.reportId,
                chunkText: chunk.text,
                chunkType: chunk.metadata.chunkType,
                embedding
            });
        }
        await ReportChunk.insertMany(chunkDocs);
        console.log("Seeding complete! Stored chunks in database.\n");


        // --- WAIT FOR INDEXING ---
        console.log("Waiting for Atlas Vector Search to index the seeded chunks...");
        let indexed = false;
        for (let attempt = 1; attempt <= 15; attempt++) {
            const queryVector = await generateEmbedding("What is my WBC count?");
            const checkQuery = await ReportChunk.aggregate([
                {
                    $vectorSearch: {
                        index: "reportchunks",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 10,
                        limit: 1,
                        filter: { userId: testUserId }
                    }
                }
            ]);
            if (checkQuery.length > 0) {
                console.log(`[INDEX READY] Seeded chunks indexed successfully after attempt ${attempt}!\n`);
                indexed = true;
                break;
            }
            console.log(`[INDEX NOT READY] Attempt ${attempt}/15: Chunks not yet searchable. Waiting 2 seconds...`);
            await new Promise(r => setTimeout(r, 2000));
        }
        if (!indexed) {
            console.warn("[WARNING] Seeded chunks were not indexed by Atlas Vector Search within 30 seconds. Some tests might fail.\n");
        }


        // Set up console.warn wrapper to spy on fallback warnings for Check 7
        let fallbackWarningTriggered = false;
        const originalWarn = console.warn;
        console.warn = (...args) => {
            const warningMsg = args.join(" ");
            if (warningMsg.includes("Atlas Vector Search failed") || warningMsg.includes("fallback")) {
                fallbackWarningTriggered = true;
            }
            originalWarn(...args);
        };


        // --- CHECK 2: REPORT ISOLATION ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 2: Report Isolation");
        console.log("--------------------------------------------------------");
        
        // Query WBC (should belong to Report A)
        const queryVectorWbc = await generateEmbedding("What is my WBC count?");
        const retrievedA = await ReportChunk.aggregate([
            {
                $vectorSearch: {
                    index: "reportchunks",
                    path: "embedding",
                    queryVector: queryVectorWbc,
                    numCandidates: 100,
                    limit: 5,
                    filter: {
                        userId: testUserId,
                        reportId: reportAId
                    }
                }
            }
        ]);

        console.log(`Retrieved ${retrievedA.length} chunks for Report A (WBC query).`);
        console.table(retrievedA.map(c => ({
            chunkId: c._id.toString(),
            reportId: c.reportId.toString(),
            chunkText: truncateText(c.chunkText, 60)
        })));

        let check2Passed = retrievedA.length > 0;
        for (const chunk of retrievedA) {
            if (chunk.reportId.toString() !== reportAId.toString()) {
                check2Passed = false;
                console.error(`[FAIL] Retrieved chunk from wrong report ID: ${chunk.reportId} (Expected: ${reportAId})`);
            }
        }

        results["2. Report Isolation"] = check2Passed ? "PASS" : "FAIL";
        console.log(`Check 2: ${results["2. Report Isolation"]}\n`);


        // --- CHECK 3: USER ISOLATION ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 3: User Isolation");
        console.log("--------------------------------------------------------");
        
        const dummyUserId = new mongoose.Types.ObjectId();
        const retrievedDummy = await ReportChunk.aggregate([
            {
                $vectorSearch: {
                    index: "reportchunks",
                    path: "embedding",
                    queryVector: queryVectorWbc,
                    numCandidates: 100,
                    limit: 5,
                    filter: {
                        userId: dummyUserId,
                        reportId: reportAId
                    }
                }
            }
        ]);

        console.log(`Retrieved ${retrievedDummy.length} chunks for dummy user.`);
        const check3Passed = retrievedDummy.length === 0;
        if (!check3Passed) {
            console.error(`[FAIL] Data leak! Retrieved chunks for a different userId: ${dummyUserId}`);
        }

        results["3. User Isolation"] = check3Passed ? "PASS" : "FAIL";
        console.log(`Check 3: ${results["3. User Isolation"]}\n`);


        // --- CHECK 4: VALUE ACCURACY ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 4: Value Accuracy");
        console.log("--------------------------------------------------------");
        
        let check4Passed = true;
        
        // Verify Report A contains WBC 6.8
        const wbcChunk = retrievedA.find(c => c.chunkText.includes("WBC"));
        if (wbcChunk) {
            console.log(`Retrieved Report A WBC chunk text: "${wbcChunk.chunkText.trim()}"`);
            if (wbcChunk.chunkText.includes("6.8")) {
                console.log(`- Found exact value "6.8".`);
            } else {
                console.error(`- [FAIL] Expected WBC value "6.8" not found in chunk.`);
                check4Passed = false;
            }
            if (wbcChunk.chunkText.includes("6.2")) {
                console.error(`- [FAIL] Leakage of Report B value "6.2" found in Report A chunk!`);
                check4Passed = false;
            }
        } else {
            console.error(`- [FAIL] WBC chunk not retrieved.`);
            check4Passed = false;
        }

        // Verify Report B contains Stool pH 6.2
        const queryVectorPh = await generateEmbedding("What is my stool pH?");
        const retrievedB = await ReportChunk.aggregate([
            {
                $vectorSearch: {
                    index: "reportchunks",
                    path: "embedding",
                    queryVector: queryVectorPh,
                    numCandidates: 100,
                    limit: 5,
                    filter: {
                        userId: testUserId,
                        reportId: reportBId
                    }
                }
            }
        ]);

        const phChunk = retrievedB.find(c => c.chunkText.includes("Stool pH"));
        if (phChunk) {
            console.log(`Retrieved Report B Stool pH chunk text: "${phChunk.chunkText.trim()}"`);
            if (phChunk.chunkText.includes("6.2")) {
                console.log(`- Found exact value "6.2".`);
            } else {
                console.error(`- [FAIL] Expected Stool pH value "6.2" not found in chunk.`);
                check4Passed = false;
            }
            if (phChunk.chunkText.includes("6.8")) {
                console.error(`- [FAIL] Leakage of Report A value "6.8" found in Report B chunk!`);
                check4Passed = false;
            }
        } else {
            console.error(`- [FAIL] Stool pH chunk not retrieved.`);
            check4Passed = false;
        }

        results["4. Value Accuracy"] = check4Passed ? "PASS" : "FAIL";
        console.log(`Check 4: ${results["4. Value Accuracy"]}\n`);


        // --- CHECK 5: NON-EXISTENT DATA HANDLING ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 5: Non-existent Data Handling");
        console.log("--------------------------------------------------------");
        
        console.log(`Asking about "Cholesterol" on Report B (Stool report)...`);
        const responseB = await generateChatResponse(
            { userId: testUserId, fileId: reportBId },
            "Stool Analysis",
            "What is my Cholesterol level?"
        );

        console.log(`AI Response:\n"${responseB}"`);
        
        const check5Passed = responseB.toLowerCase().includes("not mentioned in this report");
        if (!check5Passed) {
            console.error(`[FAIL] AI did not state "Not mentioned in this report." when asked about missing data.`);
        }

        results["5. Non-existent Data Handling"] = check5Passed ? "PASS" : "FAIL";
        console.log(`Check 5: ${results["5. Non-existent Data Handling"]}\n`);


        // --- CHECK 6: GENERAL KNOWLEDGE QUESTIONS ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 6: General Knowledge Questions");
        console.log("--------------------------------------------------------");
        
        console.log(`Asking general hydration question on Report B (Stool report)...`);
        const responseGK = await generateChatResponse(
            { userId: testUserId, fileId: reportBId },
            "Stool Analysis",
            "how to stay hydrated"
        );

        console.log(`AI Response:\n"${responseGK}"`);

        const check6Passed = !responseGK.toLowerCase().includes("not mentioned in this report") && responseGK.length > 20;
        if (!check6Passed) {
            console.error(`[FAIL] AI blocked or failed to answer general lifestyle question.`);
        }

        results["6. General Knowledge Questions"] = check6Passed ? "PASS" : "FAIL";
        console.log(`Check 6: ${results["6. General Knowledge Questions"]}\n`);


        // --- CHECK 7: NATIVE VECTOR SEARCH CONFIRMATION ---
        console.log("--------------------------------------------------------");
        console.log("CHECK 7: Native Vector Search Confirmation");
        console.log("--------------------------------------------------------");
        
        // Check if direct aggregate vector search ran successfully (already verified by successful aggregates above)
        // Check if fallbackWarningTriggered was set during execution of generateChatResponse
        console.log(`Fallback warnings triggered: ${fallbackWarningTriggered}`);
        
        const check7Passed = !fallbackWarningTriggered;
        if (fallbackWarningTriggered) {
            console.error(`[FAIL] Fallback in-memory search was triggered! Check if search indexes are properly configured.`);
        }

        results["7. Native Vector Search Confirmation"] = check7Passed ? "PASS" : "FAIL";
        console.log(`Check 7: ${results["7. Native Vector Search Confirmation"]}\n`);

        // Restore original warn function
        console.warn = originalWarn;

    } catch (err) {
        console.error("Test execution error:", err);
    } finally {
        // --- CLEANUP ---
        console.log("--------------------------------------------------------");
        console.log("CLEANING UP TEST DATA");
        console.log("--------------------------------------------------------");
        const deleteResult = await ReportChunk.deleteMany({ userId: testUserId });
        console.log(`Successfully deleted ${deleteResult.deletedCount} temporary chunks.`);
        await mongoose.disconnect();
        console.log("Disconnected from database.\n");

        // --- SUMMARY TABLE ---
        console.log("========================================================");
        console.log("                    TEST RUN SUMMARY                    ");
        console.log("========================================================");
        console.table(Object.entries(results).map(([check, status]) => ({
            "Test Check": check,
            "Result": status
        })));
        console.log("========================================================\n");
    }
}

runTest();
