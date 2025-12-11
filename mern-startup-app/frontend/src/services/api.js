import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User API
export const userAPI = {
  getAll: () => api.get('/users'),
  create: (userData) => api.post('/users', userData),
  getById: (id) => api.get(`/users/${id}`),
};

// Score API
export const scoreAPI = {
  getLeaderboard: () => api.get('/scores/leaderboard'),
  getUserScore: (userId) => api.get(`/scores/user/${userId}`),
  updateScore: (scoreData) => api.post('/scores/update', scoreData),
};