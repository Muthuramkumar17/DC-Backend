const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const UserLog = require("../models/AuditLog");

const AUTH_COOKIE_NAME = "auth_token";

const getCookieOptions = () => {
  const options = {
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
    options.sameSite = "none";
  }

  return options;
};

const createJwtToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId: user._id,
      userName: user.userName,
      email: user.email,
      role: user.roleReference ? user.roleReference.roleName : null,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

// Create user / signup
exports.createUser = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Invalid request body",
      });
    }

    const { userName, email, password, roleReference, isActive } = req.body;

    if (
      typeof userName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !userName.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "userName, email, and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "A user with this email already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      userId: await User.getNextSequentialId(),
      userName: userName.trim(),
      email: normalizedEmail,
      passwordHash,
      roleReference: roleReference || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });

    const savedUser = await user.save();

    /*
     * Populate the role because the JWT stores roleName.
     * Without populate(), roleReference may contain only the MongoDB ID.
     */
    await savedUser.populate("roleReference");

    const userResponse = savedUser.toObject();
    delete userResponse.passwordHash;

    await UserLog.create({
      operation: "CREATE",
      actionBy: req.user ? req.user.userId : null,
      userId: savedUser._id,
      details: {
        action: "User registered",
        email: savedUser.email,
      },
      newValue: userResponse,
    });

    /*
     * Generate JWT after successful signup.
     */
    const token = createJwtToken(savedUser);

    /*
     * Store JWT in an HttpOnly cookie.
     */
    res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());

    /*
     * Do not return the token in the response body.
     */
    return res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Create user error:", error.message);

    return res.status(500).json({
      message: "Unable to create user",
    });
  }
};

// Login
exports.login = async (req, res) => {
  debugger;
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    })
      .select("+passwordHash")
      .populate("roleReference");

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    if (user.isActive === false) {
      return res.status(401).json({
        message: "Account is inactive.",
      });
    }

    const token = createJwtToken(user);

    res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());

    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    return res.status(200).json({
      message: "Login successful",
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to process login request",
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    /*
     * Use the same path, SameSite, and Secure settings
     * when clearing the cookie.
     */
    const clearOptions = {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    };

    if (process.env.NODE_ENV === "production") {
      clearOptions.secure = true;
      clearOptions.sameSite = "none";
    }

    res.clearCookie(AUTH_COOKIE_NAME, clearOptions);

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    return res.status(500).json({
      message: "Unable to process logout request",
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Get current authenticated user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-passwordHash")
      .populate({
        path: "roleReference",
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Invalid request body",
      });
    }

    const { userName, email, password, roleReference, isActive } = req.body;

    const updateData = {};

    if (userName !== undefined) {
      if (typeof userName !== "string" || !userName.trim()) {
        return res.status(400).json({
          message: "Invalid userName",
        });
      }

      updateData.userName = userName.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          message: "Invalid email",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.params.id },
      });

      if (existingUser) {
        return res.status(400).json({
          message: "A user with this email already exists",
        });
      }

      updateData.email = normalizedEmail;
    }

    if (roleReference !== undefined) {
      updateData.roleReference = roleReference;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be a boolean",
        });
      }

      updateData.isActive = isActive;
    }

    if (password !== undefined) {
      if (typeof password !== "string" || !password) {
        return res.status(400).json({
          message: "Invalid password",
        });
      }

      const salt = await bcrypt.genSalt(10);

      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const previousUser = await User.findById(req.params.id).select(
      "-passwordHash",
    );

    if (!previousUser) {
      return res.status(404).json({
        message: "User not found",
      });
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
          (key) => key !== "passwordHash",
        ),
      },
      previousValue: previousUser.toObject(),
      newValue: user.toObject(),
    });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).select(
      "-passwordHash",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await UserLog.create({
      operation: "DELETE",
      actionBy: req.user ? req.user.userId : null,
      userId: user._id,
      details: {
        action: "User deleted",
      },
      previousValue: user.toObject(),
      newValue: null,
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
