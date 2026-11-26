import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // Only the Pages build emits the isolated, fictional onboarding prototype.
  const conversationPrototype = process.env.npm_lifecycle_event === 'build:pages';
  const originalChatTest = process.env.npm_lifecycle_event === 'build:chat-test';
  if(originalChatTest){
    const api=new URL(process.env.VITE_API_URL || 'http://127.0.0.1:55440');
    if(!['127.0.0.1','localhost'].includes(api.hostname) || process.env.VITE_APP_MODE==='demo')throw new Error('Original-chat test build requires a loopback API and non-demo mode.');
  }
  return {
    define: { __CONVERSATION_PROTOTYPE__: JSON.stringify(conversationPrototype),__CHAT_ORIGINAL_TEST__:JSON.stringify(originalChatTest) },
    build: conversationPrototype ? {
      rollupOptions: { input: {
        main: path.resolve(projectRoot, 'index.html'),
        conversation: path.resolve(projectRoot, 'conversation-prototype.html'),
      } },
    } : undefined,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
