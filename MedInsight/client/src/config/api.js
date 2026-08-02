// Configures the backend API URL dynamically based on process.env.REACT_APP_API_BASE_URL.
// Automatically appends /api if needed and provides a clean relative path fallback (/api) for local development.

const getApiBaseUrl = () => {
	const rawUrl = (process.env.REACT_APP_API_BASE_URL || "").trim().replace(/\/$/, "");
	if (!rawUrl) {
		return "/api";
	}
	return rawUrl.endsWith("/api") ? rawUrl : `${rawUrl}/api`;
};

export const API_BASE_URL = getApiBaseUrl();
export default API_BASE_URL;
