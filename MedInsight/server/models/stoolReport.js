const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const StoolReport = mongoose.model("StoolReport", createGenericReportSchema());

module.exports = StoolReport;
