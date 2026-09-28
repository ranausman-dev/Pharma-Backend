import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    father_name: {
      type: String,
      // required: true, 
      trim: true
    },
    email: {
      type: String,
      // required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      // required: true,
    },
    phone_number: {
      type: String,
    },
    mobile_number: {
      type: String,
    },
    salary: {
      type: Number,
    },
    city: { type: String },
    area_id: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Area'
      }
    ],
    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "employee",
    },
    incentive_type: {
      type: String,
      enum: ["recovery", "sale", "none"],
      default: "none",
    },
    incentive_percentage: { type: Number },
    employee_type: {
      type: String,
      enum: ["booker", "supply_man", "order_taker", "tea_man", "it", "branch_manager", "founder", "ceo", "co_founder", "store_supervisor", "investor"],
      default: "supply_man",
    },
    join_date: {
      type: Date,
    },
    cnic: {
      type: String,
    },
    profile_photo: {
      type: String,
    },
    cnic_front: {
      type: String,
    },
    cnic_back: {
      type: String,
    },
    cheque_photo: {
      type: String,
    },
    e_stamp: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model("User", userSchema);
