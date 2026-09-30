const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const serviceFrequencySchema = new mongoose.Schema(
  {
    serviceFrequencyId: { type: String, required: true, unique: true },
    frequencyName: { type: String, required: true, trim: true },
    intervalDays: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(serviceFrequencySchema, { field: 'serviceFrequencyId', prefix: 'SFR' });

module.exports = mongoose.models.ServiceFrequency || mongoose.model('ServiceFrequency', serviceFrequencySchema);
