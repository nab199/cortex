import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppBackup from './App_backup.tsx';
console.log('main.tsx: AppBackup imported successfully. typeof AppBackup:', typeof AppBackup);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <AppBackup />
  </StrictMode>
);
