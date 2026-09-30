const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const timeSlotSchema = new mongoose.Schema(
  {
    timeSlotId: { type: String, required: true, unique: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    bufferTime: { type: Number, required: true, min: 0 }, // in minutes
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(timeSlotSchema, { field: 'timeSlotId', prefix: 'TSL' });

module.exports = mongoose.models.TimeSlot || mongoose.model('TimeSlot', timeSlotSchema);
