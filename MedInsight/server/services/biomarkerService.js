const fs = require('fs');
const path = require('path');

const biomarkersPath = path.resolve(__dirname, '../data/biomarkers.json');
const biomarkersData = JSON.parse(fs.readFileSync(biomarkersPath, 'utf-8'));

/**
 * Helper function to determine biomarker status
 * Handles both numeric and string/qualitative reference ranges
 */
const getBiomarkerStatus = (result, referenceRange) => {
    if (result === "Not mentioned in report") return "Not Mentioned";
    if (!referenceRange) return "Normal";
    const min = referenceRange.min;
    const max = referenceRange.max;
    
    // Check if both min and max can be parsed as numbers, and result can be parsed as a number
    const isNumeric = min !== undefined && max !== undefined && result !== undefined && result !== null &&
                      !isNaN(parseFloat(min)) && !isNaN(parseFloat(max)) && !isNaN(parseFloat(result));

    if (isNumeric) {
        const numResult = parseFloat(result);
        const numMin = parseFloat(min);
        const numMax = parseFloat(max);
        if (numResult < numMin) {
            return "Low";
        } else if (numResult > numMax) {
            return "High";
        } else {
            return "Normal";
        }
    } else {
        // String/qualitative comparison
        if (result === undefined || result === null) return "Normal";
        const rStr = result.toString().toLowerCase().trim();
        
        const checkStringMatch = (val, ref) => {
            if (val === undefined || val === null || ref === undefined || ref === null) return false;
            const v = val.toString().toLowerCase().trim();
            const refStr = ref.toString().toLowerCase().trim();
            return v === refStr || refStr.includes(v) || v.includes(refStr);
        };

        const normalIndicators = ["normal", "negative", "no growth", "balanced", "nilm", "none", "present", "susceptible", "satisfactory"];
        const abnormalIndicators = ["abnormal", "dysbiosis", "positive", "detected", "high risk", "present for", "growth of", "hsil", "pathogen", "resistant", "unsatisfactory"];
        
        // For qualitative ranges, min represents the normal state (e.g. Balanced, Negative).
        let isInRange = false;
        if (min !== undefined && min !== null) {
            isInRange = isInRange || checkStringMatch(result, min) || normalIndicators.some(indicator => rStr === indicator || rStr.includes(indicator));
        }
        
        // Check max as a normal state only if it is not an abnormal word
        if (max !== undefined && max !== null) {
            const maxStr = max.toString().toLowerCase().trim();
            const maxIsAbnormal = abnormalIndicators.some(indicator => maxStr.includes(indicator));
            if (!maxIsAbnormal) {
                isInRange = isInRange || checkStringMatch(result, max);
            }
        }
        
        if (!isInRange) {
            isInRange = normalIndicators.some(indicator => rStr === indicator || rStr.includes(indicator));
        }
        
        // If the result specifically matches an expected abnormal word and min/max is not that, it's abnormal.
        if (isInRange) {
            const minStr = min ? min.toString().toLowerCase().trim() : "";
            const maxStr = max ? max.toString().toLowerCase().trim() : "";
            const hasAbnormalResult = abnormalIndicators.some(indicator => rStr.includes(indicator));
            const minHasAbnormal = abnormalIndicators.some(indicator => minStr.includes(indicator));
            const maxHasAbnormal = abnormalIndicators.some(indicator => maxStr.includes(indicator));
            if (hasAbnormalResult && !minHasAbnormal && !maxHasAbnormal) {
                isInRange = false;
            }
        }
        
        return isInRange ? "Normal" : "High";
    }
};

const REPORT_BIOMARKERS = {
    "Blood": [
        "Hemoglobin", "WhiteBloodCells", "Platelets", "RedBloodCells", "Packed Cell Volume (PCV)", 
        "Mean Corpuscular Volume (MCV)", "Mean Corpuscular Hemoglobin (MCH)", "Mean Corpuscular Hemoglobin Concentration (MCHC)", 
        "Red Cell Distribution Width (RDW)", "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", 
        "Basophils", "SerumIron", "TotalIronBindingCapacity", "TransferrinSaturation", "Ferritin", 
        "Creatinine", "BloodUreaNitrogen", "AlanineTransaminase", "AspartateTransaminase", "AlkalinePhosphatase", 
        "BilirubinTotal", "BilirubinDirect", "BilirubinIndirect", "ProthrombinTime", "InternationalNormalizedRatio", 
        "PartialThromboplastinTime", "BloodGlucose", "HemoglobinA1C", "C-ReactiveProtein", "ErythrocyteSedimentationRate", 
        "Sodium", "Potassium", "Calcium", "Magnesium", "Phosphate", "TotalProtein", "Albumin", 
        "Globulin", "AlbuminGlobulinRatio", "ThyroidStimulatingHormone", "FreeT3", "FreeT4", 
        "VitaminB12", "Folate", "ReticulocyteCount", "MeanPlateletVolume", "TotalCholesterol", 
        "LDLCholesterol", "HDLCholesterol", "Triglycerides", "VLDLCholesterol", "NonHDLCholesterol", 
        "CholesterolRatio", "Microalbumin", "UricAcid", "Beta2Microglobulin", "BetaTraceProtein", 
        "Uromodulin", "NeutrophilGelatinaseAssociatedLipocalin", "KidneyInjuryMolecule1", "Interleukin18", 
        "RetinolBindingProtein", "CystatinC", "8Hydroxy2Deoxyguanosine", "Osteopontin", "Lipocalin2", "Procalcitonin"
    ],
    "Urine": [
        "Urine Color", "Urine Appearance", "Urine Specific Gravity", "Urine pH", "Urine Protein",
        "Urine Glucose", "Urine Ketones", "Urine Blood", "Urine Bilirubin", "Urine Urobilinogen",
        "Urine Nitrite", "Urine Leukocyte Esterase", "Urine WBC (Pus Cells)", "Urine RBC", "Urine Epithelial Cells",
        "Urine Casts", "Urine Crystals", "Urine Bacteria", "Urine Yeast", "Urine Mucus"
    ],
    "Stool": [
        "Stool Color", "Stool Consistency", "Stool Occult Blood", "Stool Mucus", "Stool Pus Cells",
        "Stool RBC", "Stool WBC", "Stool Ova", "Stool Cysts", "Stool Parasites",
        "Stool Fat Globules", "Stool Undigested Food", "Stool Reducing Substances", "Stool Yeast Cells", "Stool Bacteria",
        "Stool pH"
    ],
    "Semen Analysis": [
        "Semen Volume", "Semen Color", "Semen Appearance", "Semen Liquefaction Time", "Semen Viscosity",
        "Semen pH", "Sperm Concentration", "Total Sperm Count", "Sperm Motility", "Progressive Motility",
        "Non-progressive Motility", "Immotile Sperm", "Sperm Morphology", "Sperm Vitality", "Semen WBC",
        "Semen RBC", "Semen Agglutination", "Semen Debris", "Semen Round Cells", "Semen Fructose"
    ],
    "Pap Smear": [
        "Specimen Adequacy", "Transformation Zone", "Negative for Intraepithelial Lesion", "ASC-US", "ASC-H",
        "LSIL", "HSIL", "Squamous Cell Carcinoma", "Atypical Glandular Cells", "Endocervical Cells",
        "Cervical Inflammation", "Cervical Organisms", "HPV Changes", "Pap Smear Comments"
    ],
    "Swab Test": [
        "Swab Specimen Type", "Swab Gram Stain", "Swab Pus Cells", "Swab Epithelial Cells", "Swab Bacteria",
        "Swab Yeast", "Swab Fungal Elements", "Swab Culture Result", "Swab Organism Identified", "Swab Antibiotic Sensitivity",
        "Swab Antibiotic Resistance", "Swab Comments"
    ]
};

const BIOMARKER_MAPS = {
    "Urine": {
        "Color": "Urine Color",
        "Appearance": "Urine Appearance",
        "Specific Gravity": "Urine Specific Gravity",
        "pH": "Urine pH",
        "Protein": "Urine Protein",
        "Glucose": "Urine Glucose",
        "Ketones": "Urine Ketones",
        "Blood": "Urine Blood",
        "Bilirubin": "Urine Bilirubin",
        "Urobilinogen": "Urine Urobilinogen",
        "Nitrite": "Urine Nitrite",
        "Leukocyte Esterase": "Urine Leukocyte Esterase",
        "WBC (Pus Cells)": "Urine WBC (Pus Cells)",
        "Pus Cells": "Urine WBC (Pus Cells)",
        "WBC": "Urine WBC (Pus Cells)",
        "RBC": "Urine RBC",
        "Epithelial Cells": "Urine Epithelial Cells",
        "Casts": "Urine Casts",
        "Crystals": "Urine Crystals",
        "Bacteria": "Urine Bacteria",
        "Yeast": "Urine Yeast",
        "Mucus": "Urine Mucus",
        "UrineColor": "Urine Color",
        "UrinepH": "Urine pH",
        "UrineProtein": "Urine Protein",
        "UrineGlucose": "Urine Glucose",
        "UrineLeukocyteEsterase": "Urine Leukocyte Esterase",
        "UrineNitrites": "Urine Nitrite",
        "BloodGlucose": "Urine Glucose",
        "TotalProtein": "Urine Protein",
        "Leukocytes": "Urine Leukocyte Esterase"
    },
    "Stool": {
        "Color": "Stool Color",
        "Consistency": "Stool Consistency",
        "Occult Blood": "Stool Occult Blood",
        "Mucus": "Stool Mucus",
        "Pus Cells": "Stool Pus Cells",
        "RBC": "Stool RBC",
        "WBC": "Stool WBC",
        "Ova": "Stool Ova",
        "Cysts": "Stool Cysts",
        "Parasites": "Stool Parasites",
        "Fat Globules": "Stool Fat Globules",
        "Undigested Food": "Stool Undigested Food",
        "Reducing Substances": "Stool Reducing Substances",
        "Yeast Cells": "Stool Yeast Cells",
        "Bacteria": "Stool Bacteria",
        "pH": "Stool pH",
        "OccultBlood": "Stool Occult Blood",
        "FatStool": "Stool Fat Globules",
        "ParasiteOva": "Stool Ova",
        "Yeast": "Stool Yeast Cells"
    },
    "Semen Analysis": {
        "Volume": "Semen Volume",
        "Color": "Semen Color",
        "Appearance": "Semen Appearance",
        "Liquefaction Time": "Semen Liquefaction Time",
        "Viscosity": "Semen Viscosity",
        "pH": "Semen pH",
        "Sperm Concentration": "Sperm Concentration",
        "Total Sperm Count": "Total Sperm Count",
        "Motility": "Sperm Motility",
        "Progressive Motility": "Progressive Motility",
        "Non-progressive Motility": "Non-progressive Motility",
        "Immotile Sperm": "Immotile Sperm",
        "Morphology": "Sperm Morphology",
        "Vitality": "Sperm Vitality",
        "WBC": "Semen WBC",
        "RBC": "Semen RBC",
        "Agglutination": "Semen Agglutination",
        "Debris": "Semen Debris",
        "Round Cells": "Semen Round Cells",
        "Fructose": "Semen Fructose",
        "SpermCount": "Sperm Concentration",
        "SpermMotility": "Sperm Motility",
        "SpermMorphology": "Sperm Morphology",
        "SemenVolume": "Semen Volume",
        "pHSemen": "Semen pH",
        "concentration": "Sperm Concentration",
        "motility": "Sperm Motility",
        "morphology": "Sperm Morphology",
        "volume": "Semen Volume",
        "liquefaction": "Semen Liquefaction Time",
        "viscosity": "Semen Viscosity",
        "white_blood_cells": "Semen WBC"
    },
    "Pap Smear": {
        "Comments": "Pap Smear Comments",
        "Inflammation": "Cervical Inflammation",
        "Organisms": "Cervical Organisms",
        "HPVStatus": "HPV Changes",
        "CytologyResult": "Negative for Intraepithelial Lesion",
        "Cellularity": "Specimen Adequacy",
        "EndocervicalCells": "Endocervical Cells",
        "SquamousCellAbnormalities": "HSIL",
        "GlandularCellAbnormalities": "Atypical Glandular Cells",
        "Koliocytosis": "HPV Changes",
        "InflammatoryCells": "Cervical Inflammation",
        "Trichomoniasis": "Cervical Organisms",
        "CandidaInfection": "Cervical Organisms"
    },
    "Swab Test": {
        "Specimen Type": "Swab Specimen Type",
        "Gram Stain": "Swab Gram Stain",
        "Pus Cells": "Swab Pus Cells",
        "Epithelial Cells": "Swab Epithelial Cells",
        "Bacteria": "Swab Bacteria",
        "Yeast": "Swab Yeast",
        "Fungal Elements": "Swab Fungal Elements",
        "Culture Result": "Swab Culture Result",
        "Organism Identified": "Swab Organism Identified",
        "Antibiotic Sensitivity": "Swab Antibiotic Sensitivity",
        "Antibiotic Resistance": "Swab Antibiotic Resistance",
        "Comments": "Swab Comments",
        "BacterialCulture": "Swab Culture Result",
        "ViralPCR": "Swab Organism Identified",
        "FungalCulture": "Swab Culture Result",
        "ChlamydiaCulture": "Swab Culture Result",
        "GonorrheaCulture": "Swab Culture Result",
        "HPVTest": "Swab Organism Identified",
        "HerpesSimplexPCR": "Swab Organism Identified",
        "StreptococcusAntigen": "Swab Organism Identified",
        "CandidaCulture": "Swab Culture Result",
        "MycobacteriumTuberculosisCulture": "Swab Culture Result",
        "ViralLoadQuantification": "Swab Organism Identified",
        "BacterialResistanceTesting": "Swab Antibiotic Resistance",
        "HSVGenotype": "Swab Organism Identified",
        "GonorrheaResistanceTesting": "Swab Antibiotic Resistance",
        "ChlamydiaResistanceTesting": "Swab Antibiotic Resistance",
        "TuberculosisMolecularTest": "Swab Organism Identified",
        "ViralGenotyping": "Swab Organism Identified"
    }
};

const filterAndMapBiomarkers = (biomarkers, reportTypeName) => {
    const validKeys = REPORT_BIOMARKERS[reportTypeName] || [];
    const mapping = BIOMARKER_MAPS[reportTypeName] || {};
    
    // Map extracted list by report-specific name
    const extractedMap = new Map();
    for (const biomarker of biomarkers) {
        let name = biomarker.testName || biomarker.name;
        
        if (mapping[name]) {
            name = mapping[name];
        }
        
        if (validKeys.includes(name)) {
            const resultVal = biomarker.resultValue !== undefined ? biomarker.resultValue : biomarker.result;
            extractedMap.set(name, {
                result: resultVal,
                status: biomarker.status
            });
        }
    }
    
    const results = [];
    for (const name of validKeys) {
        const bData = biomarkersData[name];
        const extracted = extractedMap.get(name);
        
        if (extracted) {
            results.push({
                name: name,
                description: bData ? bData.description : "",
                result: extracted.result,
                unit: bData ? bData.unit : "",
                referenceRange: bData ? bData.referenceRange : { min: "", max: "" },
                status: extracted.status || getBiomarkerStatus(extracted.result, bData ? bData.referenceRange : null)
            });
        } else {
            results.push({
                name: name,
                description: bData ? bData.description : "",
                result: "Not mentioned in report",
                unit: bData ? bData.unit : "",
                referenceRange: bData ? bData.referenceRange : { min: "", max: "" },
                status: "Not Mentioned"
            });
        }
    }
    
    return results;
};

module.exports = {
    getBiomarkerStatus,
    filterAndMapBiomarkers,
    REPORT_BIOMARKERS
};
