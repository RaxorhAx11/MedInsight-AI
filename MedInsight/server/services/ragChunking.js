/**
 * RAG Chunking Service
 * Splits extracted lab report text and structured biomarker data into semantically meaningful chunks.
 */

const BIOMARKER_GROUPS = {
    "Lipid Panel": [
        "totalcholesterol", "total cholesterol", "ldlcholesterol", "ldl cholesterol",
        "hdlcholesterol", "hdl cholesterol", "triglycerides", "vldlcholesterol", 
        "vldl cholesterol", "nonhdlcholesterol", "non-hdl cholesterol", "cholesterolratio", "cholesterol ratio"
    ],
    "Complete Blood Count (CBC)": [
        "hemoglobin", "whitebloodcells", "white blood cells", "platelets", "redbloodcells", "red blood cells",
        "packed cell volume (pcv)", "packed cell volume", "pcv", "mean corpuscular volume (mcv)", "mean corpuscular volume", "mcv",
        "mean corpuscular hemoglobin (mch)", "mean corpuscular hemoglobin", "mch",
        "mean corpuscular hemoglobin concentration (mchc)", "mean corpuscular hemoglobin concentration", "mchc",
        "red cell distribution width (rdw)", "red cell distribution width", "rdw",
        "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils",
        "reticulocytecount", "reticulocyte count", "meanplateletvolume", "mean platelet volume",
        "wbc", "rbc", "hematocrit", "hct", "plt", "hb", "hemoglobin (hb)"
    ],
    "Liver Function Test (LFT)": [
        "alaninetransaminase", "alanine transaminase", "alt", "aspartatetransaminase", "aspartate transaminase", "ast",
        "alkalinephosphatase", "alkaline phosphatase", "alp", "bilirubintotal", "bilirubin total",
        "bilirubindirect", "bilirubin direct", "bilirubinindirect", "bilirubin indirect",
        "totalprotein", "total protein", "albumin", "globulin", "albuminglobulinratio", "albumin-globulin ratio",
        "prothrombintime", "prothrombin time", "pt", "internationalnormalizedratio", "inr",
        "partialthromboplastintime", "partial thromboplastin time", "ptt"
    ],
    "Kidney Function Test (KFT)": [
        "creatinine", "bloodureanitrogen", "blood urea nitrogen", "bun", "uricacid", "uric acid",
        "microalbumin", "beta2microglobulin", "beta-2 microglobulin", "betatraceprotein", "beta-trace protein",
        "uromodulin", "neutrophilgelatinaseassociatedlipocalin", "ngal", "kidneyinjurymolecule1", "kim-1",
        "interleukin18", "il-18", "retinolbindingprotein", "cystatinc", "cystatin c", "osteopontin", "lipocalin2"
    ],
    "Electrolyte Panel": [
        "sodium", "potassium", "calcium", "magnesium", "phosphate"
    ],
    "Thyroid Panel": [
        "thyroidstimulatinghormone", "thyroid stimulating hormone", "tsh", "freet3", "free t3", "freet4", "free t4"
    ],
    "Diabetes Panel": [
        "bloodglucose", "blood glucose", "glucose", "hemoglobina1c", "hemoglobin a1c", "hba1c"
    ],
    "Iron Panel": [
        "serumiron", "serum iron", "totalironbindingcapacity", "total iron binding capacity", "tibc",
        "transferrinsaturation", "transferrin saturation", "ferritin"
    ],
    "Inflammatory & Cardiac Markers": [
        "c-reactiveprotein", "c-reactive protein", "crp", "erythrocytesedimentationrate", 
        "erythrocyte sedimentation rate", "esr", "8hydroxy2deoxyguanosine", "procalcitonin"
    ],
    "Vitamins": [
        "vitaminb12", "vitamin b12", "folate"
    ]
};

/**
 * Determines the semantic medical panel group for a given biomarker name.
 * 
 * @param {string} name - The biomarker name
 * @returns {string} The group/panel name
 */
const getBiomarkerGroup = (name) => {
    if (!name || typeof name !== 'string') return "Other Biomarkers";
    const lowerName = name.toLowerCase().trim();
    let group = "Other Biomarkers";
    
    // Check direct matches first
    let found = false;
    for (const [groupName, markers] of Object.entries(BIOMARKER_GROUPS)) {
        if (markers.includes(lowerName)) {
            group = groupName;
            found = true;
            break;
        }
    }
    
    if (!found) {
        // Pattern matches
        if (lowerName.includes("urine")) {
            group = "Urinalysis";
        } else if (lowerName.includes("stool")) {
            group = "Stool Analysis";
        } else if (lowerName.includes("semen") || lowerName.includes("sperm")) {
            group = "Semen Analysis";
        } else if (lowerName.includes("swab")) {
            group = "Swab Test";
        } else {
            const papSmearKeywords = [
                "adequacy", "transformation zone", "intraepithelial", "asc-us", "asc-h", 
                "lsil", "hsil", "carcinoma", "glandular cells", "endocervical", 
                "cervical", "hpv", "pap smear"
            ];
            if (papSmearKeywords.some(keyword => lowerName.includes(keyword))) {
                group = "Pap Smear";
            }
        }
    }
    
    console.log(`[Biomarker Classification] Biomarker "${name}" assigned to panel/group: "${group}"`);
    return group;
};

/**
 * Formats standard range objects/strings for display in chunk text.
 * 
 * @param {Object|string} range - Reference range
 * @returns {string} Formatted range string
 */
const formatRange = (range) => {
    if (!range) return "";
    if (typeof range === 'string') return range;
    
    const minStr = range.min !== undefined && range.min !== null && range.min !== "" ? range.min : "";
    const maxStr = range.max !== undefined && range.max !== null && range.max !== "" ? range.max : "";
    
    if (minStr !== "" && maxStr !== "") {
        return `${minStr} - ${maxStr}`;
    } else if (minStr !== "") {
        return `>= ${minStr}`;
    } else if (maxStr !== "") {
        return `<= ${maxStr}`;
    }
    return "";
};

/**
 * Parses raw text and extracts the doctor notes or summary section.
 * 
 * @param {string} text - Raw lab report text
 * @returns {string} Extracted notes section or empty string
 */
const extractDoctorNotes = (text) => {
    if (!text || typeof text !== 'string') return "";
    
    const patterns = [
        /(?:doctor\s*notes?|clinical\s*notes?|notes?|summary|comments?|conclusions?|interpretations?|recommendations?|remarks?|opinions?|impressions?)\s*[:\-\n\r]+/i
    ];
    
    let bestMatchIndex = -1;
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match.index !== undefined) {
            if (bestMatchIndex === -1 || match.index < bestMatchIndex) {
                bestMatchIndex = match.index;
            }
        }
    }
    
    if (bestMatchIndex !== -1) {
        return text.substring(bestMatchIndex).trim();
    }
    
    return "";
};

/**
 * Splits extracted lab report text and structured biomarker data into semantically meaningful chunks.
 * 
 * @param {string} extractedText - Raw extracted text of the lab report
 * @param {Array<Object>} biomarkers - Array of structured biomarker objects
 * @param {Object} metadata - Metadata fields
 * @param {string} metadata.reportId - ID of the report
 * @param {string} metadata.userId - ID of the user
 * @param {string|Date} metadata.reportDate - Date of the report
 * @param {string} [metadata.description] - Optional fallback doctor notes/description
 * @returns {Array<Object>} Array of chunk objects
 */
const chunkReportData = (extractedText, biomarkers, metadata = {}) => {
    const { reportId = null, userId = null, reportDate = null, description = null } = metadata;
    const chunks = [];
    
    // 1. Group structured biomarkers
    if (Array.isArray(biomarkers) && biomarkers.length > 0) {
        const grouped = {};
        for (const b of biomarkers) {
            if (!b) continue;
            const name = b.name || b.testName;
            if (!name) continue;
            const group = getBiomarkerGroup(name);
            if (!grouped[group]) {
                grouped[group] = [];
            }
            grouped[group].push(b);
        }
        
        for (const [groupName, groupBiomarkers] of Object.entries(grouped)) {
            let chunkText = `Biomarker Group: ${groupName}\n`;
            for (const b of groupBiomarkers) {
                const name = b.name || b.testName;
                const value = b.value !== undefined ? b.value : (b.result !== undefined ? b.result : b.resultValue);
                const range = b.range !== undefined ? b.range : b.referenceRange;
                const unitStr = b.unit ? ` ${b.unit}` : "";
                const rangeStr = formatRange(range);
                const rangeDisplay = rangeStr ? ` (Normal Range: ${rangeStr}${unitStr})` : "";
                const statusStr = b.status ? ` | Status: ${b.status}` : "";
                
                chunkText += `- ${name}: ${value}${unitStr}${rangeDisplay}${statusStr}\n`;
                if (b.description) {
                    chunkText += `  Description: ${b.description}\n`;
                }
            }
            
            chunks.push({
                text: chunkText.trim(),
                metadata: {
                    reportId,
                    userId,
                    reportDate,
                    chunkType: "biomarker_group",
                    groupName
                }
            });
        }
    }
    
    // 2. Extract doctor notes/summary
    let doctorNotesText = extractDoctorNotes(extractedText);
    if (!doctorNotesText.trim() && description && description.trim()) {
        doctorNotesText = `Doctor Notes / Summary:\n${description.trim()}`;
    }
    
    if (doctorNotesText && doctorNotesText.trim()) {
        chunks.push({
            text: doctorNotesText.trim(),
            metadata: {
                reportId,
                userId,
                reportDate,
                chunkType: "doctor_notes"
            }
        });
    }
    
    return chunks;
};

module.exports = {
    chunkReportData,
    getBiomarkerGroup,
    formatRange,
    extractDoctorNotes,
    BIOMARKER_GROUPS
};
