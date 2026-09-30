const ServiceDuration = require('../models/serviceDuration');
const AuditLog = require('../models/AuditLog');

//createServiceDuration
exports.createServiceDuration = async (req, res) => {
  try {
    const { durationMinutes, isActive } = req.body;
    if (durationMinutes === undefined || durationMinutes === null) {
      return res.status(400).json({ message: 'durationMinutes is required' });
    }

    const duration = new ServiceDuration({ serviceDurationId: await ServiceDuration.getNextSequentialId(),
      durationMinutes,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedDuration = await duration.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'create',
      collectionName: 'serviceDurations',
      recordId: savedDuration._id,
    });

    res.status(201).json(savedDuration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllServiceDurations
exports.getAllServiceDurations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    const durations = await ServiceDuration.find(filter).sort({ durationMinutes: 1 });
    res.status(200).json(durations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getServiceDurationById
exports.getServiceDurationById = async (req, res) => {
  try {
    const duration = await ServiceDuration.findById(req.params.id);
    if (!duration) {
      return res.status(404).json({ message: 'Service duration not found' });
    }
    res.status(200).json(duration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateServiceDuration
exports.updateServiceDuration = async (req, res) => {
  try {
    const { durationMinutes, isActive } = req.body;
    const updateData = {};
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (isActive !== undefined) updateData.isActive = isActive;

    const duration = await ServiceDuration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!duration) {
      return res.status(404).json({ message: 'Service duration not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'update',
      collectionName: 'serviceDurations',
      recordId: duration._id,
    });

    res.status(200).json(duration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteServiceDuration
exports.deleteServiceDuration = async (req, res) => {
  try {
    const duration = await ServiceDuration.findByIdAndDelete(req.params.id);
    if (!duration) {
      return res.status(404).json({ message: 'Service duration not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'delete',
      collectionName: 'serviceDurations',
      recordId: duration._id,
    });

    res.status(200).json({ message: 'Service duration deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
