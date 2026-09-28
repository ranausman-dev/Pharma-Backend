import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  owner1_name: {
    type: String,
    trim: true
  },
  owner2_name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  owner1_phone_number: {
    type: String,
    trim: true
  },
  owner2_phone_number: {
    type: String,
    trim: true
  },
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  phone_number: {
    type: String,
    trim: true
  },
  ptcl_number: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  area_id: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Area'
    }
  ],
  city: {
    type: String,
    trim: true
  },
  booker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receive: {
    type: Number,
    default: 0
  },
  pay: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  licence_number: {
    type: String,
    trim: true
  },
  licence_expiry: {
    type: Date
  },
  ntn_number: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['customer', 'supplier', 'both'],
    default: 'supplier',
    trim: true
  },
  opening_balance: {
    type: Number,
    default: 0
  },
  balanceType: {
    type: String,
    enum: ['pay', 'receive'],
    default: 'pay',
  },
  credit_period: {
    type: Number,
    default: 0
  },
  credit_limit: {
    type: Number,
    default: 0
  },
  cnic: {
    type: String,
    trim: true
  },
  licence_photo: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

export const SupplierModel = mongoose.model('Supplier', supplierSchema);
