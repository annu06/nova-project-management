import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../utils.js';

const router = Router();
router.use(requireAuth);

/** Ensure the user is a member of the project. */
async function assertMember(projectId, userId) {
  return Project.exists({ _id: projectId, members: userId });
}

// GET /api/projects/:id/tasks
router.get(
  '/projects/:id/tasks',
  asyncHandler(async (req, res) => {
    if (!(await assertMember(req.params.id, req.user.id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = await Task.find({ project: req.params.id })
      .sort({ createdAt: 1 })
      .populate('assignee', 'name email');
    res.json(tasks.map((t) => t.toJSON()));
  })
);

// POST /api/projects/:id/tasks
router.post(
  '/projects/:id/tasks',
  asyncHandler(async (req, res) => {
    if (!(await assertMember(req.params.id, req.user.id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { title, description, status, priority, dueDate, assignee } =
      req.body || {};
    if (!title) return res.status(400).json({ error: 'Task title is required' });

    if (assignee) {
      const ok = await assertMember(req.params.id, assignee);
      if (!ok) {
        return res
          .status(400)
          .json({ error: 'Assignee must be a member of the project' });
      }
    }

    const task = await Task.create({
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      assignee: assignee || null,
      project: req.params.id,
      createdBy: req.user.id,
    });

    await task.populate('assignee', 'name email');
    res.status(201).json(task.toJSON());
  })
);

// PUT /api/tasks/:id
router.put(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!(await assertMember(task.project, req.user.id))) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { title, description, status, priority, dueDate, assignee } =
      req.body || {};

    if (assignee) {
      const ok = await assertMember(task.project, assignee);
      if (!ok) {
        return res
          .status(400)
          .json({ error: 'Assignee must be a member of the project' });
      }
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (assignee !== undefined) task.assignee = assignee || null;
    await task.save();

    await task.populate('assignee', 'name email');
    res.json(task.toJSON());
  })
);

// DELETE /api/tasks/:id
router.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!(await assertMember(task.project, req.user.id))) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await task.deleteOne();
    res.json({ ok: true });
  })
);

export default router;
