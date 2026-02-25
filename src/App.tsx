import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  MessageSquare, 
  LayoutDashboard, 
  LogOut, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  Search,
  Plus,
  Filter,
  ArrowRight,
  School,
  Download,
  Trash2,
  Table,
  Save,
  ClipboardPaste,
  Edit2,
  Check,
  X,
  LineChart as LineChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar, Card, StatCard, User } from './components/UI';
import { offlineService } from './services/offlineService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

const API_BASE = '/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', full_name: '', school_name: '' });
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && user) {
      const token = localStorage.getItem('token');
      if (token) {
        setSyncing(true);
        offlineService.sync(token).finally(() => setSyncing(false));
      }
    }
  }, [isOnline, user]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('dashboard');
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
        >
          <div className="bg-slate-900 p-8 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-4">
              <School className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">{isSignup ? 'Create School Account' : 'Welcome Back'}</h2>
            <p className="text-slate-400 text-sm mt-1">EduFinance Pro Management System</p>
          </div>
          
          <div className="p-8 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {isSignup ? (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="John Doe"
                    value={signupForm.full_name}
                    onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="admin@school.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">School Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Global Academy"
                    value={signupForm.school_name}
                    onChange={(e) => setSignupForm({ ...signupForm, school_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="••••••••"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group"
                >
                  Register School
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email or Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Enter your email or username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            )}

            <div className="text-center">
              <button 
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-emerald-600 font-semibold hover:underline"
              >
                {isSignup ? 'Already have an account? Sign In' : 'New school? Register here'}
              </button>
            </div>
            
            {!isSignup && (
              <p className="text-center text-[10px] text-slate-400">
                Default admin: admin / admin123
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm">Welcome back, {user.full_name}</p>
          </div>
          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                OFFLINE MODE
              </div>
            )}
            {syncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold animate-pulse">
                <Save className="w-3.5 h-3.5" />
                SYNCING...
              </div>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
              />
            </div>
            <button className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardView user={user} />}
          {activeTab === 'attendance' && <AttendanceView user={user} />}
          {activeTab === 'grades' && <GradesView user={user} />}
          {activeTab === 'payments' && <PaymentsView user={user} />}
          {activeTab === 'messaging' && <MessagingView user={user} />}
          {activeTab === 'admin' && <AdminView user={user} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Views ---

function DashboardView({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/reports/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    };
    if (user.role === 'admin') fetchStats();
  }, [user]);

  return (
    <div className="space-y-8">
      {user.role === 'admin' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Students" value={stats.totalStudents} icon={Users} trend={12} />
          <StatCard label="Total Teachers" value={stats.totalTeachers} icon={UserPlus} trend={5} color="blue" />
          <StatCard label="Total Revenue" value={`${stats.totalRevenue} ETB`} icon={CreditCard} trend={8} color="emerald" />
          <StatCard label="Avg. Grade" value={`${stats.averageGrade.toFixed(1)}%`} icon={TrendingUp} trend={-2} color="amber" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Recent Activity" className="lg:col-span-2">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">New Grade Posted</p>
                  <p className="text-xs text-slate-500">Mathematics - Grade 10A</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-400">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Upcoming Events">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white">
                <span className="text-xs font-bold uppercase">Feb</span>
                <span className="text-lg font-bold">28</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Parent-Teacher Meeting</p>
                <p className="text-xs text-slate-500">09:00 AM - Main Hall</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white">
                <span className="text-xs font-bold uppercase">Mar</span>
                <span className="text-lg font-bold">05</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Mid-term Exams Start</p>
                <p className="text-xs text-slate-500">All Grades</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AttendanceView({ user }: { user: User }) {
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const [attRes, studentRes] = await Promise.all([
        fetch(`${API_BASE}/attendance`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (attRes.ok) setRecords(await attRes.json());
      if (studentRes.ok) setStudents(await studentRes.json());
      setLoading(false);
    };
    fetchData();
  }, []);

  const markAttendance = async (studentId: number, status: string) => {
    const token = localStorage.getItem('token');
    const date = new Date().toISOString().split('T')[0];
    const data = { student_id: studentId, date, status };

    if (!navigator.onLine) {
      offlineService.saveAction('attendance', data);
      alert('Offline: Attendance recorded locally and will sync when online.');
      return;
    }

    const res = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const attRes = await fetch(`${API_BASE}/attendance`, { headers: { 'Authorization': `Bearer ${token}` } });
      setRecords(await attRes.json());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Attendance Management</h3>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors">
            <Plus className="w-4 h-4" />
            Bulk Mark
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Student List" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-4">Student</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((student) => {
                  const todayRecord = records.find(r => r.student_id === student.id && r.date === new Date().toISOString().split('T')[0]);
                  return (
                    <tr key={student.id} className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {student.full_name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{student.full_name}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        {todayRecord ? (
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${
                            todayRecord.status === 'present' ? 'bg-emerald-100 text-emerald-600' : 
                            todayRecord.status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {todayRecord.status}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not marked</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {(user.role === 'teacher' || user.role === 'admin') && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => markAttendance(student.id, 'present')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 hover:rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>
                            <button onClick={() => markAttendance(student.id, 'absent')} className="p-1.5 text-red-600 hover:bg-red-50 hover:rounded-lg"><AlertCircle className="w-4 h-4" /></button>
                            <button onClick={() => markAttendance(student.id, 'late')} className="p-1.5 text-amber-600 hover:bg-amber-50 hover:rounded-lg"><Clock className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Attendance Stats">
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Present Today</p>
              <p className="text-2xl font-bold text-emerald-900">94%</p>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-xs font-bold text-red-600 uppercase mb-1">Absent Today</p>
              <p className="text-2xl font-bold text-red-900">4%</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-bold text-amber-600 uppercase mb-1">Late Today</p>
              <p className="text-2xl font-bold text-amber-900">2%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function GradesView({ user }: { user: User }) {
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [bulkGrades, setBulkGrades] = useState<any[]>([
    { student_id: '', subject: '', score: '', date: new Date().toISOString().split('T')[0], component_id: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ score: '', date: '', component_id: '' });
  const [selectedProgressionStudentId, setSelectedProgressionStudentId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grades' | 'marklist' | 'overall'>('grades');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const [gradeRes, studentRes, compRes] = await Promise.all([
        fetch(`${API_BASE}/grades`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/grade-components`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (gradeRes.ok) setGrades(await gradeRes.json());
      if (studentRes.ok) setStudents(await studentRes.json());
      if (compRes.ok) setComponents(await compRes.json());
    };
    fetchData();
  }, []);

  const addBulkRow = () => {
    const lastRow = bulkGrades[bulkGrades.length - 1];
    setBulkGrades([...bulkGrades, { 
      student_id: '', 
      subject: lastRow?.subject || '', 
      score: '', 
      date: lastRow?.date || new Date().toISOString().split('T')[0],
      component_id: lastRow?.component_id || ''
    }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkGrades.length > 1) {
      setBulkGrades(bulkGrades.filter((_, i) => i !== index));
    }
  };

  const updateBulkRow = (index: number, field: string, value: string) => {
    const updated = [...bulkGrades];
    updated[index] = { ...updated[index], [field]: value };
    setBulkGrades(updated);
  };

  const saveBulkGrades = async () => {
    const validGrades = bulkGrades.filter(g => g.student_id && g.subject && g.score);
    if (validGrades.length === 0) return;

    if (!navigator.onLine) {
      validGrades.forEach(g => {
        offlineService.saveAction('grade', {
          ...g,
          student_id: parseInt(g.student_id),
          score: parseFloat(g.score)
        });
      });
      alert('Offline: Grades recorded locally and will sync when online.');
      setShowAdd(false);
      setBulkGrades([{ student_id: '', subject: '', score: '', date: new Date().toISOString().split('T')[0] }]);
      return;
    }

    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      await Promise.all(validGrades.map(g => 
        fetch(`${API_BASE}/grades`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            ...g, 
            student_id: parseInt(g.student_id), 
            score: parseFloat(g.score) 
          }),
        })
      ));

      setShowAdd(false);
      setBulkGrades([{ student_id: '', subject: '', score: '', date: new Date().toISOString().split('T')[0] }]);
      const gradeRes = await fetch(`${API_BASE}/grades`, { headers: { 'Authorization': `Bearer ${token}` } });
      setGrades(await gradeRes.json());
    } catch (error) {
      console.error('Error saving grades:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (grade: any) => {
    setEditingGradeId(grade.id);
    setEditFormData({ score: grade.score.toString(), date: grade.date, component_id: grade.component_id?.toString() || '' });
  };

  const handleCancelEdit = () => {
    setEditingGradeId(null);
    setEditFormData({ score: '', date: '', component_id: '' });
  };

  const handleSaveEdit = async (id: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/grades/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        score: parseFloat(editFormData.score), 
        date: editFormData.date,
        component_id: editFormData.component_id ? parseInt(editFormData.component_id) : null
      }),
    });

    if (res.ok) {
      setEditingGradeId(null);
      const gradeRes = await fetch(`${API_BASE}/grades`, { headers: { 'Authorization': `Bearer ${token}` } });
      setGrades(await gradeRes.json());
    }
  };

  const progressionData = React.useMemo(() => {
    if (!selectedProgressionStudentId) return [];
    
    const studentGrades = grades.filter(g => g.student_id.toString() === selectedProgressionStudentId);
    const sortedGrades = [...studentGrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const dataMap: { [key: string]: any } = {};
    sortedGrades.forEach(g => {
      if (!dataMap[g.date]) {
        dataMap[g.date] = { date: g.date };
      }
      dataMap[g.date][g.subject] = g.score;
    });
    
    return Object.values(dataMap);
  }, [grades, selectedProgressionStudentId]);

  const subjects = React.useMemo(() => {
    return Array.from(new Set(grades.map(g => g.subject)));
  }, [grades]);

  const handlePaste = () => {
    const lines = pasteText.trim().split('\n');
    const newRows = lines.map(line => {
      const [studentName, subject, score, date, componentName] = line.split(/\t|,/);
      
      // Try to find student ID by name
      const student = students.find(s => 
        s.full_name.toLowerCase().includes(studentName?.trim().toLowerCase())
      );

      const component = components.find(c => 
        c.name.toLowerCase().includes(componentName?.trim().toLowerCase())
      );

      return {
        student_id: student ? student.id.toString() : '',
        subject: subject?.trim() || '',
        score: score?.trim() || '',
        date: date?.trim() || new Date().toISOString().split('T')[0],
        component_id: component ? component.id.toString() : ''
      };
    });

    if (newRows.length > 0) {
      setBulkGrades(newRows);
      setShowPaste(false);
      setPasteText('');
    }
  };

  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const filteredGrades = React.useMemo(() => {
    return selectedSubject 
      ? grades.filter(g => g.subject === selectedSubject)
      : grades;
  }, [grades, selectedSubject]);

  // Calculate average grades per subject
  const chartData = React.useMemo(() => {
    const subjectMap: { [key: string]: { total: number, count: number } } = {};
    
    filteredGrades.forEach(g => {
      if (!subjectMap[g.subject]) {
        subjectMap[g.subject] = { total: 0, count: 0 };
      }
      subjectMap[g.subject].total += g.score;
      subjectMap[g.subject].count += 1;
    });
    return Object.keys(subjectMap).map(subject => ({
      subject,
      average: parseFloat((subjectMap[subject].total / subjectMap[subject].count).toFixed(1))
    }));
  }, [filteredGrades]);

  const distributionData = React.useMemo(() => {
    const subjectToFilter = selectedSubject || (chartData.length > 0 ? chartData[0].subject : '');
    if (!subjectToFilter) return [];

    const bins = [
      { range: '0-59', count: 0, color: '#ef4444' },
      { range: '60-69', count: 0, color: '#f59e0b' },
      { range: '70-79', count: 0, color: '#3b82f6' },
      { range: '80-89', count: 0, color: '#10b981' },
      { range: '90-100', count: 0, color: '#059669' },
    ];

    grades.filter(g => g.subject === subjectToFilter).forEach(g => {
      if (g.score < 60) bins[0].count++;
      else if (g.score < 70) bins[1].count++;
      else if (g.score < 80) bins[2].count++;
      else if (g.score < 90) bins[3].count++;
      else bins[4].count++;
    });

    return bins;
  }, [grades, selectedSubject, chartData]);

  const exportToCSV = () => {
    const headers = ['Student', 'Subject', 'Score', 'Date', 'Status'];
    const rows = filteredGrades.map(g => [
      `"${g.student_name}"`,
      `"${g.subject}"`,
      `${g.score}%`,
      g.date,
      g.score >= 80 ? 'Excellent' : g.score >= 50 ? 'Passed' : 'Failed'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `grades_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Recent Grades Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredGrades.map(g => [
      g.student_name,
      g.subject,
      `${g.score}%`,
      g.date,
      g.score >= 80 ? 'Excellent' : g.score >= 50 ? 'Passed' : 'Failed'
    ]);

    autoTable(doc, {
      head: [['Student', 'Subject', 'Score', 'Date', 'Status']],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`grades_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Academic Performance</h3>
            <p className="text-sm text-slate-500">Monitor and analyze student grades across subjects</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grades')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'grades' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Grades
            </button>
            <button 
              onClick={() => setViewMode('marklist')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'marklist' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Marklist
            </button>
            <button 
              onClick={() => setViewMode('overall')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'overall' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Overall
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'grades' && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {Array.from(new Set(grades.map(g => g.subject))).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          {(user.role === 'teacher' || user.role === 'admin') && viewMode === 'grades' && (
            <>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                title="Export PDF"
              >
                <Table className="w-4 h-4" />
                PDF
              </button>
              <button 
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Grade
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'marklist' ? (
        <MarklistView user={user} />
      ) : viewMode === 'overall' ? (
        <OverallPerformanceView students={students} grades={grades} />
      ) : (
        <>
      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card title="Bulk Grade Entry" subtitle="Enter multiple grades in an Excel-style grid">
              <div className="flex justify-end mb-4">
                <button 
                  onClick={() => setShowPaste(true)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste from Excel
                </button>
              </div>

              <AnimatePresence>
                {showPaste && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                  >
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                      <h4 className="text-lg font-bold text-slate-900 mb-2">Paste from Excel/CSV</h4>
                      <p className="text-sm text-slate-500 mb-4">
                        Paste rows from your spreadsheet. Columns should be: <br/>
                        <code className="bg-slate-100 px-1 rounded text-emerald-600 font-mono">Student Name, Subject, Score, Date, Component</code>
                      </p>
                      <textarea 
                        className="w-full h-48 p-4 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
                        placeholder="John Doe	Math	85	2024-02-24	Test"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <button 
                          onClick={handlePaste}
                          className="flex-1 bg-emerald-500 text-white py-2 rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                        >
                          Import Data
                        </button>
                        <button 
                          onClick={() => setShowPaste(false)}
                          className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="overflow-x-auto">
                <table className="w-full mb-4 border-collapse">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="pb-3 px-2">Student</th>
                      <th className="pb-3 px-2">Subject</th>
                      <th className="pb-3 px-2">Component</th>
                      <th className="pb-3 px-2">Score (0-100)</th>
                      <th className="pb-3 px-2">Date</th>
                      <th className="pb-3 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bulkGrades.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-1">
                          <select 
                            required
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            value={row.student_id}
                            onChange={(e) => updateBulkRow(idx, 'student_id', e.target.value)}
                          >
                            <option value="">Select Student</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-1">
                          <input 
                            type="text" 
                            placeholder="Subject" 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={row.subject}
                            onChange={(e) => updateBulkRow(idx, 'subject', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            value={row.component_id}
                            onChange={(e) => updateBulkRow(idx, 'component_id', e.target.value)}
                          >
                            <option value="">Select Component</option>
                            {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-1">
                          <input 
                            type="number" 
                            placeholder="Score" 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={row.score}
                            onChange={(e) => updateBulkRow(idx, 'score', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input 
                            type="date" 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={row.date}
                            onChange={(e) => updateBulkRow(idx, 'date', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addBulkRow();
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 px-1 text-center">
                          <button 
                            onClick={() => removeBulkRow(idx)}
                            disabled={bulkGrades.length === 1}
                            className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button 
                  onClick={addBulkRow}
                  className="flex items-center gap-2 text-emerald-600 font-bold text-sm hover:text-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Row
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowAdd(false)}
                    className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveBulkGrades}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSaving ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save All Grades
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Average Performance by Subject" className="lg:col-span-3 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="subject" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
                label={{ value: 'Subjects', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Average Score (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', fontWeight: 600, offset: 10 }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                itemStyle={{ color: '#0f172a', fontWeight: '600', fontSize: '14px' }}
                labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase' }}
                formatter={(value: number) => [`${value}%`, 'Average Score']}
              />
              <Bar dataKey="average" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.average >= 80 ? '#10b981' : entry.average >= 50 ? '#3b82f6' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Score Distribution" className="lg:col-span-3 h-96">
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="range" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={60}>
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-slate-400 mt-2">Frequency of scores within grade brackets</p>
        </Card>

        <Card title="Recent Grades" className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-4">Student</th>
                  <th className="pb-4">Subject</th>
                  <th className="pb-4">Type</th>
                  <th className="pb-4">Score</th>
                  <th className="pb-4">Date</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grades
                  .filter(g => !selectedSubject || g.subject === selectedSubject)
                  .map((grade) => (
                  <tr key={grade.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4">
                      <span className="text-sm font-medium text-slate-900">{grade.student_name}</span>
                    </td>
                    <td className="py-4">
                      <span className="text-sm text-slate-600">{grade.subject}</span>
                    </td>
                    <td className="py-4">
                      {editingGradeId === grade.id ? (
                        <select 
                          className="px-2 py-1 rounded border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          value={editFormData.component_id}
                          onChange={(e) => setEditFormData({ ...editFormData, component_id: e.target.value })}
                        >
                          <option value="">None</option>
                          {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 uppercase">{grade.component_name || 'General'}</span>
                      )}
                    </td>
                    <td className="py-4">
                      {editingGradeId === grade.id ? (
                        <input 
                          type="number"
                          className="w-20 px-2 py-1 rounded border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          value={editFormData.score}
                          onChange={(e) => setEditFormData({ ...editFormData, score: e.target.value })}
                        />
                      ) : (
                        <span className={`text-sm font-bold ${grade.score < 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {grade.score}%
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      {editingGradeId === grade.id ? (
                        <input 
                          type="date"
                          className="px-2 py-1 rounded border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          value={editFormData.date}
                          onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">{grade.date}</span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      {(user.role === 'teacher' || user.role === 'admin') && (
                        <div className="flex justify-end gap-2">
                          {editingGradeId === grade.id ? (
                            <>
                              <button 
                                onClick={() => handleSaveEdit(grade.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={handleCancelEdit}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleEditClick(grade)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Grade Progression Over Time" className="lg:col-span-3 min-h-[400px]">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl">
              <Users className="w-4 h-4 text-slate-400" />
              <select 
                className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                value={selectedProgressionStudentId}
                onChange={(e) => setSelectedProgressionStudentId(e.target.value)}
              >
                <option value="">Select Student to View Progression</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProgressionStudentId ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  {subjects.map((subject, index) => (
                    <Line 
                      key={subject}
                      type="monotone" 
                      dataKey={subject} 
                      stroke={`hsl(${index * 137.5 % 360}, 70%, 50%)`} 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <LineChartIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Select a student to visualize their academic journey</p>
            </div>
          )}
        </Card>

        <div className="lg:col-span-3">
          <OverallPerformanceView students={students} grades={grades} />
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function OverallPerformanceView({ students, grades }: { students: any[], grades: any[] }) {
  const studentAverages = React.useMemo(() => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id);
      
      // Group by subject first
      const subjectGrades: { [key: string]: number[] } = {};
      studentGrades.forEach(g => {
        if (!subjectGrades[g.subject]) subjectGrades[g.subject] = [];
        subjectGrades[g.subject].push(g.score);
      });

      // Calculate average for each subject
      const subjectAverages = Object.values(subjectGrades).map(scores => 
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      // Calculate average of subject averages
      const average = subjectAverages.length > 0 
        ? subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length 
        : 0;

      return {
        ...student,
        average: parseFloat(average.toFixed(1)),
        gradeCount: studentGrades.length,
        subjectCount: subjectAverages.length
      };
    }).sort((a, b) => b.average - a.average);
  }, [students, grades]);

  const topThree = studentAverages.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {topThree.map((student, idx) => (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="relative overflow-hidden border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    idx === 0 ? 'bg-amber-400 text-amber-900' : 
                    idx === 1 ? 'bg-slate-300 text-slate-800' : 
                    'bg-orange-400 text-orange-900'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{student.full_name}</h4>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      {idx === 0 ? 'Valedictorian' : idx === 1 ? 'Salutatorian' : 'Honor Roll'}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black">{student.average}%</p>
                    <p className="text-xs text-slate-400">Across {student.subjectCount} subjects</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-[10px] font-bold uppercase">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Top Performer
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card title="Overall Student Performance" subtitle="Average scores across all subjects (Average of Subject Averages)">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-4">Rank</th>
                <th className="pb-4">Student</th>
                <th className="pb-4">Subjects</th>
                <th className="pb-4">Total Entries</th>
                <th className="pb-4 text-right">Overall Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {studentAverages.map((student, idx) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm font-medium text-slate-900">{student.full_name}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-slate-600 font-medium">{student.subjectCount}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-slate-500">{student.gradeCount} entries</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={`text-sm font-bold ${student.average >= 80 ? 'text-emerald-600' : student.average >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                      {student.average}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MarklistView({ user }: { user: User }) {
  const [marklist, setMarklist] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/grades`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const grades = await res.json();
        const uniqueSubjects = Array.from(new Set(grades.map((g: any) => g.subject))) as string[];
        setSubjects(uniqueSubjects);
        if (uniqueSubjects.length > 0) setSelectedSubject(uniqueSubjects[0]);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    const fetchMarklist = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/marklist?subject=${selectedSubject}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) setMarklist(await res.json());
      setLoading(false);
    };
    fetchMarklist();
  }, [selectedSubject]);

  const exportMarklist = () => {
    if (!marklist.length) return;
    const doc = new jsPDF('landscape');
    doc.text(`Marklist: ${selectedSubject}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const components = Object.keys(marklist[0].averages);
    const headers = ['Rank', 'Student', ...components, 'Final Average'];
    
    const tableData = marklist.map(item => [
      `#${item.rank}`,
      item.student_name,
      ...components.map(c => `${item.averages[c]}%`),
      `${item.finalAverage}%`
    ]);

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`marklist_${selectedSubject}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card title="Subject Marklist">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <select 
              className="text-sm font-bold text-slate-700 outline-none bg-transparent"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {selectedSubject && (
            <button 
              onClick={exportMarklist}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Marklist
            </button>
          )}
          {loading && <div className="text-sm text-slate-400 animate-pulse">Calculating ranks...</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-4">Rank</th>
                <th className="pb-4">Student</th>
                {marklist[0] && Object.keys(marklist[0].averages).map(comp => (
                  <th key={comp} className="pb-4">{comp}</th>
                ))}
                <th className="pb-4 text-right">Final Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {marklist.map((item) => (
                <tr key={item.student_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      item.rank === 1 ? 'bg-amber-100 text-amber-600' : 
                      item.rank === 2 ? 'bg-slate-200 text-slate-600' : 
                      item.rank === 3 ? 'bg-orange-100 text-orange-600' : 'text-slate-400'
                    }`}>
                      {item.rank}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm font-medium text-slate-900">{item.student_name}</span>
                  </td>
                  {Object.keys(item.averages).map(comp => (
                    <td key={comp} className="py-4">
                      <span className="text-sm text-slate-600">{item.averages[comp].toFixed(1)}%</span>
                    </td>
                  ))}
                  <td className="py-4 text-right">
                    <span className={`text-sm font-bold ${item.finalAverage >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {item.finalAverage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PaymentsView({ user }: { user: User }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/payments/initialize`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        amount: 5000, 
        email: 'student@example.com', 
        first_name: user.full_name.split(' ')[0], 
        last_name: user.full_name.split(' ')[1] || '',
        description: 'Tuition Fee - Semester 2'
      }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      window.open(data.data.checkout_url, '_blank');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Financial Management</h3>
        {user.role === 'student' && (
          <button 
            onClick={handlePay}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            {loading ? 'Processing...' : 'Pay Tuition Fee'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Payment History" className="lg:col-span-2">
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Tuition Fee Payment</p>
                    <p className="text-xs text-slate-500">TX-123456789 • Feb 15, 2024</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">5,000 ETB</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Completed</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Fee Structure">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-600">Tuition Fee</span>
              <span className="text-sm font-bold text-slate-900">15,000 ETB</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-600">Library Fee</span>
              <span className="text-sm font-bold text-slate-900">500 ETB</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-600">Lab Fee</span>
              <span className="text-sm font-bold text-slate-900">1,200 ETB</span>
            </div>
            <div className="pt-4 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">Total Balance</span>
              <span className="text-lg font-bold text-red-600">16,700 ETB</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MessagingView({ user }: { user: User }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const [msgRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/messages`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (msgRes.ok) setMessages(await msgRes.json());
      if (userRes.ok) setUsers((await userRes.json()).filter((u: any) => u.id !== user.id));
    };
    fetchData();
  }, [user]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMsg) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ receiver_id: selectedUser.id, content: newMsg }),
    });
    if (res.ok) {
      setNewMsg('');
      const msgRes = await fetch(`${API_BASE}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
      setMessages(await msgRes.json());
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex gap-6">
      <Card title="Contacts" className="w-80 flex flex-col">
        <div className="space-y-2 overflow-y-auto flex-1">
          {users.map(u => (
            <button 
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${selectedUser?.id === u.id ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-slate-50'}`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                {u.full_name.charAt(0)}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{u.full_name}</p>
                <p className="text-xs text-slate-500 capitalize">{u.role}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  {selectedUser.full_name.charAt(0)}
                </div>
                <h4 className="font-bold text-slate-900">{selectedUser.full_name}</h4>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages
                .filter(m => m.sender_id === selectedUser.id || m.receiver_id === selectedUser.id)
                .map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${m.sender_id === user.id ? 'bg-emerald-500 text-white rounded-tr-none' : 'bg-slate-100 text-slate-900 rounded-tl-none'}`}>
                      {m.content}
                      <p className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
            <form onSubmit={sendMsg} className="p-4 border-t border-slate-100 flex gap-2">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
              />
              <button type="submit" className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a contact to start messaging</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function AdminView({ user }: { user: User }) {
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    full_name: '', 
    role: 'student', 
    email: '', 
    phone: '',
    grade_level: '',
    subject: ''
  });
  const [settings, setSettings] = useState<any>({ chapa_api_key: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [gradeComponents, setGradeComponents] = useState<any[]>([]);
  const [newComponentName, setNewComponentName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const [userRes, settingsRes, compRes] = await Promise.all([
        fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/grade-components`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (userRes.ok) setUsers(await userRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (compRes.ok) setGradeComponents(await compRes.json());
    };
    fetchData();
  }, []);

  const updateComponentWeight = async (id: number, weight: number) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE}/grade-components/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ weight }),
    });
    const compRes = await fetch(`${API_BASE}/grade-components`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (compRes.ok) setGradeComponents(await compRes.json());
  };

  const addComponent = async () => {
    if (!newComponentName) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE}/grade-components`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newComponentName, weight: 0 }),
    });
    setNewComponentName('');
    const compRes = await fetch(`${API_BASE}/grade-components`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (compRes.ok) setGradeComponents(await compRes.json());
  };

  const deleteComponent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this component?')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE}/grade-components/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const compRes = await fetch(`${API_BASE}/grade-components`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (compRes.ok) setGradeComponents(await compRes.json());
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      alert('Settings saved successfully');
    }
    setSavingSettings(false);
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setShowAdd(false);
      const userRes = await fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      setUsers(await userRes.json());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">User Management</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card title="Create New User">
              <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input 
                  type="text" 
                  placeholder="Username" 
                  required
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  required
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  required
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                />
                <select 
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none bg-white"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                  <option value="admin">Admin</option>
                </select>

                {newUser.role === 'student' && (
                  <input 
                    type="text" 
                    placeholder="Grade Level / Course" 
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                    value={newUser.grade_level}
                    onChange={(e) => setNewUser({ ...newUser, grade_level: e.target.value })}
                  />
                )}

                {newUser.role === 'teacher' && (
                  <input 
                    type="text" 
                    placeholder="Subject Taught" 
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                    value={newUser.subject}
                    onChange={(e) => setNewUser({ ...newUser, subject: e.target.value })}
                  />
                )}
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
                <input 
                  type="text" 
                  placeholder="Phone" 
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
                <div className="md:col-span-3 flex gap-2">
                  <button type="submit" className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-sm font-bold">Create User</button>
                  <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancel</button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card title="System Users">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-4">Name</th>
                <th className="pb-4">Username</th>
                <th className="pb-4">Role</th>
                <th className="pb-4">Details</th>
                <th className="pb-4">Contact</th>
                <th className="pb-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-4">
                    <span className="text-sm font-medium text-slate-900">{u.full_name}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-slate-500">{u.username}</span>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      u.role === 'admin' ? 'bg-red-100 text-red-600' : 
                      u.role === 'teacher' ? 'bg-blue-100 text-blue-600' : 
                      u.role === 'student' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-xs text-slate-600">
                      {u.role === 'student' ? u.grade_level : u.role === 'teacher' ? u.subject : '-'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="text-xs text-slate-500">
                      <p>{u.email || 'No email'}</p>
                      <p>{u.phone || 'No phone'}</p>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="School Configuration" subtitle="Manage external API integrations and school-wide settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Payment Configuration
            </h4>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Chapa Secret Key</label>
              <input 
                type="password" 
                placeholder="CHASECK_TEST-..." 
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                value={settings.chapa_api_key || ''}
                onChange={(e) => setSettings({ ...settings, chapa_api_key: e.target.value })}
              />
            </div>
            <button 
              onClick={saveSettings}
              disabled={savingSettings}
              className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Grading Configuration
            </h4>
            <p className="text-xs text-slate-500">Define how much each component contributes to the final grade (0.0 to 1.0).</p>
            <div className="space-y-3">
              {gradeComponents.map(comp => (
                <div key={comp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => deleteComponent(comp.id)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-medium text-slate-700">{comp.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      step="0.05"
                      min="0"
                      max="1"
                      className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      value={comp.weight}
                      onChange={(e) => updateComponentWeight(comp.id, parseFloat(e.target.value))}
                    />
                    <span className="text-xs font-bold text-slate-400">{(comp.weight * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2 p-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <input 
                  type="text" 
                  placeholder="New Component (e.g. Midterm)" 
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                />
                <button 
                  onClick={addComponent}
                  className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between items-center px-3">
                  <span className="text-xs font-bold text-slate-900 uppercase">Total Weight</span>
                  <span className={`text-sm font-bold ${Math.abs(gradeComponents.reduce((s, c) => s + c.weight, 0) - 1) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(gradeComponents.reduce((s, c) => s + c.weight, 0) * 100).toFixed(0)}%
                  </span>
                </div>
                {Math.abs(gradeComponents.reduce((s, c) => s + c.weight, 0) - 1) > 0.01 && (
                  <p className="text-[10px] text-red-500 mt-1 px-3">Total weight should ideally equal 100% (1.0)</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
