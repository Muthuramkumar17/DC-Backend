const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const roleSchema = new mongoose.Schema(
  {
    roleId: { type: String, required: true, unique: true },
    roleName: { type: String, required: true, unique: true, trim: true },
    canRead: { type: Boolean, default: true },
    canWrite: { type: Boolean, default: false },
    canUpdate: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(roleSchema, { field: 'roleId', prefix: 'ROL' });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
