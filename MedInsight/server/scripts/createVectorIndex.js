require("../utils/envLoader");
const mongoose = require("mongoose");
const connectDB = require("../db");
require("../models/ReportChunk");

async function setupVectorIndex() {
    console.log("Starting MongoDB Atlas Vector Search Index Setup...");
    
    // Connect to database
    await connectDB();
    
    try {
        const db = mongoose.connection.db;
        
        console.log("Checking existing search indexes on 'reportchunks' collection...");
        
        let indexExists = false;
        try {
            // Use db.command for listSearchIndexes to support older driver versions in Mongoose v6
            const result = await db.command({
                listSearchIndexes: "reportchunks"
            });
            
            // listSearchIndexes might return an array or a cursor object with firstBatch
            const existingIndexes = Array.isArray(result) ? result : (result.cursor && result.cursor.firstBatch ? result.cursor.firstBatch : []);
            console.log(`Found ${existingIndexes.length} search indexes.`);
            
            for (const idx of existingIndexes) {
                if (idx.name === "reportchunks") {
                    indexExists = true;
                    console.log("Search index 'reportchunks' already exists:", JSON.stringify(idx, null, 2));
                    break;
                }
            }
        } catch (listErr) {
            console.warn("Could not list search indexes. Note: If running on a local/self-managed MongoDB instance, Search/Vector Search Indexes are Atlas-only features. Details:", listErr.message);
        }
        
        if (!indexExists) {
            console.log("Creating new vector search index 'reportchunks'...");
            
            // Use db.command for createSearchIndexes to support older driver versions in Mongoose v6
            const result = await db.command({
                createSearchIndexes: "reportchunks",
                indexes: [
                    {
                        name: "reportchunks",
                        type: "vectorSearch",
                        definition: {
                            fields: [
                                {
                                    type: "vector",
                                    path: "embedding",
                                    numDimensions: 768,
                                    similarity: "cosine"
                                },
                                {
                                    type: "filter",
                                    path: "userId"
                                },
                                {
                                    type: "filter",
                                    path: "reportId"
                                }
                            ]
                        }
                    }
                ]
            });
            
            console.log("Vector index creation request submitted successfully:", JSON.stringify(result, null, 2));
            console.log("Note: The index build may take a few minutes to complete on MongoDB Atlas.");
        } else {
            console.log("Skipping vector search index creation as 'reportchunks' already exists.");
        }
        
    } catch (error) {
        console.error("Error setting up vector search index:", error.message || error);
    } finally {
        // Disconnect from database
        await mongoose.disconnect();
        console.log("Disconnected from database.");
    }
}

setupVectorIndex();
