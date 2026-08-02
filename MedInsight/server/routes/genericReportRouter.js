const routerFactory = require("express").Router;
const authMiddleware = require("../middleware/auth");
const { getBiomarkerStatus, filterAndMapBiomarkers, REPORT_BIOMARKERS } = require("../services/biomarkerService");
const Joi = require("joi");

const biomarkersData = require("../data/biomarkers.json");

const validateReport = (data) => {
    const schema = Joi.object({
        reportDate: Joi.date().required().label("Report Date"),
        biomarkers: Joi.array().required().label("Biomarkers"),
        description: Joi.string().allow('').optional().label("Description"),
        fileId: Joi.string().hex().length(24).allow(null, '').optional().label("File ID")
    });
    return schema.validate(data);
};

const createGenericReportRouter = (Model, reportTypeName) => {
    const router = routerFactory();

    // Endpoint to fetch most recent biomarkers for this report type
    router.get("/biomarkers", authMiddleware, async (req, res) => {
        try {
            const userId = req.user._id;

            // Fetch all reports for the user, sorted by reportDate descending
            const reports = await Model.find({ userId })
                .sort({ reportDate: -1 })
                .lean();

            // Build a map of the most recent biomarkers
            const biomarkerMap = new Map();

            if (reports && reports.length > 0) {
                for (const report of reports) {
                    for (const biomarker of report.biomarkers) {
                        if (!biomarkerMap.has(biomarker.name)) {
                            biomarkerMap.set(biomarker.name, {
                                name: biomarker.name,
                                description: biomarker.description,
                                result: biomarker.result,
                                unit: biomarker.unit,
                                referenceRange: biomarker.referenceRange,
                                status: biomarker.status || getBiomarkerStatus(biomarker.result, biomarker.referenceRange),
                                reportDate: report.reportDate,
                            });
                        }
                    }
                }
            }

            // Fill in missing expected biomarkers for this report type
            const expectedList = REPORT_BIOMARKERS[reportTypeName] || [];
            const latestReportDate = reports[0] ? reports[0].reportDate : new Date();

            for (const expectedName of expectedList) {
                if (!biomarkerMap.has(expectedName)) {
                    const bData = biomarkersData[expectedName];
                    biomarkerMap.set(expectedName, {
                        name: expectedName,
                        description: bData ? bData.description : "",
                        result: "Not mentioned in report",
                        unit: bData ? bData.unit : "",
                        referenceRange: bData ? bData.referenceRange : { min: "", max: "" },
                        status: "Not Mentioned",
                        reportDate: latestReportDate
                    });
                }
            }

            // Order the biomarkers consistently
            const orderedBiomarkers = [];
            for (const expectedName of expectedList) {
                if (biomarkerMap.has(expectedName)) {
                    orderedBiomarkers.push(biomarkerMap.get(expectedName));
                }
            }

            // Fallback for any other biomarkers in the map that were not in the expected list
            for (const [key, value] of biomarkerMap.entries()) {
                if (!expectedList.includes(key)) {
                    orderedBiomarkers.push(value);
                }
            }

            res.json(orderedBiomarkers);
        } catch (error) {
            console.error(`Error fetching ${reportTypeName} biomarkers:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Endpoint to fetch the most recent report for a user
    router.get("/latest", authMiddleware, async (req, res) => {
        try {
            const userId = req.user._id;

            const latestReport = await Model.findOne({ userId })
                .sort({ reportDate: -1 })
                .lean();

            if (!latestReport) {
                return res.status(404).json({ message: `No ${reportTypeName} reports found for user` });
            }

            res.json(latestReport);
        } catch (error) {
            console.error(`Error fetching latest ${reportTypeName} report:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Endpoint to fetch historical data for a specific biomarker
    router.get("/history/:biomarker", authMiddleware, async (req, res) => {
        const { error } = Joi.string().trim().max(100).required().validate(req.params.biomarker);
        if (error) {
            return res.status(400).json({ error: "Invalid biomarker format" });
        }
        const { biomarker } = req.params;
        try {
            const userId = req.user._id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized access" });
            }

            // Fetch all reports for the user, sorted by date
            const reports = await Model.find({ userId }).sort({ reportDate: 1 }).lean();
            // Extract historical values for the specified biomarker
            const history = reports
                .map((report) => {
                    const biomarkerData = report.biomarkers.find((b) => b.name.toLowerCase() === biomarker.toLowerCase());

                    return biomarkerData
                        ? {
                              date: new Date(report.reportDate).toLocaleDateString("en-US"),
                              value: biomarkerData.result,
                              unit: biomarkerData.unit,
                              normalRange: biomarkerData.referenceRange,
                              description: biomarkerData.description,
                          }
                        : null;
                })
                .filter(Boolean);

            if (!history.length) {
                return res.status(404).json({ message: `No data found for biomarker: ${biomarker}` });
            }
            res.json(history);
        } catch (error) {
            console.error(`Error fetching biomarker history for ${reportTypeName}:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Endpoint to provide data for LLM insights
    router.get("/llm/insights", authMiddleware, async (req, res) => {
        try {
            const userId = req.user._id;

            const reports = await Model.find({ userId })
                .sort({ reportDate: -1 })
                .lean();

            if (!reports.length) {
                return res.status(404).json({ message: `No ${reportTypeName} reports found for user` });
            }

            const mostRecentReport = reports[0];
            const historicalData = {};

            reports.forEach((report) => {
                report.biomarkers.forEach((biomarker) => {
                    if (!historicalData[biomarker.name]) {
                        historicalData[biomarker.name] = [];
                    }
                    historicalData[biomarker.name].push({
                        date: report.reportDate,
                        value: biomarker.result,
                        unit: biomarker.unit,
                    });
                });
            });

            res.json({
                mostRecent: mostRecentReport,
                historical: historicalData,
            });
        } catch (error) {
            console.error(`Error fetching insights for ${reportTypeName}:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Endpoint to save a new report
    router.post("/", authMiddleware, async (req, res) => {
        try {
            const userId = req.user._id;
            const { error, value } = validateReport(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }
            const { reportDate, biomarkers, fileId, description } = value;

            // Format and filter biomarkers to match MongoDB schema
            const formattedBiomarkers = filterAndMapBiomarkers(biomarkers, reportTypeName);

            const report = new Model({
                userId: userId,
                reportDate: new Date(reportDate),
                biomarkers: formattedBiomarkers,
                description: description,
                fileId: fileId || undefined
            });

            await report.save();

            // Trigger AI analysis and biomarker anomalies checks
            try {
                const { handleBiomarkerAnalysisNotifications } = require("../services/notificationService");
                await handleBiomarkerAnalysisNotifications(userId, reportTypeName, reportDate, formattedBiomarkers);
            } catch (notifErr) {
                console.error(`Error running biomarker notifications for ${reportTypeName}:`, notifErr);
            }

            res.status(201).send({
                message: `${reportTypeName} report saved successfully!`,
                report
            });
        } catch (error) {
            console.error(`Error saving ${reportTypeName} report:`, error);
            res.status(500).send({ message: "Internal Server Error" });
        }
    });

    return router;
};

module.exports = createGenericReportRouter;
