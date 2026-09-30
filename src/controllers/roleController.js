const Role = require('../models/role');
const AuditLog = require('../models/auditLog');
const RoleLog = require('../models/AuditLog');

//createRole
exports.createRole = async (req, res) => {
  try {
    const { roleName, canRead, canWrite, canUpdate, canDelete, isActive } = req.body;
    if (!roleName) {
      return res.status(400).json({ message: 'roleName is required' });
    }

    const capabilities = { superadmin: [true, true, true, true], admin: [true, true, false, false], user: [true, false, false, false] };
    const matrix = capabilities[String(roleName).toLowerCase()];
    if (!matrix) return res.status(400).json({ message: 'roleName must be superadmin, admin, or user' });
    const role = new Role({ roleId: await Role.getNextSequentialId(),
      roleName,
      canRead: canRead !== undefined ? canRead : matrix[0],
      canWrite: canWrite !== undefined ? canWrite : matrix[1],
      canUpdate: canUpdate !== undefined ? canUpdate : matrix[2],
      canDelete: canDelete !== undefined ? canDelete : matrix[3],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user ? req.user.userId : null,
    });
    const savedRole = await role.save();

    await RoleLog.create({
      operation: 'CREATE',
      actionBy: req.user ? req.user.userId : null,
      roleId: savedRole._id,
      details: { action: 'Role created', roleName: savedRole.roleName },
      newValue: savedRole.toObject(),
    });

    res.status(201).json(savedRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getAllRoles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//getRoleById
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//updateRole
exports.updateRole = async (req, res) => {
  try {
    const { roleName, canRead, canWrite, canUpdate, canDelete, isActive } = req.body;
    const previousRole = await Role.findById(req.params.id);
    if (!previousRole) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const updateData = {};
    if (roleName !== undefined) updateData.roleName = roleName;
    if (canRead !== undefined) updateData.canRead = canRead;
    if (canWrite !== undefined) updateData.canWrite = canWrite;
    if (canUpdate !== undefined) updateData.canUpdate = canUpdate;
    if (canDelete !== undefined) updateData.canDelete = canDelete;
    if (isActive !== undefined) updateData.isActive = isActive;

    const role = await Role.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    await RoleLog.create({
      operation: 'UPDATE',
      actionBy: req.user ? req.user.userId : null,
      roleId: role._id,
      details: { updatedFields: Object.keys(updateData) },
      previousValue: previousRole.toObject(),
      newValue: role.toObject(),
    });

    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//deleteRole
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    await RoleLog.create({
      operation: 'DELETE',
      actionBy: req.user ? req.user.userId : null,
      roleId: role._id,
      details: { action: 'Role deleted' },
      previousValue: role.toObject(),
      newValue: null,
    });

    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
