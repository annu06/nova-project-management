import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../utils.js';

const router = Router();

router.use(requireAuth);

/** Load a project the user is a member of, or null. */
async function loadMemberProject(projectId, userId) {
  const project = await Project.findOne({
    _id: projectId,
    members: userId,
  }).populate('members', 'name email');
  return project;
}

/** Attach task counts + progress percentage to a project JSON. */
async function withProgress(project) {
  const total = await Task.countDocuments({ project: project.id });
  const done = await Task.countDocuments({ project: project.id, status: 'done' });
  return {
    ...project.toJSON(),
    taskCount: total,
    doneCount: done,
    progress: total ? Math.round((done / total) * 100) : 0,
  };
}

// GET /api/projects — projects the current user belongs to
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ members: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('members', 'name email');

    const result = await Promise.all(projects.map(withProgress));
    res.json(result);
  })
);

// POST /api/projects
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, description, status } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await Project.create({
      name,
      description: description || '',
      status: status || 'active',
      owner: req.user.id,
      members: [req.user.id],
    });

    await project.populate('members', 'name email');
    res.status(201).json(await withProgress(project));
  })
);

// GET /api/projects/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await loadMemberProject(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(await withProgress(project));
  })
);

// PUT /api/projects/:id — owner only
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await Project.findOne({
      _id: req.params.id,
      members: req.user.id,
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.owner.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: 'Only the owner can edit the project' });
    }

    const { name, description, status } = req.body || {};
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    await project.save();

    await project.populate('members', 'name email');
    res.json(await withProgress(project));
  })
);

// DELETE /api/projects/:id — owner only, cascades to tasks
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.owner.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: 'Only the owner can delete the project' });
    }

    await Task.deleteMany({ project: project.id });
    await project.deleteOne();
    res.json({ ok: true });
  })
);

export default router;
