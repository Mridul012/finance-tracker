const { Router } = require('express');
const { getMonthlyReport, getDashboard } = require('../controllers/report.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/monthly', getMonthlyReport);
router.get('/dashboard', getDashboard);

module.exports = router;
