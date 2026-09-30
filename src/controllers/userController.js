const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserLog = require("../models/AuditLog");


//createUser
exports.createUser = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    const { userName, email, password, roleReference, isActive } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !userName || !email.trim() || !password) {
      return res
        .status(400)
        .json({ message: "userName, email, and password are required" });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ userId: await User.getNextSequentialId(),
      userName,
      email: email.toLowerCase().trim(),
      passwordHash,
      roleReference: roleReference || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedUser = await user.save();

    const userResponse = savedUser.toObject();
    delete userResponse.passwordHash;

    await UserLog.create({
      operation: "CREATE",
      actionBy: req.user ? req.user.userId : null,
      userId: savedUser._id,
      details: { action: "User registered", email: savedUser.email },
      newValue: userResponse,
    });

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//login
exports.login = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordHash")
      .populate("roleReference");

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(401).json({ message: "Account is inactive." });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        userName: user.userName,
        email: user.email,
        role: user.roleReference ? user.roleReference.roleName : null,
      },
      process.env.JWT_SECRET || "supersecretjwtkey_jolly_home_needs_2026",
      { expiresIn: "7d" },
    );

    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to process login request" });
  }
};

//getAllUsers
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      })
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getUserById
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getCurrentUser
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateUser
exports.updateUser = async (req, res) => {
  try {
    const { userName, email, password, roleReference, isActive } = req.body;
    const updateData = {};

    if (userName) updateData.userName = userName;
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ message: "Invalid email" });
      updateData.email = email.toLowerCase().trim();
    }
    if (roleReference !== undefined) updateData.roleReference = roleReference;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const previousUser = await User.findById(req.params.id).select(
      "-passwordHash",
    );
    if (!previousUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .select("-passwordHash")
      .populate("roleReference");

    await UserLog.create({
      operation: "UPDATE",
      actionBy: req.user ? req.user.userId : null,
      userId: user._id,
      details: {
        updatedFields: Object.keys(updateData).filter(
          (k) => k !== "passwordHash",
        ),
      },
      previousValue: previousUser.toObject(),
      newValue: user.toObject(),
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteUser
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).select(
      "-passwordHash",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await UserLog.create({
      operation: "DELETE",
      actionBy: req.user ? req.user.userId : null,
      userId: user._id,
      details: { action: "User deleted" },
      previousValue: user.toObject(),
      newValue: null,
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
