import axios from "axios";

const API_BASE = "http://localhost:8000/api/";

export const submitPrompt = async (prompt) => {
  const res = await axios.post(`${API_BASE}generate/`, { prompt });
  return res.data;
};

export const getJobStatus = async (job_id) => {
  const res = await axios.get(`${API_BASE}job/${job_id}/`);
  return res.data;
};
