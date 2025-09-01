// src/api.ts
import axios from "axios";

const API = axios.create({
  baseURL: "https://e1-backend.onrender.com", // your live Flask backend on Render
  timeout: 60000, // nice to have because Render free can be cold-starty
});

export default API;
