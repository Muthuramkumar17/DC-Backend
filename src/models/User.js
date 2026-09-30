const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    userName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    roleReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(userSchema, { field: 'userId', prefix: 'USR' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
