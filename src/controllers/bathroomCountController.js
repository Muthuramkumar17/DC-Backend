const BathroomCount = require("../models/bathroomCount");
const AuditLog = require("../models/auditLog");

//createBathroomCount
exports.createBathroomCount = async (req, res) => {
  try {
    const { bathroomCount, isActive } = req.body;
    if (bathroomCount === undefined || bathroomCount === null) {
      return res.status(400).json({ message: "bathroomCount is required" });
    }

    const generatedBathroomCountId = await BathroomCount.getNextSequentialId();
    const newCount = new BathroomCount({
      bathroomCountId: generatedBathroomCountId,
      bathroomCount,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedCount = await newCount.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "create",
      collectionName: "bathroomCounts",
      recordId: savedCount._id,
    });

    res.status(201).json(savedCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllBathroomCounts
exports.getAllBathroomCounts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    const counts = await BathroomCount.find(filter).sort({ bathroomCount: 1 });
    res.status(200).json(counts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getBathroomCountById
exports.getBathroomCountById = async (req, res) => {
  try {
    const count = await BathroomCount.findById(req.params.id);
    if (!count) {
      return res.status(404).json({ message: "Bathroom count not found" });
    }
    res.status(200).json(count);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateBathroomCount
exports.updateBathroomCount = async (req, res) => {
  try {
    const { bathroomCount, isActive } = req.body;
    const updateData = {};
    if (bathroomCount !== undefined) updateData.bathroomCount = bathroomCount;
    if (isActive !== undefined) updateData.isActive = isActive;

    const count = await BathroomCount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    if (!count) {
      return res.status(404).json({ message: "Bathroom count not found" });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "update",
      collectionName: "bathroomCounts",
      recordId: count._id,
    });

    res.status(200).json(count);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteBathroomCount
exports.deleteBathroomCount = async (req, res) => {
  try {
    const count = await BathroomCount.findByIdAndDelete(req.params.id);
    if (!count) {
      return res.status(404).json({ message: "Bathroom count not found" });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: "delete",
      collectionName: "bathroomCounts",
      recordId: count._id,
    });

    res.status(200).json({ message: "Bathroom count deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
