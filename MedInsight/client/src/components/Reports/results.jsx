import React, { useState, useEffect } from "react";
import axios from "axios";
import BiomarkerCard from "./BiomarkerCard";
import styles from "./results.module.css";
import { 
	FaChevronLeft, 
	FaSearch, 
	FaExclamationTriangle,
	FaSpinner,
	FaSlidersH
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import ScrollReveal from "../ScrollReveal";
import apiurl from "../../config/api";

const Results = () => {
    const [biomarkers, setBiomarkers] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReportType, setSelectedReportType] = useState("bloodreport");
    const navigate = useNavigate();

    // Navigate to other pages

    const navReports = () => navigate("/reports");

    // Fetch biomarkers on component mount and when selectedReportType changes
    useEffect(() => {
        const fetchBiomarkers = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${apiurl}/${selectedReportType}/biomarkers`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                setBiomarkers(response.data || []);
                setError(null);
            } catch (err) {
                console.error("Error fetching biomarkers:", err);
                if (err.response && err.response.status === 404) {
                    setBiomarkers([]);
                    setError(null);
                } else {
                    setError("Failed to fetch biomarkers. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchBiomarkers();
    }, [selectedReportType]);

    // Filter biomarkers based on search input and sort: available first, then unavailable
    const filteredBiomarkers = biomarkers
        .filter((biomarker) =>
            biomarker.name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
            const aNotMentioned = a.status === "Not Mentioned" || a.result === "Not mentioned in report";
            const bNotMentioned = b.status === "Not Mentioned" || b.result === "Not mentioned in report";

            if (!aNotMentioned && bNotMentioned) return -1;
            if (aNotMentioned && !bNotMentioned) return 1;
            return 0;
        });

	return (
		<div className={styles.main_wrapper}>
			{/* Navigation Bar */}
			<Navbar />

			{/* Content */}
			<div className={styles.container}>
				<ScrollReveal animation="fade-slide-up" duration={500}>
					<header className={styles.header}>
						<div className={styles.header_left}>
							<button className={`${styles.back_btn} btn-press-premium`} onClick={navReports} aria-label="Back to reports hub">
								<FaChevronLeft />
							</button>
							<div className={styles.header_text}>
								<h2>Biomarkers Overview</h2>
								<p>Track clinical values extracted from your lab panels and compare against reference intervals.</p>
							</div>
						</div>
					</header>
				</ScrollReveal>

				{error && (
					<div className={styles.error_banner}>
						<FaExclamationTriangle />
						<span>{error}</span>
					</div>
				)}

				{/* Report Type Selector Tabs */}
				<ScrollReveal animation="fade-slide-up" delay={60} duration={500}>
					<div className={styles.tabsContainer}>
						{[
							{ label: "Blood Report", value: "bloodreport" },
							{ label: "Urine Report", value: "urinereport" },
							{ label: "Stool Report", value: "stoolreport" },
							{ label: "Semen Analysis", value: "semenanalysis" },
							{ label: "Pap Smear", value: "papsmear" },
							{ label: "Swab Test", value: "swabtest" }
						].map((tab) => (
							<button
								key={tab.value}
								className={`${styles.tabButton} ${selectedReportType === tab.value ? styles.activeTab : ""} btn-press-premium`}
								onClick={() => setSelectedReportType(tab.value)}
							>
								{tab.label}
							</button>
						))}
					</div>
				</ScrollReveal>

				{/* Search Input */}
				<ScrollReveal animation="fade-slide-up" delay={120} duration={500}>
					<div className={styles.searchContainer}>
						<div className={styles.searchWrapper}>
							<FaSearch className={styles.searchIcon} />
							<input
								type="text"
								placeholder="Search by biomarker name (e.g. Cholesterol, Glucose)..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className={styles.searchInput}
							/>
						</div>
					</div>
				</ScrollReveal>

				{/* Biomarkers List */}
				{loading ? (
					<div className={styles.loading}>
						<FaSpinner className={styles.spinner} />
						<p>Loading biomarkers history...</p>
					</div>
				) : (
					<div className={styles.biomarkerList}>
						{filteredBiomarkers.length > 0 ? (
							filteredBiomarkers.map((biomarker, index) => (
								<ScrollReveal
									key={`${biomarker.name}-${index}`}
									className={styles.biomarker_card_wrapper}
									animation="fade-slide-up"
									delay={Math.min(index * 30, 240)}
									duration={400}
								>
									<BiomarkerCard biomarker={biomarker} reportType={selectedReportType} />
								</ScrollReveal>
							))
						) : (
							<div className={styles.noResults}>
								<FaSlidersH className={styles.noResultsIcon} />
								<h4>No matching biomarkers found</h4>
								<p>Try searching with another spelling or check your uploaded reports.</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default Results;

