const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Visit = require("../models/visit");
const TimeSlot = require("../models/TimeSlot");
const ServiceDuration = require("../models/serviceDuration");
const BathroomCount = require("../models/bathroomCount");
const Pricing = require("../models/pricing");

// Helper to parse 12-hour or 24-hour time into minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;

  const cleaned = timeStr.trim().toUpperCase();
  const is12Hour = cleaned.includes("AM") || cleaned.includes("PM");

  if (is12Hour) {
    const isPM = cleaned.includes("PM");
    const timePart = cleaned.replace(/(AM|PM)/g, "").trim();
    const [hoursStr, minutesStr = "0"] = timePart.split(":");

    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 1 ||
      hours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const [hoursStr, minutesStr = "0"] = cleaned.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

//12-hour format
const formatMinutesToTime12 = (totalMinutes) => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

//24-hour format
const formatMinutesToTime24 = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

// Combine a YYYY-MM-DD date string with minutes from midnight into a Date object (UTC)
const combineDateAndTime = (dateStr, totalMinutes) => {
  if (!dateStr) return null;
  const normalizedDateStr = String(dateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateStr)) return null;

  const [year, month, day] = normalizedDateStr.split("-").map(Number);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
};


const resolveServiceDuration = async ({
  bathroomCount,
  bathroomCountId,
  pricingId,
  serviceDurationId,
}) => {
  if (serviceDurationId && mongoose.Types.ObjectId.isValid(serviceDurationId)) {
    const doc = await ServiceDuration.findOne({ _id: serviceDurationId, isActive: true });
    if (!doc || !Number.isFinite(Number(doc.durationMinutes)) || Number(doc.durationMinutes) <= 0) {
      throw new Error("Active ServiceDuration master data is missing or invalid");
    }
    return Number(doc.durationMinutes);
  }

  if (pricingId && mongoose.Types.ObjectId.isValid(pricingId)) {
    const pricing = await Pricing.findOne({
      _id: pricingId,
      isActive: true,
    });
    const duration = pricing
      ? await ServiceDuration.findOne({ durationMinutes: { $in: [30, 45, 60, 75] }, isActive: true }).sort({ durationMinutes: 1 })
      : null;
    if (!pricing || !duration || !duration.isActive || !Number.isFinite(Number(duration.durationMinutes)) || Number(duration.durationMinutes) <= 0) {
      throw new Error("Active Pricing and ServiceDuration master data are required and must be valid");
    }
    return Number(duration.durationMinutes);
  }

  if (!bathroomCountId || !mongoose.Types.ObjectId.isValid(bathroomCountId)) {
    throw new Error("Pricing or active BathroomCount master data is required");
  }
  const bathDoc = await BathroomCount.findOne({ _id: bathroomCountId, isActive: true });
  if (!bathDoc || !Number.isFinite(Number(bathDoc.bathroomCount))) {
    throw new Error("Active BathroomCount master data is missing or invalid");
  }
  const pricing = await Pricing.findOne({ isActive: true, bathroomCountReference: bathDoc._id });
  const duration = pricing
    ? await ServiceDuration.findOne({ durationMinutes: { $in: [30, 45, 60, 75] }, isActive: true }).sort({ durationMinutes: 1 })
    : null;
  if (!pricing || !duration || !duration.isActive || !Number.isFinite(Number(duration.durationMinutes)) || Number(duration.durationMinutes) <= 0) {
    throw new Error("Active Pricing and ServiceDuration master data are required and must be valid");
  }
  return Number(duration.durationMinutes);
};


const resolveBufferTime = async (explicitBuffer) => {
  if (explicitBuffer !== undefined && explicitBuffer !== null) {
    throw new Error("BufferTime must be resolved from active TimeSlot master data");
  }
  const slotWithBuffer = await TimeSlot.findOne({ isActive: true }).sort({ startTime: 1 });
  if (!slotWithBuffer || !Number.isFinite(Number(slotWithBuffer.bufferTime)) || Number(slotWithBuffer.bufferTime) < 0) {
    throw new Error("Active TimeSlot master data with valid BufferTime is required");
  }
  return Number(slotWithBuffer.bufferTime);
};

const getAvailableSlotsForDate = async ({
  date,
  scheduledDate,
  bathroomCount,
  bathroomCountId,
  bathrooms,
  pricingId,
  serviceDurationId,
  duration,
  bufferDuration,
  bufferTime,
}) => {
  const rawDateStr = date || scheduledDate;
  if (!rawDateStr) {
    throw new Error("date or scheduledDate is required (format: YYYY-MM-DD)");
  }

  const normalizedDateStr = String(rawDateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateStr)) {
    throw new Error("Invalid date format. Please use YYYY-MM-DD.");
  }

  const bathValue = bathroomCount || bathrooms || bathroomCountId;
  const resolvedServiceDuration = await resolveServiceDuration({
        bathroomCount: bathValue,
        bathroomCountId,
        pricingId,
        serviceDurationId,
      });

  const resolvedBufferTime = await resolveBufferTime(
    bufferDuration || bufferTime,
  );
  const totalSlotDuration = resolvedServiceDuration + resolvedBufferTime;

  // Retrieve active operating time slots
  const activeTimeSlots = await TimeSlot.find({ isActive: true }).sort({
    startTime: 1,
  });
  if (!activeTimeSlots.length) {
    throw new Error("Active TimeSlot master data is required to determine operating hours");
  }

  // Query all active bookings on the given date (excluding cancelled)
  const startOfDay = new Date(`${normalizedDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${normalizedDateStr}T23:59:59.999Z`);

  const [existingBookings, existingVisits] = await Promise.all([
    Booking.find({
      isCancelled: { $ne: true },
      $or: [
        { startDateTime: { $gte: startOfDay, $lte: endOfDay } },
        { scheduledDate: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate("serviceDurationReference")
      .populate("timeSlotReference"),

    Visit.find({
      isCancelled: { $ne: true },
      scheduledStartDateTime: { $gte: startOfDay, $lte: endOfDay },
    }).populate("timeSlotReference"),
  ]);

  // Build existing occupied time ranges in minutes from midnight for this date
  const occupiedWindows = [];

  for (const b of existingBookings) {
    if (b.startDateTime) {
      const bStart = new Date(b.startDateTime);
      const startMins = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
      let endMins;

      if (b.endDateTime) {
        const bEnd = new Date(b.endDateTime);
        endMins = bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes();
      } else {
        if (!b.serviceDurationReference?.isActive || !b.timeSlotReference?.isActive) {
          throw new Error(`Booking ${b.bookingId || b._id} has missing or inactive scheduling master data`);
        }
        const bDur = b.serviceDurationReference.durationMinutes;
        const bBuf = b.timeSlotReference.bufferTime;
        endMins = startMins + bDur + bBuf;
      }

      occupiedWindows.push({
        start: startMins,
        end: endMins,
        source: `Booking ${b.bookingId || b._id}`,
      });
    }
  }

  for (const v of existingVisits) {
    if (v.scheduledStartDateTime) {
      const vStart = new Date(v.scheduledStartDateTime);
      const startMins = vStart.getUTCHours() * 60 + vStart.getUTCMinutes();
      let endMins;

      if (v.scheduledEndDateTime) {
        const vEnd = new Date(v.scheduledEndDateTime);
        endMins = vEnd.getUTCHours() * 60 + vEnd.getUTCMinutes();
      } else {
        endMins = startMins + totalSlotDuration;
      }

      occupiedWindows.push({
        start: startMins,
        end: endMins,
        source: `Visit ${v.visitId || v._id}`,
      });
    }
  }

  // Generate candidate slots for each active TimeSlot operating window
  const availableSlots = [];
  const allSlots = [];

  for (const slotDoc of activeTimeSlots) {
    const windowStartMins = parseTimeToMinutes(slotDoc.startTime);
    const windowEndMins = parseTimeToMinutes(slotDoc.endTime);
    const slotBuffer = Number(slotDoc.bufferTime);
    if (windowStartMins === null || windowEndMins === null || !Number.isFinite(slotBuffer) || slotBuffer < 0) {
      throw new Error(`TimeSlot ${slotDoc._id} has missing or invalid operating hours or BufferTime`);
    }
    const slotTotalDur = resolvedServiceDuration + slotBuffer;

    for (
      let current = windowStartMins;
      current + resolvedServiceDuration <= windowEndMins;
      current += slotTotalDur
    ) {
      const slotServiceEnd = current + resolvedServiceDuration;
      const slotBlockedEnd = current + slotTotalDur;

      const slotId = `${slotDoc._id}-${current}`;
      const slotStartTime12 = formatMinutesToTime12(current);
      const slotEndTime12 = formatMinutesToTime12(slotServiceEnd);

      // Check conflict: candidate [current, slotBlockedEnd) overlaps if candidateStart < occEnd && candidateEnd > occStart
      const hasOverlap = occupiedWindows.some(
        (occ) => current < occ.end && slotBlockedEnd > occ.start,
      );

      const slotItem = {
        id: slotId,
        mongoId: slotDoc._id,
        startTime: slotStartTime12,
        endTime: slotEndTime12,
        label: `${slotStartTime12} – ${slotEndTime12}`,
        durationMinutes: resolvedServiceDuration,
        bufferMinutes: slotBuffer,
        startMinutes: current,
        endMinutes: slotBlockedEnd,
        status: hasOverlap ? "booked" : "active",
      };

      allSlots.push(slotItem);

      if (!hasOverlap) {
        availableSlots.push(slotItem);
      }
    }
  }

  return {
    scheduledDate: normalizedDateStr,
    serviceDuration: resolvedServiceDuration,
    bufferDuration: resolvedBufferTime,
    totalDuration: totalSlotDuration,
    slots: availableSlots,
    allSlots,
  };
};

const checkBookingOverlap = async ({
  scheduledDate,
  startDateTime,
  endDateTime,
  excludeBookingId,
  visitScheduleDates = [],
}) => {
  const intervalsToCheck = [];

  if (startDateTime && endDateTime) {
    intervalsToCheck.push({
      start: new Date(startDateTime),
      end: new Date(endDateTime),
    });
  }

  if (Array.isArray(visitScheduleDates) && visitScheduleDates.length > 0) {
    for (const v of visitScheduleDates) {
      intervalsToCheck.push({
        start: new Date(v.scheduledStartDateTime),
        end: new Date(v.scheduledEndDateTime),
      });
    }
  }

  for (const interval of intervalsToCheck) {
    const bookingQuery = {
      isCancelled: { $ne: true },
      startDateTime: { $lt: interval.end },
      endDateTime: { $gt: interval.start },
    };

    if (excludeBookingId) {
      bookingQuery._id = { $ne: excludeBookingId };
    }

    const conflictingBooking = await Booking.findOne(bookingQuery);
    if (conflictingBooking) {
      return {
        hasConflict: true,
        reason:
          "Another booking overlaps with the requested service duration or buffer window.",
        conflictingRecord: conflictingBooking,
      };
    }

    const visitQuery = {
      isCancelled: { $ne: true },
      scheduledStartDateTime: { $lt: interval.end },
      scheduledEndDateTime: { $gt: interval.start },
    };

    if (excludeBookingId) {
      visitQuery.bookingReference = { $ne: excludeBookingId };
    }

    const conflictingVisit = await Visit.findOne(visitQuery);
    if (conflictingVisit) {
      return {
        hasConflict: true,
        reason:
          "A scheduled visit overlaps with the requested service duration or buffer window.",
        conflictingRecord: conflictingVisit,
      };
    }
  }

  return { hasConflict: false };
};

module.exports = {
  parseTimeToMinutes,
  formatMinutesToTime12,
  formatMinutesToTime24,
  combineDateAndTime,
  resolveServiceDuration,
  resolveBufferTime,
  getAvailableSlotsForDate,
  checkBookingOverlap,
};
