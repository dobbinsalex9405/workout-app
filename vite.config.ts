import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BUILD_NUMBER is set by the cloud build (GitHub run number) so the app can check for newer releases.
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(Number(process.env.BUILD_NUMBER ?? 0)) },
});
