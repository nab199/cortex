import React, { useState, useEffect } from 'react';

interface SchoolMetrics {
  total_schools: number;
  total_users: number;
  total_students: number;
  total_teachers: number;
  total_attendance_records: number;
  total_grades: number;
  total_revenue: string;
}

interface SchoolBreakdown {
  id: number;
  name: string;
  users: number;
  students: number;
  teachers: number;
  attendance_records: number;
  grade_records: number;
  revenue: number;
}

interface RecentActivity {
  type: string;
  count: number;
  latest_date: string;
}

interface ActionLog {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  timestamp: string;
  status: 'success' | 'failed';
}

interface AuditSummaryItem {
  action: string;
  count: number;
  failed_count: number;
  latest: string;
  unique_users: number;
}

interface Teacher {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  school_id: number;
  school_name: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SchoolMetrics | null>(null);
  const [schoolsBreakdown, setSchoolsBreakdown] = useState<SchoolBreakdown[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummaryItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'teachers' | 'audit' | 'logs'>('overview');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [auditDays, setAuditDays] = useState(30);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ username: '', password: '', full_name: '', email: '', phone: '', subject: '', school_id: 0 });
  const [deletingTeacher, setDeletingTeacher] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/schools/overview', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.summary);
        setSchoolsBreakdown(data.schools_breakdown);
        setRecentActivity(data.recent_activity);
      }

      // Fetch audit summary
      const auditResponse = await fetch(`/api/admin/audit/summary?days=${auditDays}`, {
        credentials: 'include'
      });
      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditSummary(auditData.summary);
      }

      // Fetch recent action logs
      const logsResponse = await fetch(`/api/admin/action-logs?limit=10&days=${auditDays}`, {
        credentials: 'include'
      });
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setActionLogs(logsData.data);
      }

      // Fetch teachers
      fetchTeachers();
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await fetch('/api/users?role=teacher', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Transform data to include teacher details
        const teachersData = data.data.map((t: any) => ({
          id: t.id,
          user_id: t.id,
          full_name: t.full_name,
          email: t.email || '',
          phone: t.phone || '',
          subject: t.subject || '',
          school_id: t.school_id,
          school_name: schoolsBreakdown.find(s => s.id === t.school_id)?.name || 'Unknown'
        }));
        setTeachers(teachersData);
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newTeacher,
          role: 'teacher'
        })
      });
      if (response.ok) {
        alert('Teacher added successfully!');
        setShowAddTeacher(false);
        setNewTeacher({ username: '', password: '', full_name: '', email: '', phone: '', subject: '', school_id: 0 });
        fetchTeachers();
        fetchDashboardData();
      } else {
        const err = await response.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      console.error('Error adding teacher:', err);
      alert('Failed to add teacher');
    }
  };

  const handleDeleteTeacher = async (teacherId: number) => {
    if (!confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/users/${teacherId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        alert('Teacher deleted successfully!');
        fetchTeachers();
        fetchDashboardData();
      } else {
        const err = await response.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      console.error('Error deleting teacher:', err);
      alert('Failed to delete teacher');
    } finally {
      setDeletingTeacher(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Cross-school insights and compliance audit</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          {['overview', 'schools', 'teachers', 'audit', 'logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Schools"
                value={metrics.total_schools}
                color="bg-blue-500"
              />
              <MetricCard
                label="Total Users"
                value={metrics.total_users}
                color="bg-green-500"
              />
              <MetricCard
                label="Total Students"
                value={metrics.total_students}
                color="bg-purple-500"
              />
              <MetricCard
                label="Total Teachers"
                value={metrics.total_teachers}
                color="bg-orange-500"
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Recent Activity (Last 10 Days)</h2>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="font-medium capitalize">{activity.type}</span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">{activity.count}</div>
                        <div className="text-xs text-gray-500">
                          Latest: {new Date(activity.latest_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No recent activity</p>
                )}
              </div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Financial Summary</h2>
              <div className="text-3xl font-bold text-green-600">
                ETB {parseFloat(metrics.total_revenue).toLocaleString()}
              </div>
              <p className="text-gray-600 mt-2">Total revenue from successful payments</p>
            </div>
          </div>
        )}

        {/* Schools Tab */}
        {activeTab === 'schools' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">School Name</th>
                    <th className="px-6 py-3 text-left font-semibold">Users</th>
                    <th className="px-6 py-3 text-left font-semibold">Students</th>
                    <th className="px-6 py-3 text-left font-semibold">Teachers</th>
                    <th className="px-6 py-3 text-left font-semibold">Grades</th>
                    <th className="px-6 py-3 text-left font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schoolsBreakdown.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{school.name}</td>
                      <td className="px-6 py-4">{school.users}</td>
                      <td className="px-6 py-4">{school.students}</td>
                      <td className="px-6 py-4">{school.teachers}</td>
                      <td className="px-6 py-4">{school.grade_records}</td>
                      <td className="px-6 py-4 text-green-600 font-semibold">
                        ETB {school.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Teacher Management</h2>
              <button
                onClick={() => setShowAddTeacher(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Teacher
              </button>
            </div>

            {showAddTeacher && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Add New Teacher</h3>
                <form onSubmit={handleAddTeacher} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.username}
                        onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <input
                        type="password"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.password}
                        onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.full_name}
                        onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.email}
                        onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="text"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.phone}
                        onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.subject}
                        onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">School</label>
                      <select
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={newTeacher.school_id}
                        onChange={(e) => setNewTeacher({ ...newTeacher, school_id: parseInt(e.target.value) })}
                      >
                        <option value={0}>Select a school</option>
                        {schoolsBreakdown.map((school) => (
                          <option key={school.id} value={school.id}>{school.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddTeacher(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Teacher
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Name</th>
                      <th className="px-6 py-3 text-left font-semibold">Email</th>
                      <th className="px-6 py-3 text-left font-semibold">Phone</th>
                      <th className="px-6 py-3 text-left font-semibold">Subject</th>
                      <th className="px-6 py-3 text-left font-semibold">School</th>
                      <th className="px-6 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {teachers.length > 0 ? (
                      teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium">{teacher.full_name}</td>
                          <td className="px-6 py-4">{teacher.email}</td>
                          <td className="px-6 py-4">{teacher.phone}</td>
                          <td className="px-6 py-4">{teacher.subject}</td>
                          <td className="px-6 py-4">{teacher.school_name}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id)}
                              disabled={deletingTeacher === teacher.id}
                              className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingTeacher === teacher.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No teachers found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Audit Summary</h2>
              <select
                value={auditDays}
                onChange={(e) => {
                  setAuditDays(parseInt(e.target.value));
                  fetchDashboardData();
                }}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Action</th>
                      <th className="px-6 py-3 text-left font-semibold">Count</th>
                      <th className="px-6 py-3 text-left font-semibold">Failed</th>
                      <th className="px-6 py-3 text-left font-semibold">Users</th>
                      <th className="px-6 py-3 text-left font-semibold">Latest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditSummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium capitalize">{item.action}</td>
                        <td className="px-6 py-4">{item.count}</td>
                        <td className="px-6 py-4">
                          <span className={item.failed_count > 0 ? 'text-red-600 font-semibold' : ''}>
                            {item.failed_count}
                          </span>
                        </td>
                        <td className="px-6 py-4">{item.unique_users}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(item.latest).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Action</th>
                    <th className="px-6 py-3 text-left font-semibold">Resource</th>
                    <th className="px-6 py-3 text-left font-semibold">Timestamp</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {actionLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium capitalize">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.resource_type}</td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Component
const MetricCard: React.FC<{ label: string; value: number | string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className={`${color} text-white rounded-full w-12 h-12 flex items-center justify-center mb-4`}>
      <span className="text-xl font-bold">#</span>
    </div>
    <p className="text-gray-600 text-sm font-medium">{label}</p>
    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
  </div>
);

export default SuperAdminDashboard;
