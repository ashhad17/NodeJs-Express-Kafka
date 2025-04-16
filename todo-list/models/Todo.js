const mongoose = require('mongoose');
const schema=new mongoose.Schema({
    title:{type:String,required:true},
    completed:{type:Boolean,default:false},
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

module.exports=mongoose.model('Todo',schema);