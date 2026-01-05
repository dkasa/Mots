import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'

export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    }),
    {
      name: 'version-generator',
      buildStart() {
        if (process.env.NODE_ENV === 'production') {
          try {
            // 在构建开始时生成版本信息
            import('./scripts/version-generator.js');
          } catch (error) {
            console.warn('版本生成器执行失败:', error instanceof Error ? error.message : String(error));
          }
        }
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    open: false,
  },
  publicDir: 'public',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})