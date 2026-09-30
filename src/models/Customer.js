const mongoose = require('mongoose');
const sequentialIdPlugin = require('../config/sequentialId');

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'name must contain at least 2 characters'],
      maxlength: [100, 'name must not exceed 100 characters'],
      validate: {
        validator(value) {
          return typeof value === 'string' && /^[\p{L} ]+$/u.test(value);
        },
        message: 'name must contain letters and spaces only',
      },
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, 'phoneNumber must contain exactly 10 digits'],
      unique: true,
    },
    address: { type: String, trim: true, default: '' },
    doorNo: { type: String, trim: true, default: '' },
    block: { type: String, trim: true, default: '' },
    apartmentName: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

sequentialIdPlugin(customerSchema, { field: 'customerId', prefix: 'CUS' });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
