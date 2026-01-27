/**
 * Socket.IO Event Emitters
 * Utility functions to emit real-time events from routes
 */

// Kitchen/Order Events
const emitOrderCreated = (io, tenantId, branchId, order) => {
  // Emit to tenant-wide kitchen room
  io.to(`kitchen:${tenantId}`).emit('order:created', {
    type: 'ORDER_CREATED',
    order,
    timestamp: new Date().toISOString()
  });

  // Emit to branch-specific kitchen if provided
  if (branchId) {
    io.to(`kitchen:${tenantId}:${branchId}`).emit('order:created', {
      type: 'ORDER_CREATED',
      order,
      timestamp: new Date().toISOString()
    });
  }
};

const emitOrderUpdated = (io, tenantId, branchId, order) => {
  io.to(`kitchen:${tenantId}`).emit('order:updated', {
    type: 'ORDER_UPDATED',
    order,
    timestamp: new Date().toISOString()
  });

  if (branchId) {
    io.to(`kitchen:${tenantId}:${branchId}`).emit('order:updated', {
      type: 'ORDER_UPDATED',
      order,
      timestamp: new Date().toISOString()
    });
  }
};

const emitOrderItemUpdated = (io, tenantId, branchId, orderId, item) => {
  io.to(`kitchen:${tenantId}`).emit('order:item-updated', {
    type: 'ORDER_ITEM_UPDATED',
    orderId,
    item,
    timestamp: new Date().toISOString()
  });

  if (branchId) {
    io.to(`kitchen:${tenantId}:${branchId}`).emit('order:item-updated', {
      type: 'ORDER_ITEM_UPDATED',
      orderId,
      item,
      timestamp: new Date().toISOString()
    });
  }
};

const emitOrderCompleted = (io, tenantId, branchId, orderId) => {
  io.to(`kitchen:${tenantId}`).emit('order:completed', {
    type: 'ORDER_COMPLETED',
    orderId,
    timestamp: new Date().toISOString()
  });

  if (branchId) {
    io.to(`kitchen:${tenantId}:${branchId}`).emit('order:completed', {
      type: 'ORDER_COMPLETED',
      orderId,
      timestamp: new Date().toISOString()
    });
  }
};

const emitOrderCancelled = (io, tenantId, branchId, orderId) => {
  io.to(`kitchen:${tenantId}`).emit('order:cancelled', {
    type: 'ORDER_CANCELLED',
    orderId,
    timestamp: new Date().toISOString()
  });

  if (branchId) {
    io.to(`kitchen:${tenantId}:${branchId}`).emit('order:cancelled', {
      type: 'ORDER_CANCELLED',
      orderId,
      timestamp: new Date().toISOString()
    });
  }
};

// Hospitality Events (for future use)
const emitBookingCreated = (io, tenantId, booking) => {
  io.to(`tenant:${tenantId}`).emit('booking:created', {
    type: 'BOOKING_CREATED',
    booking,
    timestamp: new Date().toISOString()
  });
};

const emitBookingUpdated = (io, tenantId, booking) => {
  io.to(`tenant:${tenantId}`).emit('booking:updated', {
    type: 'BOOKING_UPDATED',
    booking,
    timestamp: new Date().toISOString()
  });
};

const emitHousekeepingTask = (io, tenantId, task) => {
  io.to(`tenant:${tenantId}`).emit('housekeeping:task', {
    type: 'HOUSEKEEPING_TASK',
    task,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  // Kitchen events
  emitOrderCreated,
  emitOrderUpdated,
  emitOrderItemUpdated,
  emitOrderCompleted,
  emitOrderCancelled,
  // Hospitality events
  emitBookingCreated,
  emitBookingUpdated,
  emitHousekeepingTask
};
