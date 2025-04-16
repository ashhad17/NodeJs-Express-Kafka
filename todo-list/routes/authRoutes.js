const express = require('express');
const router = express.Router();
const {register,login,refreshAccessToken} = require('../controllers/authControllers');
// const { refreshAccessToken } = require('../controllers/authController');
router.post('/refresh-token', refreshAccessToken);
router.post('/register', register);
router.post('/login', login);

module.exports = router;
