import axios from "axios";

// Change this to your Django backend URL
const API_BASE = "http://localhost:8000/api/v1/";

export const submitPrompt = async (prompt) => {
  const res = await axios.post(`${API_BASE}prompt/`, { prompt });
  return res.data;
};

export const getJobStatus = async (job_id) => {
  const res = await axios.get(`${API_BASE}job/${job_id}/`);
  return res.data;
};
