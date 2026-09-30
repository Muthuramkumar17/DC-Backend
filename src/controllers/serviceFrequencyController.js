const ServiceFrequency = require('../models/ServiceFrequency');
const AuditLog = require('../models/AuditLog');

//createServiceFrequency
exports.createServiceFrequency = async (req, res) => {
  try {
    const { frequencyName, intervalDays, isActive } = req.body;
    if (!frequencyName) {
      return res.status(400).json({ message: 'frequencyName is required' });
    }
    if (!Number.isInteger(Number(intervalDays)) || Number(intervalDays) < 1) {
      return res.status(400).json({ message: 'intervalDays must be a positive whole number' });
    }

    const frequency = new ServiceFrequency({ serviceFrequencyId: await ServiceFrequency.getNextSequentialId(),
      frequencyName,
      intervalDays: Number(intervalDays),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedFrequency = await frequency.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'create',
      collectionName: 'serviceFrequencies',
      recordId: savedFrequency._id,
    });

    res.status(201).json(savedFrequency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllServiceFrequencies
exports.getAllServiceFrequencies = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    const frequencies = await ServiceFrequency.find(filter).sort({ createdAt: -1 });
    res.status(200).json(frequencies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getServiceFrequencyById
exports.getServiceFrequencyById = async (req, res) => {
  try {
    const frequency = await ServiceFrequency.findById(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Service frequency not found' });
    }
    res.status(200).json(frequency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateServiceFrequency
exports.updateServiceFrequency = async (req, res) => {
  try {
    const { frequencyName, intervalDays, isActive } = req.body;
    const updateData = {};
    if (frequencyName !== undefined) updateData.frequencyName = frequencyName;
    if (intervalDays !== undefined) {
      if (!Number.isInteger(Number(intervalDays)) || Number(intervalDays) < 1) {
        return res.status(400).json({ message: 'intervalDays must be a positive whole number' });
      }
      updateData.intervalDays = Number(intervalDays);
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const frequency = await ServiceFrequency.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!frequency) {
      return res.status(404).json({ message: 'Service frequency not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'update',
      collectionName: 'serviceFrequencies',
      recordId: frequency._id,
    });

    res.status(200).json(frequency);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteServiceFrequency
exports.deleteServiceFrequency = async (req, res) => {
  try {
    const frequency = await ServiceFrequency.findByIdAndDelete(req.params.id);
    if (!frequency) {
      return res.status(404).json({ message: 'Service frequency not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'delete',
      collectionName: 'serviceFrequencies',
      recordId: frequency._id,
    });

    res.status(200).json({ message: 'Service frequency deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
