import React, { useState, useEffect } from "react";
import { FaHeartbeat } from "react-icons/fa";
import styles from "./styles.module.css";

const INITIALIZATION_STEPS = [
    "Initializing health database...",
    "Loading AI biomarker engine...",
    "Checking secure credentials...",
    "Optimizing clinical workspace...",
    "Ready"
];

function SplashScreen({ onComplete }) {
    const [statusIndex, setStatusIndex] = useState(0);
    const [isFadingOut, setIsFadingOut] = useState(false);

    // Cycle through initialization status messages
    useEffect(() => {
        if (statusIndex < INITIALIZATION_STEPS.length - 1) {
            const delay = statusIndex === 0 ? 500 : 600; // slightly longer first step
            const timer = setTimeout(() => {
                setStatusIndex(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [statusIndex]);

    // Handle splash screen exit lifecycle
    useEffect(() => {
        // Start fading out after 2.8 seconds (giving animations time to complete)
        const fadeTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 2800);

        // Notify parent to unmount after fade transition finishes (3.3 seconds total)
        const completeTimer = setTimeout(() => {
            if (onComplete) {
                onComplete();
            }
        }, 3300);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

    // Apply the theme directly from localStorage settings if it was saved dark
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem("medinsight_settings");
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings && settings.theme === "dark") {
                    document.body.classList.add("dark-theme");
                }
            }
        } catch (error) {
            console.error("Error applying pre-initialize theme:", error);
        }
    }, []);

    return (
        <div className={`${styles.splash_backdrop} ${isFadingOut ? styles.fade_out : ""}`}>
            <div className={styles.splash_content}>
                {/* Glowing Heartbeat Icon Container */}
                <div className={styles.logo_wrapper}>
                    <FaHeartbeat className={styles.heart_icon} />
                </div>

                {/* Brand Logo Text */}
                <div className={styles.brand_details}>
                    <h1 className={styles.brand_title}>
                        MedInsight<span className={styles.logo_accent}> AI</span>
                    </h1>
                    <span className={styles.tagline}>Intelligent Biomarker Analytics</span>
                </div>

                {/* Custom SVG ECG Pulse Line */}
                <svg className={styles.ecg_container} viewBox="0 0 200 80">
                    <path
                        className={styles.ecg_line}
                        d="M 10 40 L 45 40 L 55 30 L 65 50 L 75 40 L 90 40 L 100 12 L 110 68 L 120 40 L 135 40 L 142 45 L 148 35 L 155 40 L 190 40"
                    />
                </svg>

                {/* Progress bar and status indicator */}
                <div className={styles.loader_wrapper}>
                    <div className={styles.progress_track}>
                        <div className={styles.progress_fill}></div>
                    </div>
                    <div className={styles.status_text}>
                        {INITIALIZATION_STEPS[statusIndex]}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SplashScreen;
