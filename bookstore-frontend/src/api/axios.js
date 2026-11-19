
import axios from "axios";

const BASE_URL = "http://localhost:8000";

const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: "application/json",
    },
});

export const getCsrfCookie = async () => {
    await axios.get(`${BASE_URL}/sanctum/csrf-cookie`, {
        withCredentials: true,
        headers: {
            Accept: "application/json",
        },
    });
};

export default api;
