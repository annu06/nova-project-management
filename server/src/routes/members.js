import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../utils.js';

const router = Router();
router.use(requireAuth);

/** Serialize members with an isOwner flag. */
function serializeMembers(project) {
  return project.members.map((m) => ({
    ...m.toJSON(),
    isOwner: m._id.toString() === project.owner.toString(),
  }));
}

// GET /api/projects/:id/members
router.get(
  '/projects/:id/members',
  asyncHandler(async (req, res) => {
    const project = await Project.findOne({
      _id: req.params.id,
      members: req.user.id,
    }).populate('members', 'name email');
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json(serializeMembers(project));
  })
);

// POST /api/projects/:id/members — add by email
router.post(
  '/projects/:id/members',
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const project = await Project.findById(req.params.id);
    if (
      !project ||
      !project.members.some((m) => m.toString() === req.user.id.toString())
    ) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only the owner can add members' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ error: 'No registered user with that email' });
    }
    if (project.members.some((m) => m.toString() === user.id.toString())) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    project.members.push(user.id);
    await project.save();
    await project.populate('members', 'name email');

    res.status(201).json(serializeMembers(project));
  })
);

// DELETE /api/projects/:id/members/:uid
router.delete(
  '/projects/:id/members/:uid',
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.owner.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: 'Only the owner can remove members' });
    }
    if (req.params.uid === project.owner.toString()) {
      return res.status(400).json({ error: 'Cannot remove the project owner' });
    }

    project.members = project.members.filter(
      (m) => m.toString() !== req.params.uid
    );
    await project.save();

    // Unassign this user from any tasks in the project.
    await Task.updateMany(
      { project: project.id, assignee: req.params.uid },
      { $set: { assignee: null } }
    );

    res.json({ ok: true });
  })
);

export default router;
