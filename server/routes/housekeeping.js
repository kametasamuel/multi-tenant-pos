const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireManager } = require('../middleware/auth');

// Priority order mapping (higher number = higher priority)
const PRIORITY_ORDER = { urgent: 4, high: 3, normal: 2, low: 1 };
const sortByPriority = (tasks) => {
  return tasks.sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
};

// ============================================
// HOUSEKEEPING TASKS
// ============================================

// Get all tasks with filters
router.get('/tasks', authenticate, async (req, res) => {
  try {
    const {
      branchId, status, taskType, priority, assignedTo,
      roomId, date, page = 1, limit = 50
    } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (roomId) where.roomId = roomId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    const [tasks, total] = await Promise.all([
      prisma.housekeepingTask.findMany({
        where,
        include: {
          room: {
            select: {
              roomNumber: true,
              floor: true,
              cleaningStatus: true,
              roomType: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.housekeepingTask.count({ where })
    ]);

    // Sort by priority (urgent > high > normal > low), then by createdAt
    const sortedTasks = sortByPriority(tasks);

    res.json({
      tasks: sortedTasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get pending tasks (for housekeeping dashboard)
router.get('/pending', authenticate, async (req, res) => {
  try {
    const { branchId, assignedTo } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      status: { in: ['pending', 'in_progress'] }
    };
    if (branchId) where.branchId = branchId;
    if (assignedTo) where.assignedTo = assignedTo;

    const tasks = await prisma.housekeepingTask.findMany({
      where,
      include: {
        room: {
          select: {
            roomNumber: true,
            floor: true,
            building: true,
            cleaningStatus: true,
            status: true,
            roomType: { select: { name: true } }
          }
        }
      },
      orderBy: [
        { scheduledFor: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Sort by priority (urgent > high > normal > low)
    const sortedTasks = sortByPriority(tasks);

    // Group by priority
    const grouped = {
      urgent: sortedTasks.filter(t => t.priority === 'urgent'),
      high: sortedTasks.filter(t => t.priority === 'high'),
      normal: sortedTasks.filter(t => t.priority === 'normal'),
      low: sortedTasks.filter(t => t.priority === 'low')
    };

    res.json({
      tasks: sortedTasks,
      grouped,
      summary: {
        total: tasks.length,
        urgent: grouped.urgent.length,
        high: grouped.high.length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length
      }
    });
  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    res.status(500).json({ error: 'Failed to fetch pending tasks' });
  }
});

// Get room status board (overview of all rooms)
router.get('/room-status', authenticate, async (req, res) => {
  try {
    const { branchId, floor } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      isActive: true
    };
    if (branchId) where.branchId = branchId;
    if (floor) where.floor = floor;

    const rooms = await prisma.room.findMany({
      where,
      include: {
        roomType: { select: { name: true, code: true } },
        housekeepingTasks: {
          where: { status: { in: ['pending', 'in_progress'] } },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        bookingRooms: {
          where: { status: 'checked_in' },
          include: {
            booking: {
              select: {
                checkOutDate: true,
                guest: { select: { lastName: true, vipStatus: true } }
              }
            }
          },
          take: 1
        }
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }]
    });

    // Format for display
    const roomStatus = rooms.map(room => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.roomType.name,
      status: room.status,
      cleaningStatus: room.cleaningStatus,
      hasPendingTask: room.housekeepingTasks.length > 0,
      currentTask: room.housekeepingTasks[0] || null,
      isOccupied: room.bookingRooms.length > 0,
      currentGuest: room.bookingRooms[0]?.booking?.guest?.lastName || null,
      checkoutDate: room.bookingRooms[0]?.booking?.checkOutDate || null,
      isVIP: room.bookingRooms[0]?.booking?.guest?.vipStatus !== 'regular'
    }));

    // Summary stats
    const summary = {
      total: rooms.length,
      clean: rooms.filter(r => r.cleaningStatus === 'clean').length,
      dirty: rooms.filter(r => r.cleaningStatus === 'dirty').length,
      inspecting: rooms.filter(r => r.cleaningStatus === 'inspecting').length,
      occupied: rooms.filter(r => r.status === 'occupied').length,
      available: rooms.filter(r => r.status === 'available' && r.cleaningStatus === 'clean').length,
      maintenance: rooms.filter(r => r.status === 'maintenance' || r.status === 'out_of_order').length
    };

    res.json({ rooms: roomStatus, summary });
  } catch (error) {
    console.error('Error fetching room status:', error);
    res.status(500).json({ error: 'Failed to fetch room status' });
  }
});

// Get single task
router.get('/tasks/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.housekeepingTask.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        room: {
          include: { roomType: true }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/tasks', authenticate, async (req, res) => {
  try {
    const { roomId, taskType, priority, assignedTo, notes, scheduledFor, branchId } = req.body;

    if (!roomId || !taskType) {
      return res.status(400).json({ error: 'Room and task type are required' });
    }

    // Verify room exists
    const room = await prisma.room.findFirst({
      where: { id: roomId, tenantId: req.user.tenantId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const task = await prisma.housekeepingTask.create({
      data: {
        tenantId: req.user.tenantId,
        branchId: branchId || room.branchId,
        roomId,
        taskType,
        priority: priority || 'normal',
        assignedTo,
        notes,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdBy: req.user.id
      },
      include: {
        room: { select: { roomNumber: true, roomType: { select: { name: true } } } }
      }
    });

    // Update room cleaning status if not already dirty
    if (room.cleaningStatus === 'clean') {
      await prisma.room.update({
        where: { id: roomId },
        data: { cleaningStatus: 'dirty' }
      });
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Bulk create tasks (e.g., for all checkout rooms)
router.post('/tasks/bulk', authenticate, requireManager, async (req, res) => {
  try {
    const { roomIds, taskType, priority, scheduledFor } = req.body;

    if (!roomIds || !roomIds.length || !taskType) {
      return res.status(400).json({ error: 'Room IDs and task type are required' });
    }

    const rooms = await prisma.room.findMany({
      where: {
        id: { in: roomIds },
        tenantId: req.user.tenantId
      }
    });

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'No valid rooms found' });
    }

    const tasks = await prisma.housekeepingTask.createMany({
      data: rooms.map(room => ({
        tenantId: req.user.tenantId,
        branchId: room.branchId,
        roomId: room.id,
        taskType,
        priority: priority || 'normal',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdBy: req.user.id
      }))
    });

    res.status(201).json({
      message: `${tasks.count} tasks created successfully`,
      count: tasks.count
    });
  } catch (error) {
    console.error('Error bulk creating tasks:', error);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

// Update task
router.put('/tasks/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, assignedTo, notes, scheduledFor } = req.body;

    const existing = await prisma.housekeepingTask.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.housekeepingTask.update({
      where: { id },
      data: {
        priority,
        assignedTo,
        notes,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
      },
      include: {
        room: { select: { roomNumber: true } }
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Start task
router.post('/tasks/:id/start', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: 'Task is not pending' });
    }

    const updatedTask = await prisma.housekeepingTask.update({
      where: { id },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
        assignedTo: task.assignedTo || req.user.id
      },
      include: {
        room: { select: { roomNumber: true } }
      }
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error starting task:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

// Complete task
router.post('/tasks/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { room: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'completed' || task.status === 'verified') {
      return res.status(400).json({ error: 'Task is already completed' });
    }

    await prisma.$transaction(async (tx) => {
      // Complete task
      await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          notes: notes || task.notes
        }
      });

      // Update room cleaning status
      await tx.room.update({
        where: { id: task.roomId },
        data: {
          cleaningStatus: 'inspecting',
          lastCleanedAt: new Date()
        }
      });
    });

    const updatedTask = await prisma.housekeepingTask.findUnique({
      where: { id },
      include: { room: { select: { roomNumber: true, cleaningStatus: true } } }
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Verify task (inspector approval)
router.post('/tasks/:id/verify', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { room: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Task must be completed before verification' });
    }

    if (approved) {
      // Mark as verified and room as clean
      await prisma.$transaction(async (tx) => {
        await tx.housekeepingTask.update({
          where: { id },
          data: {
            status: 'verified',
            verifiedAt: new Date(),
            verifiedBy: req.user.id,
            notes: notes || task.notes
          }
        });

        await tx.room.update({
          where: { id: task.roomId },
          data: {
            cleaningStatus: 'clean',
            lastInspectedAt: new Date()
          }
        });
      });
    } else {
      // Reject - send back for re-cleaning
      await prisma.$transaction(async (tx) => {
        await tx.housekeepingTask.update({
          where: { id },
          data: {
            status: 'pending',
            completedAt: null,
            notes: notes ? `Re-clean required: ${notes}` : 'Re-clean required'
          }
        });

        await tx.room.update({
          where: { id: task.roomId },
          data: { cleaningStatus: 'dirty' }
        });
      });
    }

    const updatedTask = await prisma.housekeepingTask.findUnique({
      where: { id },
      include: { room: { select: { roomNumber: true, cleaningStatus: true } } }
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error verifying task:', error);
    res.status(500).json({ error: 'Failed to verify task' });
  }
});

// Delete task
router.delete('/tasks/:id', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.housekeepingTask.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'in_progress') {
      return res.status(400).json({ error: 'Cannot delete an in-progress task' });
    }

    await prisma.housekeepingTask.delete({ where: { id } });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============================================
// STATISTICS
// ============================================

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (branchId) where.branchId = branchId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, completed, pending, avgCompletionTime] = await Promise.all([
      prisma.housekeepingTask.count({ where }),
      prisma.housekeepingTask.count({ where: { ...where, status: { in: ['completed', 'verified'] } } }),
      prisma.housekeepingTask.count({ where: { ...where, status: 'pending' } }),
      prisma.housekeepingTask.findMany({
        where: {
          ...where,
          status: { in: ['completed', 'verified'] },
          startedAt: { not: null },
          completedAt: { not: null }
        },
        select: { startedAt: true, completedAt: true }
      })
    ]);

    // Calculate average completion time
    let avgMinutes = 0;
    if (avgCompletionTime.length > 0) {
      const totalMinutes = avgCompletionTime.reduce((sum, task) => {
        const diff = task.completedAt.getTime() - task.startedAt.getTime();
        return sum + diff / (1000 * 60);
      }, 0);
      avgMinutes = Math.round(totalMinutes / avgCompletionTime.length);
    }

    // Tasks by type
    const byType = await prisma.housekeepingTask.groupBy({
      by: ['taskType'],
      where,
      _count: { id: true }
    });

    res.json({
      total,
      completed,
      pending,
      inProgress: total - completed - pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgCompletionMinutes: avgMinutes,
      byType: byType.reduce((acc, item) => {
        acc[item.taskType] = item._count.id;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
