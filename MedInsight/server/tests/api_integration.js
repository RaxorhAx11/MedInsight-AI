const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../db");

// Import and register all database schemas
const { User } = require("../models/user");
const { File } = require("../models/file");
const BloodReport = require("../models/bloodReport");
const UrineReport = require("../models/urineReport");
const StoolReport = require("../models/stoolReport");
const SemenAnalysis = require("../models/semenAnalysis");
const PapSmear = require("../models/papSmear");
const SwabTest = require("../models/swabTest");
const Conversation = require("../models/conversation");
const Notification = require("../models/notification");
const Activity = require("../models/activity");

const BASE_URL = `http://localhost:${process.env.PORT || 8080}/api`;
const TEST_EMAIL = `qa_test_${Date.now()}@medinsight-test.com`;
const TEST_PASSWORD = "Password123!"; // Min 8, lower, upper, number, symbol

// Color logging helpers
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
    error: (msg, err = "") => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`, err),
    section: (title) => console.log(`\n\x1b[34m=== ${title} ===\x1b[0m`),
};

// Report types mapping
const reportTypes = [
    { type: "bloodreport", label: "Blood" },
    { type: "urinereport", label: "Urine" },
    { type: "stoolreport", label: "Stool" },
    { type: "semenanalysis", label: "Semen Analysis" },
    { type: "papsmear", label: "Pap Smear" },
    { type: "swabtest", label: "Swab Test" }
];

async function runTests() {
    log.section("INITIALIZING API INTEGRATION TESTS");
    log.info(`API Base URL: ${BASE_URL}`);

    // 1. Database Connection
    log.info("Connecting to MongoDB for database validation and final cleanup...");
    try {
        await connectDB();
        log.success("Connected to MongoDB successfully.");
    } catch (err) {
        log.error("Failed to connect to MongoDB.", err);
        process.exit(1);
    }

    let token = "";
    let userId = "";
    let uploadedFileId = "";
    let createdReportIds = {};

    // 2. User Registration (POST /api/users)
    log.section("1. USER REGISTRATION");
    try {
        const payload = {
            firstName: "QA",
            lastName: "Tester",
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            age: 30,
            height: "175 cm",
            weight: "70 kg",
            sex: "Male"
        };
        const res = await fetch(`${BASE_URL}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.status === 201) {
            log.success(`User registered successfully: ${TEST_EMAIL}`);
        } else {
            throw new Error(`Status: ${res.status}, Message: ${data.message}`);
        }
    } catch (err) {
        log.error("User registration failed.", err);
        await cleanupAndExit(1);
    }

    // 3. User Login & Token retrieval (POST /api/auth)
    log.section("2. USER LOGIN");
    try {
        const payload = {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        };
        const res = await fetch(`${BASE_URL}/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.status === 200) {
            token = data.data;
            log.success("User logged in successfully. Token acquired.");
            // Decode userId from JWT manually
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const decoded = JSON.parse(Buffer.from(base64, "base64").toString());
            userId = decoded._id;
            log.info(`Extracted userId from JWT: ${userId}`);
        } else {
            throw new Error(`Status: ${res.status}, Message: ${data.message}`);
        }
    } catch (err) {
        log.error("User login failed.", err);
        await cleanupAndExit(1);
    }

    const authHeader = { "Authorization": `Bearer ${token}` };

    // 4. Retrieve Profile & Settings Update (GET / PUT /api/users/profile)
    log.section("3. USER PROFILE & SETTINGS");
    try {
        // Fetch
        let res = await fetch(`${BASE_URL}/users/profile`, { headers: authHeader });
        let profile = await res.json();
        if (res.status === 200) {
            log.success(`Profile retrieved. Email verified: ${profile.email}`);
        } else {
            throw new Error(`Fetch profile status: ${res.status}, Message: ${profile.message}`);
        }

        // Update settings
        const settingsPayload = {
            theme: "dark",
            emailAlerts: false,
            aiInsights: true,
            autoAnomaly: false
        };
        res = await fetch(`${BASE_URL}/users/profile/settings`, {
            method: "PUT",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(settingsPayload)
        });
        const settings = await res.json();
        if (res.status === 200 && settings.theme === "dark" && settings.emailAlerts === false) {
            log.success("Profile settings updated successfully.");
        } else {
            throw new Error(`Update settings status: ${res.status}, Response: ${JSON.stringify(settings)}`);
        }
    } catch (err) {
        log.error("Profile/settings test failed.", err);
        await cleanupAndExit(1);
    }

    // 5. Upload Avatar (POST /api/users/profile/avatar)
    log.section("4. AVATAR UPLOAD");
    try {
        const dummyAvatarPath = path.resolve(__dirname, "dummy_avatar.png");
        fs.writeFileSync(dummyAvatarPath, "dummy image content bytes");

        const form = new FormData();
        const fileBuffer = fs.readFileSync(dummyAvatarPath);
        const fileBlob = new Blob([fileBuffer], { type: "image/png" });
        form.append("avatar", fileBlob, "dummy_avatar.png");

        const res = await fetch(`${BASE_URL}/users/profile/avatar`, {
            method: "POST",
            headers: authHeader,
            body: form
        });

        const data = await res.json();
        fs.unlinkSync(dummyAvatarPath);

        if (res.status === 200) {
            log.success(`Avatar uploaded successfully. URL: ${data.avatarUrl}`);
        } else {
            throw new Error(`Avatar upload status: ${res.status}, Message: ${data.message}`);
        }
    } catch (err) {
        log.error("Avatar upload failed.", err);
        await cleanupAndExit(1);
    }

    // 6. Upload PDF Report (POST /api/files)
    log.section("5. REPORT PDF UPLOAD & PARSING");
    try {
        const samplePdfPath = path.resolve(__dirname, "../../client/src/Urine_Report_Slightly_Abnormal.pdf");
        if (!fs.existsSync(samplePdfPath)) {
            throw new Error(`Sample PDF not found at: ${samplePdfPath}`);
        }

        const form = new FormData();
        const fileBuffer = fs.readFileSync(samplePdfPath);
        const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });
        form.append("file", fileBlob, "Urine_Report_Slightly_Abnormal.pdf");
        form.append("description", "QA automated test report PDF");
        form.append("testDate", new Date().toISOString());

        const res = await fetch(`${BASE_URL}/files`, {
            method: "POST",
            headers: authHeader,
            body: form
        });

        const data = await res.json();
        if (res.status === 201) {
            uploadedFileId = data.fileId;
            log.success(`PDF uploaded and parsed successfully. fileId: ${uploadedFileId}`);
            log.info(`Extracted biomarkers count: ${data.biomarkers.length}`);
            if (data.biomarkers.length > 0) {
                log.info(`Sample parsed biomarker: ${data.biomarkers[0].testName} = ${data.biomarkers[0].resultValue} (${data.biomarkers[0].status})`);
            }
        } else {
            throw new Error(`PDF upload status: ${res.status}, Message: ${data.message}`);
        }
    } catch (err) {
        log.error("PDF report upload/parsing failed.", err);
        await cleanupAndExit(1);
    }

    // 7. Get Files List (GET /api/files)
    log.section("6. FILES LIST RETRIEVAL");
    try {
        const res = await fetch(`${BASE_URL}/files`, { headers: authHeader });
        const list = await res.json();
        if (res.status === 200 && Array.isArray(list)) {
            const uploadedFile = list.find(f => f._id === uploadedFileId);
            if (uploadedFile) {
                log.success("Files list fetched correctly. Uploaded file found in list.");
            } else {
                throw new Error("Uploaded file not present in files list response.");
            }
        } else {
            throw new Error(`Files list status: ${res.status}`);
        }
    } catch (err) {
        log.error("Files list retrieval failed.", err);
        await cleanupAndExit(1);
    }

    // 8. CRUD on Reports & Custom API endpoints (/api/<reportType>)
    log.section("7. GENERIC REPORTS API VERIFICATION");
    for (const { type, label } of reportTypes) {
        log.info(`Verifying endpoints for Report Type: ${label} (${type})`);
        try {
            // Save report (POST)
            let testBiomarkers = [];
            if (label === "Blood") {
                testBiomarkers = [
                    { name: "Hemoglobin", result: 13.2 },
                    { name: "WhiteBloodCells", result: 8.5 }
                ];
            } else if (label === "Urine") {
                testBiomarkers = [
                    { name: "Urine pH", result: 6.5 },
                    { name: "Urine Glucose", result: "Negative" }
                ];
            } else if (label === "Stool") {
                testBiomarkers = [
                    { name: "Stool Color", result: "Brown" },
                    { name: "Stool RBC", result: "None" }
                ];
            } else if (label === "Semen Analysis") {
                testBiomarkers = [
                    { name: "Semen Volume", result: 3.5 },
                    { name: "Sperm Concentration", result: 25 }
                ];
            } else if (label === "Pap Smear") {
                testBiomarkers = [
                    { name: "Specimen Adequacy", result: "Satisfactory" },
                    { name: "Negative for Intraepithelial Lesion", result: "Normal" }
                ];
            } else if (label === "Swab Test") {
                testBiomarkers = [
                    { name: "Swab Specimen Type", result: "Nasal" },
                    { name: "Swab Culture Result", result: "No growth" }
                ];
            }

            const reportPayload = {
                reportDate: new Date().toISOString(),
                biomarkers: testBiomarkers,
                description: `Manual test ${label} report`,
                fileId: uploadedFileId || ""
            };

            let res = await fetch(`${BASE_URL}/${type}`, {
                method: "POST",
                headers: { ...authHeader, "Content-Type": "application/json" },
                body: JSON.stringify(reportPayload)
            });
            let data = await res.json();
            if (res.status === 201) {
                createdReportIds[type] = data.report._id;
                log.success(`  [POST /] Report saved. ID: ${createdReportIds[type]}`);
            } else {
                throw new Error(`POST / failed with status: ${res.status}, Message: ${data.message}`);
            }

            // Get Biomarkers (GET /biomarkers)
            res = await fetch(`${BASE_URL}/${type}/biomarkers`, { headers: authHeader });
            data = await res.json();
            if (res.status === 200 && Array.isArray(data)) {
                log.success(`  [GET /biomarkers] Retrieved. Count: ${data.length}`);
            } else {
                throw new Error(`GET /biomarkers failed with status: ${res.status}`);
            }

            // Get Latest (GET /latest)
            res = await fetch(`${BASE_URL}/${type}/latest`, { headers: authHeader });
            data = await res.json();
            if (res.status === 200 && data._id === createdReportIds[type]) {
                log.success(`  [GET /latest] Latest report match verified.`);
            } else {
                throw new Error(`GET /latest failed with status: ${res.status}`);
            }

            // Get History (GET /history/:biomarker)
            const testBiomarkerName = testBiomarkers[0].name;
            res = await fetch(`${BASE_URL}/${type}/history/${encodeURIComponent(testBiomarkerName)}`, { headers: authHeader });
            data = await res.json();
            if (res.status === 200 && Array.isArray(data) && data.length > 0) {
                log.success(`  [GET /history/:biomarker] History fetched. Entries: ${data.length}`);
            } else {
                throw new Error(`GET /history/:biomarker failed with status: ${res.status}`);
            }

            // Get LLM Insights (GET /llm/insights)
            res = await fetch(`${BASE_URL}/${type}/llm/insights`, { headers: authHeader });
            data = await res.json();
            if (res.status === 200 && data.mostRecent && data.historical) {
                log.success(`  [GET /llm/insights] Insights data format verified.`);
            } else {
                throw new Error(`GET /llm/insights failed with status: ${res.status}`);
            }
        } catch (err) {
            log.error(`Endpoints validation failed for report type: ${label}`, err);
            await cleanupAndExit(1);
        }
    }

    // 9. AI Chatbot & Conversations
    log.section("8. AI CHATBOT & CONVERSATION HISTORY");
    const conversationID = `conv-${Date.now()}`;
    try {
        // GET Reports for Selector
        let res = await fetch(`${BASE_URL}/conversations/reports`, { headers: authHeader });
        let reportsData = await res.json();
        if (res.status === 200 && Array.isArray(reportsData.reports)) {
            log.success(`[GET /conversations/reports] Fetched reports. Count: ${reportsData.reports.length}`);
        } else {
            throw new Error(`GET /conversations/reports failed with status: ${res.status}`);
        }

        // POST chat message without report ID (should explain report selection)
        let chatPayload = {
            message: "What is my health status?",
            conversationID,
            topic: "General Inquiry"
        };
        res = await fetch(`${BASE_URL}/conversations/chat`, {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(chatPayload)
        });
        let chatRes = await res.json();
        if (res.status === 200 && chatRes.botResponse.includes("select a medical report")) {
            log.success("[POST /conversations/chat] Blocked request without selected report successfully.");
        } else {
            throw new Error(`POST /conversations/chat without report ID status: ${res.status}, Response: ${chatRes.botResponse}`);
        }

        // POST chat message WITH report ID (should call Gemini RAG and return response)
        const sampleReportId = createdReportIds["urinereport"];
        chatPayload = {
            message: "My urine pH is 6.5. Is this normal?",
            conversationID,
            reportId: sampleReportId,
            topic: "Urine Test Query"
        };
        log.info("Sending query with report selected to Gemini AI Chatbot...");
        res = await fetch(`${BASE_URL}/conversations/chat`, {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(chatPayload)
        });
        chatRes = await res.json();
        if (res.status === 200 && chatRes.botResponse) {
            log.success(`[POST /conversations/chat] Gemini chatbot replied: "${chatRes.botResponse.substring(0, 100)}..."`);
        } else {
            throw new Error(`POST /conversations/chat with report ID status: ${res.status}, Response: ${JSON.stringify(chatRes)}`);
        }

        // GET Conversations list
        res = await fetch(`${BASE_URL}/conversations/user`, { headers: authHeader });
        const convs = await res.json();
        if (res.status === 200 && Array.isArray(convs.conversations) && convs.conversations.length > 0) {
            log.success(`[GET /conversations/user] List fetched. Count: ${convs.conversations.length}`);
        } else {
            throw new Error(`GET /conversations/user status: ${res.status}, Convs: ${JSON.stringify(convs)}`);
        }

        // GET Specific conversation history
        res = await fetch(`${BASE_URL}/conversations/conversation/${conversationID}`, { headers: authHeader });
        const history = await res.json();
        if (res.status === 200 && Array.isArray(history) && history.length >= 4) { // 2 user messages, 2 bot responses
            log.success(`[GET /conversations/conversation/:id] History contains ${history.length} messages.`);
        } else {
            throw new Error(`GET /conversations/conversation/:id status: ${res.status}, Length: ${history ? history.length : 0}`);
        }

        // DELETE Specific conversation
        res = await fetch(`${BASE_URL}/conversations/conversation/${conversationID}`, {
            method: "DELETE",
            headers: authHeader
        });
        if (res.status === 200) {
            log.success("[DELETE /conversations/conversation/:id] Deleted successfully.");
        } else {
            throw new Error(`DELETE conversation status: ${res.status}`);
        }

        // DELETE Clear all conversations
        res = await fetch(`${BASE_URL}/conversations/clear`, {
            method: "DELETE",
            headers: authHeader
        });
        if (res.status === 200) {
            log.success("[DELETE /conversations/clear] Cleared all successfully.");
        } else {
            throw new Error(`DELETE clear status: ${res.status}`);
        }
    } catch (err) {
        log.error("AI chatbot or conversation tests failed.", err);
        await cleanupAndExit(1);
    }

    // 10. Notifications
    log.section("9. NOTIFICATIONS API");
    try {
        // GET notifications
        let res = await fetch(`${BASE_URL}/notifications`, { headers: authHeader });
        let notifs = await res.json();
        if (res.status === 200 && Array.isArray(notifs)) {
            log.success(`[GET /notifications] Retrieved. Count: ${notifs.length}`);
            if (notifs.length > 0) {
                const notifId = notifs[0]._id;

                // PUT mark read
                res = await fetch(`${BASE_URL}/notifications/${notifId}/read`, {
                    method: "PUT",
                    headers: authHeader
                });
                if (res.status === 200) {
                    log.success("[PUT /notifications/:id/read] Notification marked read.");
                } else {
                    throw new Error(`PUT /notifications/:id/read status: ${res.status}`);
                }
            }
        } else {
            throw new Error(`GET /notifications status: ${res.status}`);
        }

        // PUT mark all read
        res = await fetch(`${BASE_URL}/notifications/read-all`, {
            method: "PUT",
            headers: authHeader
        });
        if (res.status === 200) {
            log.success("[PUT /notifications/read-all] Marked all read.");
        } else {
            throw new Error(`PUT /notifications/read-all status: ${res.status}`);
        }

        // DELETE dismiss notification
        if (notifs.length > 0) {
            const notifId = notifs[0]._id;
            res = await fetch(`${BASE_URL}/notifications/${notifId}`, {
                method: "DELETE",
                headers: authHeader
            });
            if (res.status === 200) {
                log.success("[DELETE /notifications/:id] Dismissed notification successfully.");
            } else {
                throw new Error(`DELETE /notifications/:id status: ${res.status}`);
            }
        }

        // DELETE clear all notifications
        res = await fetch(`${BASE_URL}/notifications`, {
            method: "DELETE",
            headers: authHeader
        });
        if (res.status === 200) {
            log.success("[DELETE /notifications] Cleared all notifications successfully.");
        } else {
            throw new Error(`DELETE /notifications status: ${res.status}`);
        }
    } catch (err) {
        log.error("Notifications API validation failed.", err);
        await cleanupAndExit(1);
    }

    // 11. Activities
    log.section("10. ACTIVITIES LOGGING");
    try {
        // POST manual custom activity
        const actPayload = {
            activityType: "settings",
            title: "Security Scan Run",
            description: "QA automated audit test scan was run.",
            status: "Completed"
        };
        let res = await fetch(`${BASE_URL}/activities`, {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(actPayload)
        });
        let actData = await res.json();
        if (res.status === 201) {
            log.success(`[POST /activities] Logged manual activity. ID: ${actData._id}`);
        } else {
            throw new Error(`POST /activities failed with status: ${res.status}`);
        }

        // GET activities
        res = await fetch(`${BASE_URL}/activities`, { headers: authHeader });
        const list = await res.json();
        if (res.status === 200 && Array.isArray(list) && list.length > 0) {
            log.success(`[GET /activities] Retrieved activity log list. Size: ${list.length}`);
            log.info(`Latest activity title: "${list[0].title}"`);
        } else {
            throw new Error(`GET /activities status: ${res.status}`);
        }
    } catch (err) {
        log.error("Activities API validation failed.", err);
        await cleanupAndExit(1);
    }

    // 12. Delete File & Report Auto-cleanup (DELETE /api/files/:id)
    log.section("11. UPLOAD FILE & LINKED REPORTS CASCADE DELETION");
    try {
        // Let's verify files are still in database and we have reports
        const fileExistsBefore = await File.exists({ _id: uploadedFileId });
        log.info(`File exists before delete check: ${!!fileExistsBefore}`);

        const res = await fetch(`${BASE_URL}/files/${uploadedFileId}`, {
            method: "DELETE",
            headers: authHeader
        });
        const data = await res.json();

        if (res.status === 200) {
            log.success("DELETE /api/files/:id deleted the file successfully.");
            
            // Check database to verify cascade deletion deleted the reports
            const fileExistsAfter = await File.exists({ _id: uploadedFileId });
            const linkedReportsCount = await UrineReport.countDocuments({ userId, fileId: uploadedFileId });
            
            if (!fileExistsAfter && linkedReportsCount === 0) {
                log.success("Cascade check verified: File and all associated report database entries were purged successfully.");
            } else {
                throw new Error(`Purger failed: File exists: ${fileExistsAfter}, Linked reports left: ${linkedReportsCount}`);
            }
        } else {
            throw new Error(`DELETE /files/:id failed with status: ${res.status}, Message: ${data.message}`);
        }
    } catch (err) {
        log.error("Cascade deletion test failed.", err);
        await cleanupAndExit(1);
    }

    log.section("ALL API ENDPOINTS TESTED SUCCESSFULLY!");
    await cleanupAndExit(0);
}

async function cleanupAndExit(exitCode) {
    log.section("CLEANING UP DATABASE RECORDS");
    try {
        // Delete all records associated with TEST_EMAIL
        const testUser = await User.findOne({ email: TEST_EMAIL });
        if (testUser) {
            const uid = testUser._id;
            log.info(`Deleting records for test userId: ${uid}`);

            // Delete uploads from uploads/ folder
            const files = await File.find({ userId: uid });
            for (const f of files) {
                const absPath = path.resolve(__dirname, "../", f.filePath);
                if (fs.existsSync(absPath)) {
                    fs.unlinkSync(absPath);
                    log.info(`  Cleaned up uploaded file: ${f.filePath}`);
                }
            }

            // Clean up avatar if any
            if (testUser.avatar) {
                const avatarRel = testUser.avatar.replace(/https?:\/\/[^\/]+\//, "");
                const avatarAbs = path.resolve(__dirname, "../", avatarRel);
                if (fs.existsSync(avatarAbs) && !avatarRel.includes("default")) {
                    fs.unlinkSync(avatarAbs);
                    log.info(`  Cleaned up avatar: ${avatarRel}`);
                }
            }

            const results = await Promise.all([
                File.deleteMany({ userId: uid }),
                BloodReport.deleteMany({ userId: uid }),
                UrineReport.deleteMany({ userId: uid }),
                StoolReport.deleteMany({ userId: uid }),
                SemenAnalysis.deleteMany({ userId: uid }),
                PapSmear.deleteMany({ userId: uid }),
                SwabTest.deleteMany({ userId: uid }),
                Conversation.deleteMany({ userId: uid }),
                Notification.deleteMany({ userId: uid }),
                Activity.deleteMany({ userId: uid }),
                User.deleteOne({ _id: uid })
            ]);

            log.success("All test user data scrubbed from MongoDB successfully.");
        } else {
            log.info("No test user found in database. Skipping database purge.");
        }
    } catch (err) {
        log.error("Error during database scrubbing.", err);
    } finally {
        await mongoose.disconnect();
        log.info("MongoDB disconnected.");
        process.exit(exitCode);
    }
}

// Start
runTests().catch(err => {
    log.error("Fatal test suite crash.", err);
    process.exit(1);
});
