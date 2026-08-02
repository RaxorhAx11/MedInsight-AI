import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FaUser, FaEnvelope, FaLock, FaCalendar, FaRuler, FaWeight, FaVenusMars, FaChevronRight, FaChevronLeft, FaCheck, FaTimes, FaSpinner, FaExclamationCircle, FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";
import ScrollReveal from "../ScrollReveal";
import apiurl from "../../config/api";

const Signup = () => {
	const [step, setStep] = useState(1);
	const [data, setData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		age: "",
		height: "",
		weight: "",
		sex: "",
	});

	const [passwordChecks, setPasswordChecks] = useState({
		length: false,
		upper: false,
		lower: false,
		number: false,
		symbol: false,
	});

	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();

	// Password validation check
	useEffect(() => {
		const pass = data.password;
		setPasswordChecks({
			length: pass.length >= 8,
			upper: /[A-Z]/.test(pass),
			lower: /[a-z]/.test(pass),
			number: /[0-9]/.test(pass),
			symbol: /[^A-Za-z0-9]/.test(pass),
		});
	}, [data.password]);

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
		if (error) setError("");
	};

	const isStep1Valid = () => {
		return (
			data.firstName.trim() !== "" &&
			data.lastName.trim() !== "" &&
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
			Object.values(passwordChecks).every(Boolean)
		);
	};

	const handleNext = () => {
		if (isStep1Valid()) {
			setStep(2);
			setError("");
		} else {
			setError("Please fill out all fields correctly and meet password requirements.");
		}
	};

	const handleBack = () => {
		setStep(1);
		setError("");
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!isStep1Valid()) {
			setStep(1);
			setError("Please complete all account details correctly.");
			return;
		}

		setIsLoading(true);
		setError("");
		try {
			const url = `${apiurl}/users`;
			const payload = {
				...data,
				age: Number(data.age), // Explicit cast for Joi Validation
			};
			await axios.post(url, payload);
			setIsLoading(false);
			navigate("/login");
		} catch (error) {
			setIsLoading(false);
			if (
				error.response &&
				error.response.status >= 400 &&
				error.response.status <= 500
			) {
				setError(error.response.data.message);
			} else {
				setError("Internal Server Error. Please try again later.");
			}
		}
	};

	return (
		<div className={styles.signup_container}>
			<ScrollReveal animation="scale-up" duration={600}>
				<div className={styles.signup_form_container}>
					<div className={styles.left_promo_side}>
						<h1>Already a User?</h1>
						<p>Sign in to access your analysis history, biomarker trends, and chat with your AI assistant.</p>
						<Link to="/login">
							<button type="button" className={`${styles.white_btn} btn-press-premium`}>
								Sign In
							</button>
						</Link>
					</div>
					<div className={styles.right_form_side}>
						<form className={styles.form_wrapper} onSubmit={handleSubmit}>
							<div className={styles.logo_tag}>MedInsight AI</div>
							<h2>Create Account</h2>

							{/* Progress Indicator */}
							<div className={styles.progress_bar_container}>
								<div className={`${styles.progress_step} ${step >= 1 ? styles.active : ""}`}>
									<span className={styles.step_num}>1</span> Account Setup
								</div>
								<div className={styles.progress_line}>
									<div className={styles.progress_line_fill} style={{ width: step === 2 ? "100%" : "0%" }}></div>
								</div>
								<div className={`${styles.progress_step} ${step >= 2 ? styles.active : ""}`}>
									<span className={styles.step_num}>2</span> Health Profile
								</div>
							</div>

							{error && (
								<div className={styles.error_banner}>
									<FaExclamationCircle className={styles.error_icon} />
									<span>{error}</span>
								</div>
							)}

							{step === 1 ? (
								/* Step 1: Account Credentials */
								<div className={`${styles.step_content} animate-scale-in`}>
									<div className={styles.form_grid}>
										<div className={styles.input_group}>
											<FaUser className={styles.input_icon} />
											<input
												type="text"
												placeholder="First Name"
												name="firstName"
												onChange={handleChange}
												value={data.firstName}
												required
												className={styles.input_field}
											/>
										</div>
										<div className={styles.input_group}>
											<FaUser className={styles.input_icon} />
											<input
												type="text"
												placeholder="Last Name"
												name="lastName"
												onChange={handleChange}
												value={data.lastName}
												required
												className={styles.input_field}
											/>
										</div>
									</div>

									<div className={styles.input_group}>
										<FaEnvelope className={styles.input_icon} />
										<input
											type="email"
											placeholder="Email address"
											name="email"
											onChange={handleChange}
											value={data.email}
											required
											className={styles.input_field}
										/>
									</div>

									<div className={styles.input_group}>
										<FaLock className={styles.input_icon} />
										<input
											type={showPassword ? "text" : "password"}
											placeholder="Password"
											name="password"
											onChange={handleChange}
											value={data.password}
											required
											className={styles.input_field}
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className={styles.password_toggle}
											aria-label="Toggle password visibility"
										>
											{showPassword ? <FaEyeSlash /> : <FaEye />}
										</button>
									</div>

									{/* Password strength checklist details */}
									<div className={styles.password_checklist}>
										<p className={styles.checklist_title}>Password Requirements:</p>
										<div className={styles.checklist_grid}>
											<div className={`${styles.checklist_item} ${passwordChecks.length ? styles.valid : ""}`}>
												{passwordChecks.length ? <FaCheck className={styles.check_icon} /> : <FaTimes className={styles.times_icon} />}
												<span>At least 8 characters</span>
											</div>
											<div className={`${styles.checklist_item} ${passwordChecks.upper ? styles.valid : ""}`}>
												{passwordChecks.upper ? <FaCheck className={styles.check_icon} /> : <FaTimes className={styles.times_icon} />}
												<span>One uppercase letter</span>
											</div>
											<div className={`${styles.checklist_item} ${passwordChecks.lower ? styles.valid : ""}`}>
												{passwordChecks.lower ? <FaCheck className={styles.check_icon} /> : <FaTimes className={styles.times_icon} />}
												<span>One lowercase letter</span>
											</div>
											<div className={`${styles.checklist_item} ${passwordChecks.number ? styles.valid : ""}`}>
												{passwordChecks.number ? <FaCheck className={styles.check_icon} /> : <FaTimes className={styles.times_icon} />}
												<span>One number</span>
											</div>
											<div className={`${styles.checklist_item} ${passwordChecks.symbol ? styles.valid : ""}`}>
												{passwordChecks.symbol ? <FaCheck className={styles.check_icon} /> : <FaTimes className={styles.times_icon} />}
												<span>One special character</span>
											</div>
										</div>
									</div>

									<button
										type="button"
										onClick={handleNext}
										disabled={!isStep1Valid()}
										className={`${styles.action_btn} btn-press-premium`}
									>
										<span>Next: Health Metrics</span>
										<FaChevronRight />
									</button>
								</div>
							) : (
								/* Step 2: Health Biomarkers */
								<div className={`${styles.step_content} animate-scale-in`}>
									<div className={styles.form_grid}>
										<div className={styles.input_group}>
											<FaCalendar className={styles.input_icon} />
											<input
												type="number"
												placeholder="Age"
												name="age"
												onChange={handleChange}
												value={data.age}
												required
												className={styles.input_field}
												min="0"
											/>
										</div>
										<div className={styles.input_group}>
											<FaRuler className={styles.input_icon} />
											<input
												type="text"
												placeholder="Height (e.g. 5'10)"
												name="height"
												onChange={handleChange}
												value={data.height}
												required
												className={styles.input_field}
											/>
										</div>
									</div>

									<div className={styles.form_grid}>
										<div className={styles.input_group}>
											<FaWeight className={styles.input_icon} />
											<input
												type="text"
												placeholder="Weight (e.g. 180 lbs)"
												name="weight"
												onChange={handleChange}
												value={data.weight}
												required
												className={styles.input_field}
											/>
										</div>
										<div className={styles.input_group}>
											<FaVenusMars className={styles.input_icon} />
											<select
												name="sex"
												onChange={handleChange}
												value={data.sex}
												required
												className={`${styles.input_field} ${styles.select_field}`}
											>
												<option value="" disabled>
													Select Sex Assigned at Birth
												</option>
												<option value="Male">Male</option>
												<option value="Female">Female</option>
												<option value="Other">Other</option>
											</select>
										</div>
									</div>

									<div className={styles.btn_group}>
										<button
											type="button"
											onClick={handleBack}
											className={`${styles.back_btn} btn-press-premium`}
											disabled={isLoading}
										>
											<FaChevronLeft />
											<span>Back</span>
										</button>
										<button
											type="submit"
											className={`${styles.submit_btn} btn-press-premium`}
											disabled={isLoading || !data.age || !data.height || !data.weight || !data.sex}
										>
											{isLoading ? (
												<>
													<FaSpinner className={styles.spinner} />
													<span>Creating Account...</span>
												</>
											) : (
												"Sign Up"
											)}
										</button>
									</div>
								</div>
							)}
						</form>
					</div>
				</div>
			</ScrollReveal>
		</div>
	);
};

export default Signup;
