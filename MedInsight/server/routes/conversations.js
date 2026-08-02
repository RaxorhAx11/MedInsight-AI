const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const { saveMessage, getConversationsByUser, getConversationByID, deleteConversationByID, clearAllConversations } = require("../controllers/conversationController");
const { generateChatResponse } = require("../services/aiService");
const Joi = require("joi");
const rateLimiter = require("../middleware/rateLimiter");

const validateChat = (data) => {
	const schema = Joi.object({
		message: Joi.string().required().label("Message"),
		messages: Joi.array().optional().label("Messages"),
		reportId: Joi.string().hex().length(24).allow(null, '').optional().label("Report ID"),
		conversationID: Joi.string().required().label("Conversation ID"),
		topic: Joi.string().optional().allow('').label("Topic")
	});
	return schema.validate(data);
};

const BloodReport = require("../models/bloodReport");
const UrineReport = require("../models/urineReport");
const StoolReport = require("../models/stoolReport");
const SemenAnalysis = require("../models/semenAnalysis");
const PapSmear = require("../models/papSmear");
const SwabTest = require("../models/swabTest");
const { File } = require("../models/file");

const reportTypes = [
    { Model: BloodReport, name: "Blood Test" },
    { Model: UrineReport, name: "Urine Test" },
    { Model: StoolReport, name: "Stool Test" },
    { Model: SemenAnalysis, name: "Semen Analysis" },
    { Model: PapSmear, name: "Pap Smear" },
    { Model: SwabTest, name: "Swab Test" }
];


// ---------------- Routes ----------------
router.get("/conversation/:conversationID", authMiddleware, async (req, res) => {
	const { error } = Joi.string().trim().max(100).required().validate(req.params.conversationID);
	if (error) {
		return res.status(400).send({ message: "Invalid Conversation ID format" });
	}
	const { conversationID } = req.params;
	try {
		const userId = req.user._id;
		const messages = await getConversationByID(userId, conversationID);
		res.json(messages);
	} catch (error) {
		console.error("Error fetching conversation:", error);
		res.status(500).send({ message: "Error fetching conversation" });
	}
});

router.get("/user", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		const conversations = await getConversationsByUser(userId);
		res.json({ conversations });
	} catch (error) {
		console.error("Error fetching user conversations:", error);
		res.status(500).send({ message: "Error fetching user conversations" });
	}
});

router.get("/reports", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;

		// Fetch all files uploaded by the user to get their names
		const files = await File.find({ userId }).lean();

		// Fetch all reports from all 6 collections
		const reportPromises = reportTypes.map(async ({ Model, name }) => {
			const docs = await Model.find({ userId }, { biomarkers: 0 }).lean();
			return docs.map(doc => ({
				...doc,
				reportType: name
			}));
		});

		const allReportsResults = await Promise.all(reportPromises);
		const flatReports = allReportsResults.flat();

		// Associate with file names
		const enrichedReports = flatReports.map(report => {
			let matchedFile = null;
			if (report.fileId) {
				matchedFile = files.find(f => f._id.toString() === report.fileId.toString());
			}
			if (!matchedFile) {
				// Fallback: match by date and check if it's close (within 24 hours)
				matchedFile = files.find(f => {
					const rDate = new Date(report.reportDate).getTime();
					const fDate = new Date(f.testDate).getTime();
					return Math.abs(rDate - fDate) < 24 * 60 * 60 * 1000;
				});
			}

			return {
				_id: report._id,
				reportDate: report.reportDate,
				reportType: report.reportType,
				description: report.description || (matchedFile ? matchedFile.description : ""),
				fileName: matchedFile ? matchedFile.fileName : `${report.reportType} - ${new Date(report.reportDate).toLocaleDateString()}`
			};
		});

		// Sort by reportDate descending
		enrichedReports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

		res.json({ reports: enrichedReports });
	} catch (error) {
		console.error("Error fetching reports list for selector:", error);
		res.status(500).json({ message: "Error fetching reports list" });
	}
});

router.post("/chat", authMiddleware, rateLimiter(30), async (req, res) => {
	try {
		const { error, value } = validateChat(req.body);
		if (error) {
			return res.status(400).json({ message: error.details[0].message });
		}
		const { message, messages, reportId, conversationID, topic } = value;
		const userId = req.user._id;

		await saveMessage(userId, conversationID, "user", message, topic);

		let botResponse;
		if (!reportId) {
			botResponse = "Please select a medical report from the dropdown menu above before asking a question.";
		} else {
			try {
				// Retrieve only the selected report from the database
				let reportDoc = null;
				let matchedType = "";

				for (const { Model, name } of reportTypes) {
					const doc = await Model.findOne({ _id: reportId, userId }).lean();
					if (doc) {
						reportDoc = doc;
						matchedType = name;
						break;
					}
				}

				if (!reportDoc) {
					botResponse = "The selected medical report could not be found or you do not have permission to view it.";
				} else {
					// Identify the report type automatically (Blood Test, CBC, Urine Test, etc.)
					let detectedType = matchedType;
					
					// Retrieve matching file name if possible, to help check for CBC in text
					let fileName = "";
					if (reportDoc.fileId) {
						const fileRecord = await File.findOne({ _id: reportDoc.fileId, userId }).lean();
						if (fileRecord) {
							fileName = fileRecord.fileName;
						}
					}

					if (matchedType === "Blood Test") {
						const hasCBCBiomarkers = reportDoc.biomarkers.some(b => 
							["wbc", "rbc", "hemoglobin", "platelets", "hematocrit", "mch", "mchc", "mcv"].includes(b.name.toLowerCase())
						);
						const hasCBCText = fileName.toLowerCase().includes("cbc") || 
										   fileName.toLowerCase().includes("complete blood count") ||
										   (reportDoc.description || "").toLowerCase().includes("cbc") ||
										   (reportDoc.description || "").toLowerCase().includes("complete blood count");
						if (hasCBCBiomarkers || hasCBCText) {
							detectedType = "CBC (Complete Blood Count)";
						}
					}

					botResponse = await generateChatResponse(reportDoc, detectedType, message, messages);
				}
			} catch (aiError) {
				console.error("AI service error:", aiError);
				botResponse = `Sorry, I am unable to process your request right now due to an AI service error: ${aiError.message}`;
			}
		}

		await saveMessage(userId, conversationID, "bot", botResponse, topic);
		res.json({ botResponse });
	} catch (error) {
		console.error("Chat error:", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

router.delete("/conversation/:conversationID", authMiddleware, async (req, res) => {
	const { error } = Joi.string().trim().max(100).required().validate(req.params.conversationID);
	if (error) {
		return res.status(400).send({ message: "Invalid Conversation ID format" });
	}
	const { conversationID } = req.params;
	try {
		const userId = req.user._id;
		await deleteConversationByID(userId, conversationID);
		res.json({ message: "Conversation deleted successfully" });
	} catch (error) {
		console.error("Error deleting conversation:", error);
		res.status(500).send({ message: "Error deleting conversation" });
	}
});

router.delete("/clear", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		await clearAllConversations(userId);
		res.json({ message: "All conversations cleared successfully" });
	} catch (error) {
		console.error("Error clearing conversations:", error);
		res.status(500).send({ message: "Error clearing conversations" });
	}
});

module.exports = router;
