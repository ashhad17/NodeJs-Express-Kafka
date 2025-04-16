
const express = require('express');
const router = express.Router();
const {getTodos,createTodo,updateTodo,deleteTodo,getTodoById} = require('../controllers/todoController');

router.post('/todos', createTodo);
router.get('/todos', getTodos);
 router.get('/todos/:id', getTodoById);
router.put('/todos/:id', updateTodo);
router.delete('/todos/:id', deleteTodo);


module.exports = router;