import bcrypt from "bcryptjs";
import { User } from "../models/userModel.js";
import Permission from "../models/permissionModel.js"; 

export const seedDefaultUser = async () => {
  try {
    // Check if the admin user already exists
    let user = await User.findOne({ email: "admin@gmail.com" });

    if (!user) {
      const hashedPassword = await bcrypt.hash("123456", 10);

      user = new User({
        name: "Admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin",
        status: "active",
        tokenVersion: 0,
      });

      await user.save();
      console.log("✅ Default admin user created!");
    } else {
      console.log("ℹ️ Default admin user exists.");
    }

    // Check if permissions exist for this user
    let existingPermission = await Permission.findOne({ userId: user._id });
    if (!existingPermission) {
      // Create permission document with "all"
      const newPermission = new Permission({
        userId: user._id,
        permissions: ["all"], // admin gets full access
      });

      await newPermission.save();
      console.log("✅ Admin permissions created with 'all'");
    } else {
      console.log("ℹ️ Admin already has permissions.");
    }
  } catch (error) {
    console.error("❌ Error seeding default user or permissions:", error.message);
  }
};
