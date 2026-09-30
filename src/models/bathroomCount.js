const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const bathroomCountSchema = new mongoose.Schema(
  {
    bathroomCountId: { type: String, required: true, unique: true },
    bathroomCount: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(bathroomCountSchema, { field: 'bathroomCountId', prefix: 'BTH' });

module.exports = mongoose.models.BathroomCount || mongoose.model('BathroomCount', bathroomCountSchema);
