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

// Street API
export const streetAPI = {
  getAll: () => api.get('/streets'),
  getRandomStreets: (count = 5, difficulty = null) => {
    const url = difficulty 
      ? `/streets/random/${count}?difficulty=${difficulty}`
      : `/streets/random/${count}`;
    return api.get(url);
  },
  fetchFromOSM: (count = 20) => api.post('/streets/fetch', { count }),
  searchStreet: (name) => api.get(`/streets/search/${name}`),
  getStats: () => api.get('/streets/stats/difficulty'),
  updateStats: (id, correct) => api.patch(`/streets/${id}/stats`, { correct }),
  deleteAll: () => api.delete('/streets/all'),
};