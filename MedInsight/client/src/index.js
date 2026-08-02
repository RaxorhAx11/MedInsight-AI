import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import axios from "axios";
import { ThemeProvider } from "./context/ThemeContext";

// Configure default Authorization header if token exists
const token = localStorage.getItem("token");
if (token) {
	axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// Global request interceptor to dynamically inject the token into every outgoing request
axios.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("token");
		if (token) {
			config.headers["Authorization"] = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);


// Global interceptor to redirect to login on 401 Unauthorized
axios.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 401) {
			localStorage.removeItem("token");
			// Avoid infinite redirect loop if already on login or signup
			if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/signup")) {
				window.location.href = "/login";
			}
		}
		return Promise.reject(error);
	}
);

ReactDOM.render(
	<React.StrictMode>
		<BrowserRouter>
			<ThemeProvider>
				<App />
			</ThemeProvider>
		</BrowserRouter>
	</React.StrictMode>,
	document.getElementById("root")
);
