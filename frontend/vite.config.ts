import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-state': ['zustand', 'axios'],
          'crm': [
            './src/pages/dashboard/DashboardPage',
            './src/pages/customers/CustomersPage',
            './src/pages/workorders/WorkOrdersPage',
            './src/pages/quotes/QuotesPage',
            './src/pages/financial/FinancialPage',
            './src/pages/inventory/InventoryPage',
            './src/pages/imports/ImportsPage',
            './src/pages/products/ProductsPage',
            './src/pages/suppliers/SuppliersPage',
          ],
          'web': [
            './src/web/WebPages',
            './src/web/Layout',
          ],
        },
      },
    },
  },
})
