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
console.log("lucide-react imported");

import SendSmsButton from './components/SendSmsButton';
console.log("SendSmsButton imported");

import { motion, AnimatePresence } from 'framer-motion';
console.log("framer-motion imported");

import { Sidebar, Card, StatCard, User, ThemeToggle, Button, DataTable } from './components/UI';
console.log("UI imported");

import { offlineService } from './services/offlineService';
console.log("offlineService imported");

import { InvoicingService } from './services/InvoicingService';
console.log("InvoicingService imported");

import jsPDF from 'jspdf';
console.log("jspdf imported");

import autoTable from 'jspdf-autotable';
console.log("jspdf-autotable imported");

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
console.log("recharts imported");

export default function TestImports() {
    console.log("TestImports component executed");
    return <div>Imports tested successfully!</div>;
}
