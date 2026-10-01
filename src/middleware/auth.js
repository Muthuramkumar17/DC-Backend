const jwt = require('jsonwebtoken');
const User = require('../models/User');

const capabilityByMethod = { GET: 'canRead', POST: 'canWrite', PUT: 'canUpdate', PATCH: 'canUpdate', DELETE: 'canDelete' };

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return res.status(401).json({ message: 'Invalid or expired token.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_jolly_home_needs_2026');

    // Normalize user identifier across all controllers
    const userId = decoded.userId || decoded._id || decoded.id;
    req.user = {
      ...decoded,
      userId,
      _id: userId,
      id: userId,
    };

    const capability = capabilityByMethod[req.method];
    if (!capability) return next();
    return authorize(capability)(req, res, next);
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Invalid or expired token.'});
  }
};

const authorize = (capability) => async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Invalid or expired token.' });
    const user = await User.findById(userId)
      .select('_id userId userName email isActive roleReference')
      .populate({
        path: 'roleReference',
        select: '_id roleId roleName canRead canWrite canUpdate canDelete isActive',
      })
      .lean();
    if (!user || !user.isActive || !user.roleReference || !user.roleReference.isActive || !user.roleReference[capability]) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    req.authenticatedUser = user;
    req.user.userId = user._id;
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      ['_id', 'id', 'userId', 'roleId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'].forEach((field) => delete req.body[field]);
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    return next();
  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: 'Unable to verify permissions'});
  }
};

module.exports = auth;
module.exports.authorize = authorize;
