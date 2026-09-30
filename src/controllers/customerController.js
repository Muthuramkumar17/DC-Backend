const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Subscription = require("../models/subscription");
const CustomerLog = require("../models/AuditLog");

//createCustomer
exports.createCustomer = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    const {
      name,
      phoneNumber,
      address,
      doorNo,
      block,
      apartmentName,
      landmark,
      area,
      city,
      pincode,
      isActive,
    } = req.body;

    if (typeof name !== "string" || typeof phoneNumber !== "string") {
      return res.status(400).json({ message: "name and phoneNumber must be strings" });
    }

    const normalizedName = name.trim();
    const normalizedPhoneNumber = phoneNumber.trim();
    const validName = normalizedName.length >= 2 && normalizedName.length <= 100 && /^[\p{L} ]+$/u.test(normalizedName);
    const validPhone = /^\d{10}$/.test(normalizedPhoneNumber);
    if (!validName || !validPhone) {
      return res.status(400).json({ message: "Invalid customer data" });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive") && typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    if (await Customer.exists({ phoneNumber: normalizedPhoneNumber })) {
      return res.status(409).json({ message: "Phone number already exists" });
    }

    const actionBy = req.user ? req.user._id : null;

    const customer = new Customer({ customerId: await Customer.getNextSequentialId(),
      name: normalizedName,
      phoneNumber: normalizedPhoneNumber,
      address: address || "",
      doorNo: doorNo || "",
      block: block || "",
      apartmentName: apartmentName || "",
      landmark: landmark || "",
      area: area || "",
      city: city || "",
      pincode: pincode || "",
      isActive: isActive !== undefined ? isActive : true,
      createdBy: actionBy,
    });

    const savedCustomer = await customer.save();

    await CustomerLog.create({
      auditLogId: await CustomerLog.getNextSequentialId(),
      operation: "CREATE",
      actionBy,
      customerId: savedCustomer._id,
      details: {
        action: "Customer created",
        name: savedCustomer.name,
        phoneNumber: savedCustomer.phoneNumber,
      },
      previousValue: null,
      newValue: savedCustomer.toObject(),
    });

    res.status(201).json(savedCustomer);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Phone number already exists" });
    if (error?.name === "ValidationError") return res.status(400).json({ message: "Invalid customer data" });
    res.status(500).json({ message: "Internal server error" });
  }
};

//getAllCustomers
exports.getAllCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      if (typeof search !== "string" || search.length > 100) {
        return res.status(400).json({ message: "Invalid search value" });
      }

      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query = {
        $or: [
          { customerId: { $regex: escapedSearch, $options: "i" } },
          { name: { $regex: escapedSearch, $options: "i" } },
          { phoneNumber: { $regex: escapedSearch, $options: "i" } },
          { address: { $regex: escapedSearch, $options: "i" } },
          { area: { $regex: escapedSearch, $options: "i" } },
          { apartmentName: { $regex: escapedSearch, $options: "i" } },
        ],
      };
    }

    if (req.query.isActive !== undefined) {
      if (!["true", "false"].includes(req.query.isActive)) {
        return res.status(400).json({
          message: "isActive must be true or false",
        });
      }

      query.isActive = req.query.isActive === "true";
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();
    const subscriptions = await Subscription.find({
      customerReference: { $in: customers.map((customer) => customer._id) },
      isActive: true,
    })
      .populate(
        "serviceFrequencyReference",
        "name frequencyName serviceFrequencyName",
      )
      .populate(
        "subscriptionTypeReference",
        "name subscriptionTypeName typeName subscriptionName",
      )
      .lean();
    const subscriptionsByCustomer = new Map();
    subscriptions.forEach((subscription) => {
      const key = String(subscription.customerReference);
      const list = subscriptionsByCustomer.get(key) || [];
      list.push(subscription);
      subscriptionsByCustomer.set(key, list);
    });
    const enrichedCustomers = customers.map((customer) => {
      const customerSubscriptions =
        subscriptionsByCustomer.get(String(customer._id)) || [];
      const subscription = customerSubscriptions[0];
      return {
        ...customer,
        serviceFrequency: subscription?.serviceFrequencyReference || null,
        subscriptionType: subscription?.subscriptionTypeReference || null,
        activeSubscriptionCount: customerSubscriptions.length,
      };
    });

    res.status(200).json(enrichedCustomers);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

//getCustomerById
exports.getCustomerById = async (req, res) => {
  try {
    let customer = null;

    if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
      customer = await Customer.findById(req.params.id);
    }

    if (!customer) {
      customer = await Customer.findOne({
        $or: [{ customerId: req.params.id }, { phoneNumber: req.params.id }],
      });
    }

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

//updateCustomer
exports.updateCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    const allowedFields = ["name", "phoneNumber", "address", "doorNo", "block", "apartmentName", "landmark", "area", "city", "pincode", "isActive"];
    const updates = Object.fromEntries(
      allowedFields
        .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
        .map((field) => [field, req.body[field]])
    );
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      updates.isActive = req.body.isActive;
    }
    if (updates.name !== undefined) {
      if (typeof updates.name !== "string") return res.status(400).json({ message: "name must be a string" });
      updates.name = updates.name.trim();
      if (updates.name.length < 2 || updates.name.length > 100 || !/^[\p{L} ]+$/u.test(updates.name)) {
        return res.status(400).json({ message: "Invalid customer data" });
      }
    }
    if (updates.phoneNumber !== undefined) {
      if (typeof updates.phoneNumber !== "string") return res.status(400).json({ message: "phoneNumber must be a string" });
      updates.phoneNumber = updates.phoneNumber.trim();
      if (!/^\d{10}$/.test(updates.phoneNumber)) {
        return res.status(400).json({ message: "Invalid customer data" });
      }
      if (await Customer.exists({ phoneNumber: updates.phoneNumber, _id: { $ne: req.params.id } })) {
        return res.status(409).json({ message: "Phone number already exists" });
      }
    }

    const previousCustomer = await Customer.findById(req.params.id);

    if (!previousCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    const actionBy = req.user ? req.user._id : null;

    await CustomerLog.create({
      auditLogId: await CustomerLog.getNextSequentialId(),
      operation: "UPDATE",
      actionBy,
      customerId: customer._id,
      details: {
        updatedFields: Object.keys(updates),
      },
      previousValue: previousCustomer.toObject(),
      newValue: customer.toObject(),
    });

    res.status(200).json(customer);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Phone number already exists" });
    if (error?.name === "ValidationError") return res.status(400).json({ message: "Invalid customer data" });
    res.status(500).json({ message: "Internal server error" });
  }
};

//deleteCustomer
exports.deleteCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid identifier" });
    }
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const actionBy = req.user ? req.user._id : null;

    await CustomerLog.create({
      auditLogId: await CustomerLog.getNextSequentialId(),
      operation: "DELETE",
      actionBy,
      customerId: customer._id,
      details: {
        action: "Customer deleted",
      },
      previousValue: customer.toObject(),
      newValue: null,
    });

    res.status(200).json({
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
