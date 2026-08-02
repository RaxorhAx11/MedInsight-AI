import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaEye, FaEyeSlash, FaEnvelope, FaLock, FaSpinner, FaExclamationCircle } from "react-icons/fa";
import styles from "./styles.module.css";
import ScrollReveal from "../ScrollReveal";

const apiurl = process.env.REACT_APP_API_BASE_URL;

const Login = () => {
	const [data, setData] = useState({ email: "", password: "" });
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
		if (error) setError(""); // Clear error on change
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");
		try {
			const url = `${apiurl}/auth`;
			const { data: res } = await axios.post(url, data);
			localStorage.setItem("token", res.data);
			
			// Inject token to axios common header for subsequent requests
			axios.defaults.headers.common["Authorization"] = `Bearer ${res.data}`;
			
			window.location = "/";
		} catch (error) {
			setIsLoading(false);
			if (
				error.response &&
				error.response.status >= 400 &&
				error.response.status <= 500
			) {
				setError(error.response.data.message);
			} else {
				setError("Something went wrong. Please check your network connection.");
			}
		}
	};

	return (
		<div className={styles.login_container}>
			<ScrollReveal animation="scale-up" duration={600}>
				<div className={styles.login_form_container}>
					<div className={styles.left_form_side}>
						<form className={styles.form_wrapper} onSubmit={handleSubmit}>
							<div className={styles.logo_tag}>MedInsight AI</div>
							<h2>Welcome Back</h2>
							<p className={styles.subtitle}>Enter your credentials to access your health dashboard</p>

							{error && (
								<div className={styles.error_banner}>
									<FaExclamationCircle className={styles.error_icon} />
									<span>{error}</span>
								</div>
							)}

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

							<button type="submit" disabled={isLoading} className={`${styles.submit_btn} btn-press-premium`}>
								{isLoading ? (
									<>
										<FaSpinner className={styles.spinner} />
										<span>Signing In...</span>
									</>
								) : (
									"Sign In"
								)}
							</button>
						</form>
					</div>
					<div className={styles.right_promo_side}>
						<h1>New Here?</h1>
						<p>Sign up and start tracking your biological health parameters and medical insights with AI.</p>
						<Link to="/signup">
							<button type="button" className={`${styles.white_btn} btn-press-premium`}>
								Create Account
							</button>
						</Link>
					</div>
				</div>
			</ScrollReveal>
		</div>
	);
};

export default Login;
