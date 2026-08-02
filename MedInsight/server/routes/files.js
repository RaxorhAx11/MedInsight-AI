const router = require("express").Router();
const { File } = require("../models/file");
const BloodReport = require("../models/bloodReport");
const UrineReport = require("../models/urineReport");
const StoolReport = require("../models/stoolReport");
const SemenAnalysis = require("../models/semenAnalysis");
const PapSmear = require("../models/papSmear");
const SwabTest = require("../models/swabTest");
const multer = require("multer");
const Joi = require("joi");
const authMiddleware = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");
const pdf = require('pdf-parse');
const biomarkerDescriptions = require("../data/biomarkers.json");
const fs = require('fs');
const path = require('path');
const { getBiomarkerStatus } = require("../services/biomarkerService");

const biomarkersPath = path.resolve(__dirname, '../data/biomarkers.json');
const biomarkersData = JSON.parse(fs.readFileSync(biomarkersPath, 'utf-8'));

// Set up Multer for in-memory storage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user._id;

    try {
        const files = await File.find({ userId: userId }).lean();
        const urls = files.map(file => {
            const fileUrl = file.filePath.startsWith("http")
                ? file.filePath
                : `${req.protocol}://${req.get('host')}/${file.filePath.replace(/\\/g, '/')}`;
            return {
                ...file,
                url: fileUrl
            };
        });
        res.json(urls);
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ message: "Error fetching files" });
    }
});

const renderPageWithLayout = (pageData) => {
    return pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
    })
        .then(function (textContent) {
            let lastY, lastX, text = '';
            for (let item of textContent.items) {
                const currentX = item.transform[4];
                const currentY = item.transform[5];

                if (lastY === currentY || !lastY) {
                    // If it is on the same line, check if there is a horizontal gap
                    // or if it's a new text block. If so, separate with a tab.
                    if (lastX !== undefined && currentX > lastX + 2) {
                        text += '\t' + item.str;
                    } else {
                        text += item.str;
                    }
                } else {
                    text += '\n' + item.str;
                }
                lastY = currentY;
                lastX = currentX + (item.width || 0);
            }
            return text;
        });
};

const extractBiomarkerResults = async (pdfBuffer) => {
    let pdfData;
    let options = {
        pagerender: renderPageWithLayout
    };
    try {
        pdfData = await pdf(pdfBuffer, options);
    } catch (error) {
        console.warn("Initial PDF parsing failed, trying CRLF to LF recovery...");
        try {
            const textContent = pdfBuffer.toString('binary');
            const lfText = textContent.replace(/\r\n/g, '\n');
            const lfBuffer = Buffer.from(lfText, 'binary');
            pdfData = await pdf(lfBuffer, options);
            console.log("PDF parsing successfully recovered after CRLF conversion.");
        } catch (recoveryError) {
            console.error("PDF parsing recovery failed:", recoveryError);
            throw error;
        }
    }
    const text = pdfData.text;
    return parseBiomarkers(text);
};

const parseBiomarkers = (text) => {
    const biomarkers = [];
    const lines = text.split('\n');

    // Iterate through biomarkers.json keys, ordered by length of names/aliases (longest first)
    const sortedBiomarkers = Object.entries(biomarkersData).sort(
        ([a], [b]) => b.length - a.length
    );

    sortedBiomarkers.forEach(([biomarker, biomarkerData]) => {
        // Build a regex to match the full name first, followed by aliases
        const aliasPatterns = [biomarker, ...(biomarkerData.aliases || [])]
            .map(alias => {
                const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const startB = /^\w/.test(alias) ? '\\b' : '';
                const endB = /\w$/.test(alias) ? '\\b' : '';
                return `${startB}${escaped}${endB}`;
            })
            .join('|');

        const minVal = biomarkerData.referenceRange.min;
        const maxVal = biomarkerData.referenceRange.max;
        const isNumericRange = minVal !== undefined && maxVal !== undefined &&
            !isNaN(parseFloat(minVal)) && !isNaN(parseFloat(maxVal));

        // 1. Try numeric match first
        let matched = false;
        const numericRegex = new RegExp(`(${aliasPatterns}).*?([0-9.]+)(?!\\s*-\\s*[0-9.])`, 'i');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(numericRegex);
            if (match) {
                let resultValue = parseFloat(match[2]);

                // Validate the extracted result to avoid unrealistic values
                if (isNaN(resultValue) || resultValue < 0 || resultValue > 1e6) {
                    continue; // Skip invalid matches
                }

                // Normalize the value dynamically if it's significantly smaller than the reference range
                const minRef = parseFloat(minVal);
                if (isNumericRange && resultValue < minRef / 100 && resultValue > 0) {
                    const scalingFactor = Math.pow(10, Math.floor(Math.log10(minRef)) - Math.floor(Math.log10(resultValue)));
                    resultValue *= scalingFactor;
                }

                // Add the biomarker to the results
                biomarkers.push({
                    testName: biomarker,
                    description: biomarkerData.description,
                    resultValue,
                    unit: biomarkerData.unit,
                    referenceRange: biomarkerData.referenceRange,
                    status: getBiomarkerStatus(resultValue, biomarkerData.referenceRange),
                });

                // Move to the next line after a match to prevent overlapping matches
                matched = true;
                break;
            }
        }

        // 2. Try qualitative match if no numeric match found
        if (!matched) {
            // Allows symbols like '+' in results (e.g. '1+' or '+')
            const qualRegex = new RegExp(`(${aliasPatterns})[\\s:\\-]*([a-zA-Z0-9\\(\\)/\\-_+]+(?: [a-zA-Z0-9\\(\\)/\\-_+]+)*)`, 'i');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(qualRegex);
                if (match) {
                    let rawResult = match[2].trim();

                    // Clean up the raw result (e.g. remove reference ranges in parenthesis)
                    let cleanResult = rawResult
                        .replace(/\s*\([^)]*(ref|normal|range|negative|positive|min|max)[^)]*\)/i, "")
                        .replace(/\s*\((Negative|Positive|Normal|None|Balanced|Dysbiosis)\)/i, "")
                        .trim();

                    if (!cleanResult || cleanResult.length < 1) {
                        continue;
                    }

                    // Keep it concise - usually the result is 1-3 words
                    const words = cleanResult.split(/\s+/);
                    if (words.length > 4) {
                        cleanResult = words.slice(0, 3).join(" ");
                    }

                    if (cleanResult.toLowerCase().includes("ref")) {
                        cleanResult = cleanResult.split(/ref/i)[0].trim();
                    }
                    if (cleanResult.toLowerCase().includes("normal")) {
                        cleanResult = cleanResult.split(/normal/i)[0].trim();
                    }

                    cleanResult = cleanResult.replace(/[:,\-\s]+$/, "").trim();

                    if (cleanResult.length >= 1) {
                        biomarkers.push({
                            testName: biomarker,
                            description: biomarkerData.description,
                            resultValue: cleanResult,
                            unit: biomarkerData.unit,
                            referenceRange: biomarkerData.referenceRange,
                            status: getBiomarkerStatus(cleanResult, biomarkerData.referenceRange),
                        });
                        break;
                    }
                }
            }
        }
    });

    return biomarkers;
};

router.post("/", authMiddleware, rateLimiter(15), (req, res, next) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            return res.status(400).send({ message: err.message });
        }
        
        let uploadResult = null;
        try {
            const userId = req.user._id;

            if (!req.file) return res.status(400).send({ message: "File is required." });

            if (req.file.mimetype !== "application/pdf") {
                return res.status(400).send({ message: "Invalid file type. Only PDF files are supported." });
            }

            let biomarkers = [];
            try {
                // Parse directly from memory buffer
                biomarkers = await extractBiomarkerResults(req.file.buffer);
            } catch (error) {
                console.error("Error parsing PDF:", error);
                return res.status(500).send({ message: "Error processing PDF data." });
            }

            // Upload the file to Cloudinary / Fallback Local Storage
            const { uploadFile } = require("../services/cloudStorageService");
            try {
                uploadResult = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'report');
            } catch (uploadError) {
                console.error("Storage upload failed:", uploadError);
                return res.status(500).send({ message: "Failed to store uploaded file." });
            }

            const file = new File({
                userId,
                fileName: req.file.originalname,
                filePath: uploadResult.url,
                publicId: uploadResult.publicId,
                mimetype: req.file.mimetype,
                description: req.body.description,
                testDate: req.body.testDate
            });

            await file.save();

            // Trigger upload success notification and activity log
            try {
                const { createNotification } = require("../services/notificationService");
                await createNotification(
                    userId,
                    "success",
                    `New report "${req.file.originalname}" was uploaded successfully.`,
                    "/reports"
                );
                
                const { logActivity } = require("../services/activityService");
                await logActivity(
                    userId,
                    "upload",
                    "Report Uploaded",
                    `New report "${req.file.originalname}" was uploaded successfully.`,
                    "Completed"
                );
            } catch (notifErr) {
                console.error("Error creating upload notifications/activities:", notifErr);
            }

            res.status(201).send({
                message: "File uploaded and biomarker results extracted successfully!",
                biomarkers,
                fileId: file._id,
            });
        } catch (error) {
            console.error("Internal Server Error:", error);
            if (uploadResult) {
                try {
                    const { deleteFile } = require("../services/cloudStorageService");
                    await deleteFile(uploadResult.url, uploadResult.publicId, 'report');
                } catch (delErr) {
                    console.error("Failed to clean up uploaded file on error:", delErr);
                }
            }
            res.status(500).send({ message: "Internal Server Error" });
        }
    });
});

router.delete("/:id", authMiddleware, async (req, res) => {
    // Validate Mongo ID
    const { error } = Joi.string().hex().length(24).required().validate(req.params.id);
    if (error) {
        return res.status(400).send({ message: "Invalid File ID format" });
    }

    try {
        const userId = req.user._id;
        const fileId = req.params.id;

        const file = await File.findOne({ _id: fileId, userId: userId });
        if (!file) {
            return res.status(404).send({ message: "File not found." });
        }

        // Delete the file from Cloud or Local Storage
        const { deleteFile } = require("../services/cloudStorageService");
        await deleteFile(file.filePath, file.publicId, 'report');

        // Calculate a 24-hour window around the file's testDate for matching reports without fileId
        const fileDate = new Date(file.testDate || file.uploadDate);
        const minDate = new Date(fileDate.getTime() - 24 * 60 * 60 * 1000);
        const maxDate = new Date(fileDate.getTime() + 24 * 60 * 60 * 1000);

        // Delete query matching by direct fileId OR (matching date window AND missing fileId)
        const deleteQuery = {
            userId: userId,
            $or: [
                { fileId: fileId },
                {
                    $and: [
                        { $or: [{ fileId: { $exists: false } }, { fileId: null }] },
                        { reportDate: { $gte: minDate, $lte: maxDate } }
                    ]
                }
            ]
        };

        // Delete all associated report documents across all collections
        await Promise.all([
            BloodReport.deleteMany(deleteQuery),
            UrineReport.deleteMany(deleteQuery),
            StoolReport.deleteMany(deleteQuery),
            SemenAnalysis.deleteMany(deleteQuery),
            PapSmear.deleteMany(deleteQuery),
            SwabTest.deleteMany(deleteQuery)
        ]);

        // Delete the record from the database
        await File.deleteOne({ _id: fileId, userId: userId });

        // Log delete activity
        try {
            const { logActivity } = require("../services/activityService");
            await logActivity(
                userId,
                "delete",
                "Report Deleted",
                `Report "${file.fileName}" was deleted.`,
                "Completed"
            );
        } catch (actErr) {
            console.error("Error logging delete activity:", actErr);
        }

        res.status(200).send({ message: "File deleted successfully!" });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
});

module.exports = router;
