import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/faintlight-web3-tools/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          aptos: ['@aptos-labs/ts-sdk', '@aptos-labs/wallet-adapter-react', '@aptos-labs/wallet-adapter-core']
        }
      }
    }
  }
});
