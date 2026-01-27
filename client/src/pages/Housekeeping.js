import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bed,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  User,
  RefreshCw,
  Filter,
  ChevronDown,
  Play,
  Check,
  XCircle,
  Wrench,
  Eye
} from 'lucide-react';
import { housekeepingAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const Housekeeping = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-tasks');
  const [tasks, setTasks] = useState([]);
  const [roomStatus, setRoomStatus] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [floors, setFloors] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksRes, roomStatusRes, statsRes] = await Promise.all([
        housekeepingAPI.getTasks({
          assignedTo: activeTab === 'my-tasks' ? user?.id : undefined,
          status: activeTab === 'all-tasks' ? undefined : 'pending,in_progress'
        }),
        housekeepingAPI.getRoomStatus(),
        housekeepingAPI.getStats()
      ]);

      setTasks(tasksRes.data.tasks || []);
      setRoomStatus(roomStatusRes.data.rooms || []);
      setStats(statsRes.data);

      // Extract unique floors
      const uniqueFloors = [...new Set(roomStatusRes.data.rooms?.map(r => r.floor) || [])].sort();
      setFloors(uniqueFloors);
    } catch (err) {
      console.error('Error fetching housekeeping data:', err);
      setError('Failed to load housekeeping data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStartTask = async (taskId) => {
    try {
      await housekeepingAPI.startTask(taskId);
      fetchData();
    } catch (err) {
      console.error('Error starting task:', err);
      alert('Failed to start task');
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await housekeepingAPI.completeTask(taskId);
      fetchData();
    } catch (err) {
      console.error('Error completing task:', err);
      alert('Failed to complete task');
    }
  };

  const handleVerifyTask = async (taskId) => {
    try {
      await housekeepingAPI.verifyTask(taskId);
      fetchData();
    } catch (err) {
      console.error('Error verifying task:', err);
      alert('Failed to verify task');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-200';
      case 'occupied': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reserved': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cleaning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'out_of_order': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTaskPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'in_progress': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <Check className="w-4 h-4 text-green-500" />;
      case 'verified': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredRooms = selectedFloor === 'all'
    ? roomStatus
    : roomStatus.filter(r => r.floor === selectedFloor);

  const TaskCard = ({ task }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bed className="w-5 h-5 text-gray-500" />
          <span className="font-semibold text-gray-900">Room {task.room?.roomNumber}</span>
          {task.room?.floor && (
            <span className="text-xs text-gray-500">Floor {task.room.floor}</span>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTaskPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-gray-700 capitalize">{task.type.replace('_', ' ')}</p>
        {task.notes && <p className="text-sm text-gray-500 mt-1">{task.notes}</p>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTaskStatusIcon(task.status)}
          <span className="text-sm text-gray-600 capitalize">{task.status.replace('_', ' ')}</span>
        </div>

        <div className="flex gap-2">
          {task.status === 'pending' && (
            <button
              onClick={() => handleStartTask(task.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              onClick={() => handleCompleteTask(task.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              Complete
            </button>
          )}
          {task.status === 'completed' && (
            <button
              onClick={() => handleVerifyTask(task.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify
            </button>
          )}
        </div>
      </div>

      {task.assignedTo && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
          <User className="w-4 h-4" />
          <span>{task.assignedTo.name}</span>
        </div>
      )}
    </div>
  );

  const RoomCard = ({ room }) => (
    <div
      className={`rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-md ${getStatusColor(room.status)}`}
      onClick={() => {
        setSelectedTask(room);
        setShowTaskModal(true);
      }}
    >
      <div className="text-center">
        <p className="font-bold text-lg">{room.roomNumber}</p>
        <p className="text-xs capitalize mt-1">{room.status.replace('_', ' ')}</p>
        {room.roomType && (
          <p className="text-xs mt-1 opacity-75">{room.roomType.name}</p>
        )}
        {room.currentGuest && (
          <p className="text-xs mt-2 font-medium truncate">{room.currentGuest}</p>
        )}
      </div>
    </div>
  );

  if (loading && !tasks.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Housekeeping</h1>
              <p className="text-sm text-gray-500">Room status & cleaning tasks</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-600">Pending: <strong>{stats.pendingTasks || 0}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">In Progress: <strong>{stats.inProgressTasks || 0}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Completed: <strong>{stats.completedToday || 0}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm text-gray-600">Rooms to Clean: <strong>{stats.roomsToClean || 0}</strong></span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Tabs */}
            <div className="border-b border-gray-200 px-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('my-tasks')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'my-tasks'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  My Tasks
                </button>
                <button
                  onClick={() => setActiveTab('all-tasks')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'all-tasks'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All Tasks
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className="p-4 space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks found</p>
                </div>
              ) : (
                tasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Room Status Board */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Room Status</h2>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                <option value="all">All Floors</option>
                {floors.map(floor => (
                  <option key={floor} value={floor}>Floor {floor}</option>
                ))}
              </select>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div> Available
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500"></div> Occupied
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-500"></div> Cleaning
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-500"></div> Maintenance
              </span>
            </div>

            {/* Room Grid */}
            <div className="p-4 grid grid-cols-3 gap-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              {filteredRooms.map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Room Detail Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Room {selectedTask.roomNumber}</h2>
                <button
                  onClick={() => {
                    setShowTaskModal(false);
                    setSelectedTask(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedTask.status)}`}>
                    {selectedTask.status?.replace('_', ' ')}
                  </span>
                </div>

                {selectedTask.roomType && (
                  <div>
                    <p className="text-sm text-gray-500">Room Type</p>
                    <p className="font-medium">{selectedTask.roomType.name}</p>
                  </div>
                )}

                {selectedTask.floor && (
                  <div>
                    <p className="text-sm text-gray-500">Floor</p>
                    <p className="font-medium">{selectedTask.floor}</p>
                  </div>
                )}

                {selectedTask.currentGuest && (
                  <div>
                    <p className="text-sm text-gray-500">Current Guest</p>
                    <p className="font-medium">{selectedTask.currentGuest}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-semibold mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200">
                      <Sparkles className="w-4 h-4" />
                      Start Cleaning
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200">
                      <Wrench className="w-4 h-4" />
                      Maintenance
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200">
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Clean
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200">
                      <Eye className="w-4 h-4" />
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Housekeeping;
