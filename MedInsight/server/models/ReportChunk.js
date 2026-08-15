const mongoose = require("mongoose");

const reportChunkSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, required: true },
    chunkText: { type: String, required: true },
    chunkType: { type: String, required: true },
    embedding: {
        type: [Number],
        required: true,
        // Dimension size is 768 for text-embedding-004
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.length === 768;
            },
            message: props => `Embedding vector must have exactly 768 dimensions. Got ${props.value ? props.value.length : 0} dimensions.`
        }
    },
    createdAt: { type: Date, default: Date.now }
});

// Create standard compound B-Tree indexes for fast localized search/queries
reportChunkSchema.index({ userId: 1, reportId: 1 });
reportChunkSchema.index({ reportId: 1 });

module.exports = mongoose.model("ReportChunk", reportChunkSchema);
