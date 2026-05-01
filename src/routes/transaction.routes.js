const { Router } = require('express');
const { getAll, getOne, create, update, deleteTransaction } = require('../controllers/transaction.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', deleteTransaction);

module.exports = router;
