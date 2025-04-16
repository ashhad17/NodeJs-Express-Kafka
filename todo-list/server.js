// // index.js
// const express = require('express');
// const app = express();
// const PORT = 3000;

// app.use(express.json()); // Middleware to parse JSON

// let todos = []; // In-memory todos array
// let id = 1;     // Unique ID for each todo

// // GET all todos
// app.get('/todos', (req, res) => {
//   res.json(todos);
// });

// // POST a new todo
// app.post('/todos', (req, res) => {
//   const { title } = req.body;
//   const newTodo = { id: id++, title, completed: false };
//   todos.push(newTodo);
//   res.status(201).json(newTodo);
// });

// // GET a todo by ID
// app.get('/todos/:id', (req, res) => {
//   const todo = todos.find(t => t.id == req.params.id);
//   if (!todo) return res.status(404).json({ message: 'Todo not found' });
//   res.json(todo);
// });

// // PUT to update a todo
// app.put('/todos/:id', (req, res) => {
//   const todo = todos.find(t => t.id == req.params.id);
//   if (!todo) return res.status(404).json({ message: 'Todo not found' });

//   const { title, completed } = req.body;
//   if (title !== undefined) todo.title = title;
//   if (completed !== undefined) todo.completed = completed;

//   res.json(todo);
// });

// // DELETE a todo
// app.delete('/todos/:id', (req, res) => {
//   const index = todos.findIndex(t => t.id == req.params.id);
//   if (index === -1) return res.status(404).json({ message: 'Todo not found' });

//   const deletedTodo = todos.splice(index, 1);
//   res.json(deletedTodo[0]);
// });

// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
//-------------------------------------------------------------------------------------------------------------------------
// const express = require('express');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('./models/User.js');
// const auth=require('./auth.js')
// const JWT_SECRET = 'your-secret-key'; 
// const Todo=require('./models/Todo.js');
// const app = express();
// const PORT=3000;

// app.use(express.json());
// mongoose.connect('mongodb://127.0.0.1:27017/todo-list', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => {
//   console.log('Connected to MongoDB');
// }).catch((error) => {
//   console.error('Error connecting to MongoDB:', error);
// });

// // app.post('/register', async (req, res) => {
// //     const { email, password } = req.body;
// //     try {
// //       const existingUser = await User.findOne({ email });
// //       if (existingUser) return res.status(400).json({ message: 'User already exists' });
  
// //       const hashedPassword = await bcrypt.hash(password, 10);
// //       const newUser = new User({ email, password: hashedPassword });
// //       await newUser.save();
  
// //       res.status(201).json({ message: 'User registered successfully' });
// //     } catch (err) {
// //       res.status(500).json({ message: err.message });
// //     }
// //   });
// //   app.post('/login', async (req, res) => {
// //     const { email, password } = req.body;
// //     try {
// //       const user = await User.findOne({ email });
// //       if (!user) return res.status(400).json({ message: 'Invalid email or password' });
  
// //       const isMatch = await bcrypt.compare(password, user.password);
// //       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
  
// //       const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
// //       res.json({ token });
// //     } catch (err) {
// //       res.status(500).json({ message: err.message });
// //     }
// //   });
    
// // app.post('/todos',auth,async(req,res)=>{
// //     try{
        
// //         const { title } = req.body;
// //         const newTodo = new Todo({ title, userId: req.userId });
// //         const saved = await newTodo.save();
// //         res.status(201).json(saved);
// //     }
// //     catch(err){
// //         return res.status(400).json({message:err.message});
// //     }

// // });

// // app.get('/todos',auth,async(req,res)=>{
// //     const todos = await Todo.find({ userId: req.userId });
// //     res.json(todos);   
// // })

// // app.get('/todos/:id',auth,async(req,res)=>{
// //     const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId });
// //   if (!todo) return res.status(404).json({ message: 'Not found' });
// //   res.json(todo);
// // })

// // app.put('/todos/:id',auth,async(req, res)=>{
// //     const updated = await Todo.findOneAndUpdate(
// //         { _id: req.params.id, userId: req.userId },
// //         req.body,
// //         { new: true }
// //       );
// //       if (!updated) return res.status(404).json({ message: 'Not found' });
// //       res.json(updated);
// // })

// // app.delete('/todos/:id',auth,async(req, res)=>{
// //     const deleted = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
// //   if (!deleted) return res.status(404).json({ message: 'Not found' });
// //   res.json(deleted);
// // })
// app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
// ---------------------------------------------------------------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');
const app = express();

// Middleware
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use('/', authRoutes);
app.use('/', todoRoutes);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
