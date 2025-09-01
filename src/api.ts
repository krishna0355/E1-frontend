// src/api.ts
import axios from "axios";

const API = axios.create({
  baseURL: "https://e1-backend.onrender.com", // your live Flask backend on Render
});

export default API;
