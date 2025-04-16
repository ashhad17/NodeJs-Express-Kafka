const Todo = require('../models/Todo');

exports.getTodos = async (req, res) => {
  const todos = await Todo.find({ userId: req.userId });
  res.json(todos);
};

exports.createTodo = async (req, res) => {
    try {
        const { title } = req.body;
        const newTodo = new Todo({ title, userId: req.userId });
        const saved = await newTodo.save();
        res.status(201).json(saved);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}

exports.getTodoById = async (req, res) => {
    const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });
    if (!todo) return res.status(404).json({ message: 'Not found' });
    res.json(todo);
};
exports.updateTodo = async (req, res) => {
    const updated = await Todo.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        req.body,
        { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
};
exports.deleteTodo = async (req, res) => {
    const deleted = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    res.json(deleted);
};

// app.post('/todos',auth,async(req,res)=>{
//     try{
        
//         const { title } = req.body;
//         const newTodo = new Todo({ title, userId: req.userId });
//         const saved = await newTodo.save();
//         res.status(201).json(saved);
//     }
//     catch(err){
//         return res.status(400).json({message:err.message});
//     }

// });

// // app.get('/todos',auth,async(req,res)=>{
// //     const todos = await Todo.find({ userId: req.userId });
// //     res.json(todos);   
// // })

// app.get('/todos/:id',auth,async(req,res)=>{
//     const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });
//   if (!todo) return res.status(404).json({ message: 'Not found' });
//   res.json(todo);
// })

// app.put('/todos/:id',auth,async(req, res)=>{
//     const updated = await Todo.findOneAndUpdate(
//         { _id: req.params.id, userId: req.userId },
//         req.body,
//         { new: true }
//       );
//       if (!updated) return res.status(404).json({ message: 'Not found' });
//       res.json(updated);
// })

// app.delete('/todos/:id',auth,async(req, res)=>{
//     const deleted = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
//   if (!deleted) return res.status(404).json({ message: 'Not found' });
//   res.json(deleted);
// })