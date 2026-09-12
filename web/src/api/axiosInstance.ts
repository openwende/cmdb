import axios from 'axios';
import { AUTH_TOKEN_KEY, LOGIN_PATH } from '@/constants/auth';

// --- Environment Variable for Base URL ---
// Local dev talks to backend on :8080. Production (demo/prod behind nginx)
// must use same-origin `/api` so the browser does not call the user's localhost.
const LOCAL_API_URL = 'http://localhost:8080/api';
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? LOCAL_API_URL : '/api');

// --- Create Axios Instance ---
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,

  timeout: 10000, // 10 seconds
  // ANNOTATION: Specifies the request timeout in milliseconds. If a request takes longer
  // than this, it will be aborted, and an error will be triggered.

  headers: {
    'Content-Type': 'application/json',
    // ANNOTATION: Sets the default 'Content-Type' header for all requests,
    // indicating that request bodies are in JSON format.

    Accept: 'application/json',
    // ANNOTATION: Tells the server that the client prefers to receive responses in JSON format.
  },
});

// --- Request Interceptor ---
axiosInstance.interceptors.request.use(
  (config) => {
    // ANNOTATION: This function is executed before each request is sent.
    // It receives the request configuration object.
    // Example: Retrieve token from localStorage (or your state management solution)
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      // ANNOTATION: header for authenticated requests.
    }

    return config;
    // ANNOTATION: The modified config object must be returned for the request to proceed.
  },
  (error) => {
    // ANNOTATION: This function handles errors that occur during the setup of a request
    // (e.g., network error before sending, or an error in the config function itself).
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
    // ANNOTATION: Rejects the promise to propagate the error.
  },
);

// --- Response Interceptor ---
axiosInstance.interceptors.response.use(
  (response) => {
    // ANNOTATION: This function is executed for any response with a status code
    // within the 2xx range (e.g., 200 OK, 201 Created).
    return response.data;
    // ANNOTATION: Extracts and returns the `data` property from the response object.
    // This means your `.then()` callbacks will receive the actual data directly.
  },
  (error) => {
    // ANNOTATION: This function is executed for any response with a status code
    // outside the 2xx range (e.g., 4xx client errors, 5xx server errors).
    if (error.response) {
      const { status } = error.response;

      if (status === 400) {
        // ANNOTATION: Handle 400 Bad Request errors.
        console.error('[HTTP] Bad Request:', error.response);
      } else if (status === 401) {
        // ANNOTATION: Handle 401 Unauthorized errors globally.
        // For example, redirect to login page, dispatch a logout action,
        // or attempt a token refresh.
        // Example: window.location.href = '/login';
        localStorage.removeItem(AUTH_TOKEN_KEY);
        if (window.location.pathname !== LOGIN_PATH) {
          window.location.assign(LOGIN_PATH);
        }
      } else if (status === 403) {
        // ANNOTATION: Handle 403 Forbidden errors.
      } else if (status === 404) {
        // ANNOTATION: Handle 404 Not Found errors.
        console.error('[HTTP] Not Found:', error.response);
      } else if (status >= 500) {
        // ANNOTATION: Handle 5xx Server errors.
        console.error('[HTTP] Server error:', error.response);
      }
    } else if (error.request) {
      // ANNOTATION: The request was made but no response was received
      // (e.g., network error, CORS issue, server down).
      console.error('[HTTP] Network error or no response:', error.request);
    } else {
      // ANNOTATION: Something happened in setting up the request that triggered an Error.
      console.error('[HTTP] Request setup error:', error.message);
    }

    return Promise.reject(error);
    // ANNOTATION: It's crucial to reject the promise with the error object.
    // This allows individual API calls to still use .catch() for specific error
    // handling or to update UI based on the error, if needed.
  },
);

export default axiosInstance;
