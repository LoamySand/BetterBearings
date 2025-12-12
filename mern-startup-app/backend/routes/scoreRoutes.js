const express = require('express');
const router = express.Router();
const Score = require('../models/Score');
const User = require('../models/User');

// Get leaderboard (top 10 scores)
router.get('/leaderboard', async (req, res) => {
  try {
    const topScores = await User.find()
      .sort({ totalScore: -1 })
      .limit(10)
      .select('username totalScore highScore');
    res.json(topScores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user score
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      totalScore: user.totalScore,
      highScore: user.highScore,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update score after game
router.post('/update', async (req, res) => {
  try {
    const { userId, points, gameScore } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.totalScore += points;
    if (gameScore > user.highScore) {
      user.highScore = gameScore;
    }

    await user.save();

    // Create score record
    const score = new Score({
      userId,
      score: gameScore,
      gamesPlayed: 1,
    });
    await score.save();

    res.json({
      totalScore: user.totalScore,
      highScore: user.highScore,
      gameScore,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
