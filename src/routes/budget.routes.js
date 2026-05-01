const { Router } = require('express');
const { getAll, create, deleteBudget } = require('../controllers/budget.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/', getAll);
router.post('/', create);
router.delete('/:id', deleteBudget);

module.exports = router;
