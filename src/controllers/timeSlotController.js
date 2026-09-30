const TimeSlot = require('../models/TimeSlot');
const AuditLog = require('../models/AuditLog');
const availabilityService = require('../services/availabilityService');

//createTimeSlot
exports.createTimeSlot = async (req, res) => {
  try {
    const { startTime, endTime, bufferTime, isActive } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'startTime and endTime are required' });
    }
    if (bufferTime === undefined || bufferTime === null) {
      return res.status(400).json({ message: 'bufferTime is required' });
    }

    const timeSlot = new TimeSlot({ timeSlotId: await TimeSlot.getNextSequentialId(),
      startTime,
      endTime,
      bufferTime,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedTimeSlot = await timeSlot.save();

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'create',
      collectionName: 'timeSlots',
      recordId: savedTimeSlot._id,
    });

    res.status(201).json(savedTimeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAvailableTimeSlots
exports.getAvailableTimeSlots = async (req, res) => {
  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const {
      scheduledDate,
      date,
      bathroomCount,
      bathroomCountId,
      bathrooms,
      serviceDuration,
      serviceDurationId,
      duration,
      bufferDuration,
      bufferTime,
      pricingId,
    } = params;

    const rawDateStr = scheduledDate || date;
    if (!rawDateStr) {
      return res.status(400).json({
        message: 'scheduledDate or date is required (format: YYYY-MM-DD)',
      });
    }

    const availabilityResult = await availabilityService.getAvailableSlotsForDate({
      date: rawDateStr,
      bathroomCount: bathroomCount || bathrooms || bathroomCountId,
      bathroomCountId,
      pricingId,
      serviceDurationId: serviceDurationId || serviceDuration,
      duration,
      bufferDuration: bufferDuration || bufferTime,
    });

    res.status(200).json(availabilityResult);
  } catch (error) {
    console.error('Availability error:', error);
    res.status(error.status || 400).json({ message: error.message });
  }
};

//getAllTimeSlots
exports.getAllTimeSlots = async (req, res) => {
  try {
    const timeSlots = await TimeSlot.find().sort({ startTime: 1 });
    res.status(200).json(timeSlots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// getTimeSlotById
exports.getTimeSlotById = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findById(req.params.id);
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// updateTimeSlot
exports.updateTimeSlot = async (req, res) => {
  try {
    const { startTime, endTime, bufferTime, isActive } = req.body;
    const updateData = {};
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (bufferTime !== undefined) updateData.bufferTime = bufferTime;
    if (isActive !== undefined) updateData.isActive = isActive;

    const timeSlot = await TimeSlot.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'update',
      collectionName: 'timeSlots',
      recordId: timeSlot._id,
    });

    res.status(200).json(timeSlot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// deleteTimeSlot
exports.deleteTimeSlot = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findByIdAndDelete(req.params.id);
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }

    await AuditLog.create({
      actionBy: req.user ? req.user.userId : null,
      operation: 'delete',
      collectionName: 'timeSlots',
      recordId: timeSlot._id,
    });

    res.status(200).json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
