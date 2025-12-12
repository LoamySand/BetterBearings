import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Street API
export const streetAPI = {
  // Get all cities in database
  getCities: () => api.get('/streets/cities'),

  // Get all streets (optionally filter by city)
  getAll: (city = null) => {
    const url = city ? `/streets?city=${city}` : '/streets';
    return api.get(url);
  },

  // Get random complete streets for a city
  getRandomCompleteStreets: (count = 5, city = 'Albuquerque', difficulty = null) => {
    let url = `/streets/random-complete/${count}?city=${city}`;
    if (difficulty) {
      url += `&difficulty=${difficulty}`;
    }
    return api.get(url);
  },

  // Fetch from OSM
  fetchCity: (cityName) => api.post(`/streets/fetch-city/${cityName}`),

  // Add specific streets to a city
  addStreets: (cityName, streetNames) =>
    api.post(`/streets/add-streets/${cityName}`, { streetNames }),

  // Get stats for a city
  getCityStats: (cityName) => api.get(`/streets/stats/${cityName}`),

  // Delete all streets for a city
  deleteCity: (cityName) => api.delete(`/streets/city/${cityName}`),

  // Delete all streets (all cities)
  deleteAll: () => api.delete('/streets/all'),
};

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
