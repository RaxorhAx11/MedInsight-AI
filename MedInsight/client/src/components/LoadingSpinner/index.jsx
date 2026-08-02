import React from "react";
import { FaHeartbeat } from "react-icons/fa";
import styles from "./styles.module.css";

const LoadingSpinner = () => {
	return (
		<div className={styles.spinner_backdrop}>
			<div className={styles.spinner_content}>
				<div className={styles.spinner_circle_wrapper}>
					<div className={styles.spinner_circle}></div>
					<div className={styles.logo_inner}>
						<FaHeartbeat className={styles.heart_icon} />
					</div>
				</div>
				<span className={styles.loading_text}>Loading workspace...</span>
			</div>
		</div>
	);
};

export default LoadingSpinner;
