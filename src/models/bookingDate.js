const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const bookingDateSchema = new mongoose.Schema(
  {
    bookingDateId: { type: String, required: true, unique: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(bookingDateSchema, { field: 'bookingDateId', prefix: 'BDT' });

module.exports = mongoose.models.BookingDate || mongoose.model('BookingDate', bookingDateSchema);
