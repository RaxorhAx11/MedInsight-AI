import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import ScrollReveal from "../ScrollReveal";
import {
	FaChevronLeft,
	FaHistory,
	FaUpload,
	FaMicroscope,
	FaExclamationTriangle,
	FaTrashAlt,
	FaCog,
	FaUser,
	FaSearch,
	FaFilter,
	FaChevronDown,
	FaChevronUp,
	FaCalendarAlt,
	FaTimes
} from "react-icons/fa";
import styles from "./activityHistory.module.css";

const apiurl = (() => {
	const base = (process.env.REACT_APP_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
	return base.endsWith("/api") ? base : `${base}/api`;
})();

const ActivityHistory = () => {
	const navigate = useNavigate();
	const [activities, setActivities] = useState([]);
	const [filteredActivities, setFilteredActivities] = useState([]);
	const [activeFilter, setActiveFilter] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedItems, setExpandedItems] = useState({});
	const [isLoading, setIsLoading] = useState(true);

	const fetchActivities = async () => {
		try {
			setIsLoading(true);
			const token = localStorage.getItem("token");
			if (!token) return;

			const response = await axios.get(`${apiurl}/activities`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setActivities(response.data);
			setFilteredActivities(response.data);
		} catch (err) {
			console.error("Error fetching activity history:", err);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchActivities();
	}, []);

	useEffect(() => {
		let result = activities;

		// Apply Type Filters
		if (activeFilter !== "all") {
			if (activeFilter === "account") {
				result = result.filter(act => ["profile", "settings", "delete"].includes(act.activityType));
			} else {
				result = result.filter(act => act.activityType === activeFilter);
			}
		}

		// Apply Search Query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				act => 
					act.title.toLowerCase().includes(query) || 
					act.description.toLowerCase().includes(query) ||
					act.activityType.toLowerCase().includes(query)
			);
		}

		setFilteredActivities(result);
	}, [activeFilter, searchQuery, activities]);

	const toggleExpand = (id) => {
		setExpandedItems((prev) => ({
			...prev,
			[id]: !prev[id]
		}));
	};

	const getActivityIcon = (type) => {
		switch (type) {
			case "upload":
				return <FaUpload className={styles.icon_upload} />;
			case "analysis":
				return <FaMicroscope className={styles.icon_analysis} />;
			case "alert":
				return <FaExclamationTriangle className={styles.icon_alert} />;
			case "delete":
				return <FaTrashAlt className={styles.icon_delete} />;
			case "settings":
				return <FaCog className={styles.icon_settings} />;
			case "profile":
				return <FaUser className={styles.icon_profile} />;
			default:
				return <FaHistory className={styles.icon_default} />;
		}
	};

	const getStatusBadgeClass = (status) => {
		switch (status) {
			case "Completed":
				return styles.badge_completed;
			case "Warning":
				return styles.badge_warning;
			case "Processing":
				return styles.badge_processing;
			case "Failed":
				return styles.badge_failed;
			default:
				return styles.badge_completed;
		}
	};

	const clearSearch = () => {
		setSearchQuery("");
	};

	return (
		<div className={styles.main_wrapper}>
			<Navbar />

			<div className={styles.history_container}>
				{/* Header Section */}
				<ScrollReveal animation="fade-slide-up" duration={500}>
					<header className={styles.history_header}>
						<div className={styles.header_left}>
							<button 
								className={`${styles.back_btn} btn-press-premium`} 
								onClick={() => navigate("/")} 
								aria-label="Back to dashboard"
							>
								<FaChevronLeft />
							</button>
							<div className={styles.header_text}>
								<h2>Activity & Report History</h2>
								<p>Complete record of health report uploads, AI parameters analysis, warnings, and settings changes.</p>
							</div>
						</div>
					</header>
				</ScrollReveal>

				{/* Search & Filter Toolbar */}
				<ScrollReveal animation="fade-slide-up" delay={80} duration={500}>
					<div className={styles.toolbar}>
						<div className={styles.search_wrapper}>
							<FaSearch className={styles.search_icon} />
							<input
								type="text"
								placeholder="Search activities by title, file name, keyword..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className={styles.search_input}
							/>
							{searchQuery && (
								<button className={styles.clear_search_btn} onClick={clearSearch}>
									<FaTimes />
								</button>
							)}
						</div>

						<div className={styles.filter_tabs_wrapper}>
							<FaFilter className={styles.filter_icon} />
							<div className={styles.filter_tabs}>
								<button 
									className={`${styles.filter_tab} ${activeFilter === "all" ? styles.tab_active : ""} btn-press-premium`}
									onClick={() => setActiveFilter("all")}
								>
									All Logs
								</button>
								<button 
									className={`${styles.filter_tab} ${activeFilter === "upload" ? styles.tab_active : ""} btn-press-premium`}
									onClick={() => setActiveFilter("upload")}
								>
									Uploads
								</button>
								<button 
									className={`${styles.filter_tab} ${activeFilter === "analysis" ? styles.tab_active : ""} btn-press-premium`}
									onClick={() => setActiveFilter("analysis")}
								>
									AI Analyses
								</button>
								<button 
									className={`${styles.filter_tab} ${activeFilter === "alert" ? styles.tab_active : ""} btn-press-premium`}
									onClick={() => setActiveFilter("alert")}
								>
									Alerts
								</button>
								<button 
									className={`${styles.filter_tab} ${activeFilter === "account" ? styles.tab_active : ""} btn-press-premium`}
									onClick={() => setActiveFilter("account")}
								>
									Account Updates
								</button>
							</div>
						</div>
					</div>
				</ScrollReveal>

				{/* Loading State */}
				{isLoading ? (
					<div className={styles.history_loading}>
						<div className={styles.spinner}></div>
						<p>Retrieving activity logs...</p>
					</div>
				) : filteredActivities.length === 0 ? (
					<div className={styles.empty_state}>
						<FaHistory className={styles.empty_state_icon} />
						<h4>No activities found</h4>
						<p>No matching activities were found. Try adjusting your search query or filters.</p>
					</div>
				) : (
					<div className={styles.activities_list}>
						{filteredActivities.map((activity, idx) => {
							const isExpanded = !!expandedItems[activity._id];
							const formattedTime = new Date(activity.createdAt).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit"
							});
							const formattedDate = new Date(activity.createdAt).toLocaleDateString([], {
								month: "long",
								day: "numeric",
								year: "numeric"
							});

							return (
								<ScrollReveal 
									key={activity._id} 
									className={`${styles.activity_card} ${isExpanded ? styles.card_expanded : ""}`}
									animation="fade-slide-up"
									delay={idx * 30}
									duration={450}
									onClick={() => toggleExpand(activity._id)}
								>
									<div className={styles.card_icon_area}>
										<div className={`${styles.icon_container} ${styles[`icon_${activity.activityType}`]}`}>
											{getActivityIcon(activity.activityType)}
										</div>
									</div>

									<div className={styles.card_main_area}>
										<div className={styles.card_title_row}>
											<span className={styles.activity_date}>
												<FaCalendarAlt className={styles.calendar_icon} />
												{formattedDate} at {formattedTime}
											</span>
											<span className={`${styles.status_badge} ${getStatusBadgeClass(activity.status)}`}>
												{activity.status}
											</span>
										</div>
										<h4>{activity.title}</h4>
										<p className={styles.activity_desc}>
											{activity.description.length > 120 && !isExpanded
												? `${activity.description.substring(0, 120)}...`
												: activity.description}
										</p>

										{/* Expanded Info Area */}
										<div className={`${styles.card_details} ${isExpanded ? styles.details_visible : ""}`}>
											<div className={styles.divider}></div>
											<div className={styles.meta_grid}>
												<div className={styles.meta_item}>
													<strong>Category:</strong> 
													<span className={styles.category_tag}>{activity.activityType.toUpperCase()}</span>
												</div>
												<div className={styles.meta_item}>
													<strong>Exact Time:</strong> {new Date(activity.createdAt).toLocaleString()}
												</div>
												<div className={styles.meta_item}>
													<strong>Activity Reference ID:</strong> {activity._id}
												</div>
											</div>
											{activity.activityType === "upload" && (
												<button 
													className={`${styles.shortcut_btn} btn-press-premium`}
													onClick={(e) => {
														e.stopPropagation();
														navigate("/reports");
													}}
												>
													View Reports
												</button>
											)}
											{activity.activityType === "alert" && (
												<button 
													className={`${styles.shortcut_btn_alert} btn-press-premium`}
													onClick={(e) => {
														e.stopPropagation();
														navigate("/reports/results");
													}}
												>
													View Biomarkers Tracker
												</button>
											)}
										</div>
									</div>

									<div className={styles.card_expand_arrow}>
										{isExpanded ? <FaChevronUp /> : <FaChevronDown />}
									</div>
								</ScrollReveal>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};

export default ActivityHistory;
