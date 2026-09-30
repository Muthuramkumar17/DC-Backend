const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const serviceDurationSchema = new mongoose.Schema(
  {
    serviceDurationId: { type: String, required: true, unique: true },
    durationMinutes: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(serviceDurationSchema, { field: 'serviceDurationId', prefix: 'SDU' });

module.exports = mongoose.models.ServiceDuration || mongoose.model('ServiceDuration', serviceDurationSchema);
