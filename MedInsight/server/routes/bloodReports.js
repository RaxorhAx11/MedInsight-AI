const createGenericReportRouter = require("./genericReportRouter");
const BloodReport = require("../models/bloodReport");

module.exports = createGenericReportRouter(BloodReport, "Blood");
