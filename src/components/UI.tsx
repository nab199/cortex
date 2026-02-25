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
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  full_name: string;
}

// --- Components ---

export const Sidebar = ({ activeTab, setActiveTab, user, onLogout }: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void, 
  user: User,
  onLogout: () => void 
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'attendance', label: 'Attendance', icon: Calendar, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'grades', label: 'Grades', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'student', 'parent'] },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'admin', label: 'Admin Panel', icon: UserPlus, roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
          <BookOpen className="w-8 h-8" />
          EduFinance
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
            {activeTab === item.id && (
              <motion.div layoutId="active-pill" className="ml-auto">
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
            {user.full_name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export const Card = ({ children, title, subtitle, icon: Icon, className = "" }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
  >
    {(title || Icon) && (
      <div className="px-6 py-4 border-bottom border-slate-100 flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {Icon && <Icon className="w-5 h-5 text-slate-400" />}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </motion.div>
);

export const StatCard = ({ label, value, icon: Icon, trend, color = "emerald" }: any) => (
  <Card className="flex-1">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
        <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}% from last month
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </Card>
);
