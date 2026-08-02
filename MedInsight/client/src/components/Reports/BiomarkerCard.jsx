import React, { useState, useEffect } from "react";
import styles from "./biomarkerCard.module.css";
import { useNavigate } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

const BiomarkerCard = ({ biomarker, reportType }) => {
    const { name, result, unit, referenceRange, reportDate, status } = biomarker;
    const navigate = useNavigate();
    const { settings } = useTheme();

    // Range and status calculations
    const min = referenceRange.min;
    const max = referenceRange.max;
    
    const isNumeric = !isNaN(parseFloat(min)) && !isNaN(parseFloat(max)) && !isNaN(parseFloat(result));

    const numericMin = isNumeric ? parseFloat(min) : 0;
    const numericMax = isNumeric ? parseFloat(max) : 0;
    const numericResult = isNumeric ? parseFloat(result) : 0;
    
    const margin = isNumeric ? (numericMax - numericMin) * 0.20 : 0; 
    
    const checkStringMatch = (val, ref) => {
        if (!val || !ref) return false;
        const v = val.toString().toLowerCase().trim();
        const r = ref.toString().toLowerCase().trim();
        return v === r || r.includes(v) || v.includes(r);
    };

    const autoAnomalyEnabled = settings.autoAnomaly !== false;

    const isInRange = isNumeric 
        ? (numericResult >= numericMin && numericResult <= numericMax)
        : (checkStringMatch(result, min) || checkStringMatch(result, "normal") || checkStringMatch(result, "negative") || checkStringMatch(result, "no growth") || checkStringMatch(result, "balanced") || checkStringMatch(result, "nilm") || checkStringMatch(result, "satisfactory"));
        
    const isClose = isNumeric && ((numericResult >= numericMin - margin && numericResult < numericMin) || (numericResult > numericMax && numericResult <= numericMax + margin));
    
    const isNotMentioned = status === "Not Mentioned" || result === "Not mentioned in report" || biomarker.status === "Not Mentioned";

    // Premium color palette for status indicators
    const statusColor = isNotMentioned 
        ? "#6b7280" 
        : (!autoAnomalyEnabled 
            ? "#64748b" 
            : (isInRange ? "#10b981" : isClose ? "#f59e0b" : "#ef4444"));

    const statusText = isNotMentioned 
        ? "Not Mentioned" 
        : (!autoAnomalyEnabled 
            ? "Checked" 
            : (isInRange ? "Normal" : isClose ? "Borderline" : "Out of Range"));

    // Progress bar positioning: map value relative to min/max
    const position = isNumeric ? Math.min(100, Math.max(0, ((numericResult - numericMin) / (numericMax - numericMin)) * 100)) : 50;

    const [animatedPosition, setAnimatedPosition] = useState(50);
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedPosition(position);
        }, 50);
        return () => clearTimeout(timer);
    }, [position]);

    const handleArrowClick = () => {
        navigate(`/reports/biomarker/${name.toLowerCase()}?type=${reportType || "bloodreport"}`);
    };

    const getDisplayName = (name, reportType) => {
        let displayName = name;
        if (name.startsWith("Urine ")) {
            displayName = name.replace("Urine ", "");
        } else if (name.startsWith("Stool ")) {
            displayName = name.replace("Stool ", "");
        } else if (name.startsWith("Semen ")) {
            displayName = name.replace("Semen ", "");
        } else if (name.startsWith("Swab ")) {
            displayName = name.replace("Swab ", "");
        } else if (name.startsWith("Cervical ")) {
            displayName = name.replace("Cervical ", "");
        } else if (name.startsWith("Pap Smear ")) {
            displayName = name.replace("Pap Smear ", "");
        }
        
        // Custom overrides for specific display names
        if (displayName === "WBC (Pus Cells)" && reportType === "stoolreport") {
            return "Pus Cells";
        }
        if (displayName === "Sperm Concentration") {
            return "Sperm Concentration";
        }
        if (displayName === "Sperm Motility") {
            return "Motility";
        }
        if (displayName === "Sperm Morphology") {
            return "Morphology";
        }
        if (displayName === "Sperm Vitality") {
            return "Vitality";
        }
        return displayName;
    };

    const capitalizeWords = (str) => {
        return str
            .split(' ')
            .map(word => {
                if (word.startsWith("(") && word.endsWith(")")) return word;
                if (word.toLowerCase() === "ph") return "pH";
                if (word.toLowerCase() === "wbc") return "WBC";
                if (word.toLowerCase() === "rbc") return "RBC";
                if (word.toLowerCase() === "hpv") return "HPV";
                if (word.toLowerCase() === "asc-us") return "ASC-US";
                if (word.toLowerCase() === "asc-h") return "ASC-H";
                if (word.toLowerCase() === "lsil") return "LSIL";
                if (word.toLowerCase() === "hsil") return "HSIL";
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    };

    const displayTitle = capitalizeWords(getDisplayName(name, reportType));

    return (
        <div className={`${styles.card} ${isNotMentioned ? styles.card_unavailable : ""}`} onClick={handleArrowClick}>
            <div className={styles.header}>
                <div className={styles.title_section}>
                    <h3 className={styles.title}>{displayTitle}</h3>
                    <span 
                        className={styles.status_badge} 
                        style={{ 
                            backgroundColor: `${statusColor}12`, 
                            color: statusColor,
                            borderColor: `${statusColor}24`
                        }}
                    >
                        {statusText}
                    </span>
                </div>
                <div className={styles.value_section}>
                    <span className={styles.value}>{isNotMentioned ? "—" : result}</span>
                    {!isNotMentioned && unit && <span className={styles.unit}>{unit}</span>}
                </div>
            </div>
            
            {!isNotMentioned ? (
                <div className={styles.chartContainer}>
                    <div className={styles.chart}>
                        <div className={styles.rangeBar}></div>
                        <div
                            className={styles.indicatorDot}
                            style={{
                                left: `${animatedPosition}%`,
                                backgroundColor: statusColor,
                                boxShadow: `0 0 0 3px ${statusColor}33`
                            }}
                        ></div>
                    </div>
                    <div className={styles.rangeLabels}>
                        <span>Min: {min}</span>
                        <span>Max: {max}</span>
                    </div>
                </div>
            ) : (
                <div className={styles.notMentionedMessage}>
                    <span>Expected Reference Range: {min === "None" && max === "None" ? "Negative/None" : `${min} - ${max} ${unit || ""}`}</span>
                </div>
            )}
            
            <div className={styles.footer}>
                <span className={styles.updatedDate}>
                    Updated {new Date(reportDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className={styles.arrow_link}>
                    <span>History & Trends</span>
                    <FaChevronRight className={styles.chevron} />
                </span>
            </div>
        </div>
    );
};

export default BiomarkerCard;

