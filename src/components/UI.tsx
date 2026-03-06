import React, { useState, useEffect } from 'react';
import {
  users,
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
  Sun,
  Moon,
  Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  full_name: string;
  email?: string;
  phone?: string;
}

// --- Components ---

export const Sidebar = ({ activeTab, setActiveTab, user, onLogout }: {
  activeTab: string,
  setActiveTab: (tab: string) => void,
  user: User | null,
  onLogout: () => void
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'attendance', label: 'Attendance', icon: Calendar, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'grades', label: 'Grades', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'student', 'parent'] },
    { id: 'fee-management', label: 'Fees', icon: Table, roles: ['admin'] },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare, roles: ['admin', 'teacher', 'student', 'parent'] },
    { id: 'admin', label: 'Admin Panel', icon: UserPlus, roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role || 'student'));

  return (
    <div className="w-64 bg-slate-950 text-white h-screen flex flex-col border-r border-slate-800 transition-colors duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-black text-emerald-500 flex items-center gap-3">
          <img src="/favicon.png" alt="Cortex Logo" className="w-8 h-8 rounded-lg" />
          Cortex
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id
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
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{user?.full_name || 'Guest'}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role || 'guest'}</p>
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
    className={`bg-card text-card-foreground rounded-3xl border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${className}`}
  >
    {(title || Icon) && (
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-bold tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </motion.div>
);

export const StatCard = ({ label, value, icon: Icon, trend, color = "emerald" }: any) => (
  <Card className="flex-1 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-1">{label}</p>
        <h4 className="text-3xl font-black tracking-tight">{value}</h4>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            <TrendingUp className={`w-3.5 h-3.5 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
            <span className="text-muted-foreground font-medium ml-1">last month</span>
          </div>
        )}
      </div>
      <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </Card>
);

export const ThemeToggle = ({ darkMode, setDarkMode }: { darkMode: boolean, setDarkMode: (d: boolean) => void }) => (
  <button
    onClick={() => setDarkMode(!darkMode)}
    className="p-2.5 bg-secondary text-secondary-foreground rounded-2xl hover:bg-secondary/80 transition-all border border-border"
  >
    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
);

export const Button = ({ children, variant = "primary", className = "", ...props }: any) => {
  const variants: any = {
    primary: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
    outline: "border-2 border-border hover:bg-secondary text-foreground",
    ghost: "hover:bg-secondary text-muted-foreground hover:text-foreground",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
  };

  return (
    <button
      className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const DataTable = ({ columns, data, actions, searchPlaceholder = "Search records..." }: {
  columns: { key: string, label: string, render?: (val: any, row: any, index: number) => React.ReactNode }[],
  data: any[],
  actions?: (row: any) => React.ReactNode,
  searchPlaceholder?: string
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = data.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const valA = a[key];
    const valB = b[key];
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortConfig?.key === col.key && (
                        <TrendingUp className={`w-3 h-3 ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                ))}
                {actions && <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout" initial={false}>
                {paginatedData.map((row, idx) => (
                  <motion.tr
                    key={row.id || idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4 text-sm whitespace-nowrap text-foreground">
                        {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {actions(row)}
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {paginatedData.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <p className="font-medium">No records found matching your search.</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            Showing {Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredData.length, currentPage * itemsPerPage)} of {filteredData.length} records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="px-3 py-1.5 h-auto text-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="px-3 py-1.5 h-auto text-xs"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
