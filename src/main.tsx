import { createRoot } from 'react-dom/client';
import App from './App';
import { db, initDB } from './db';
import './styles.css';

// Dev only: lets you poke at the database from the browser console (window.db).
if (import.meta.env.DEV) (window as unknown as { db: typeof db }).db = db;

initDB().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
