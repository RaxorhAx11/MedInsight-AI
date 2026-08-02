const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const PapSmear = mongoose.model("PapSmear", createGenericReportSchema());

module.exports = PapSmear;
