import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function visualizerApiPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const { code } = JSON.parse(body || '{}');
          if (typeof code !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                diagnostics: [
                  {
                    severity: 'error',
                    code: 'request.invalid',
                    message: 'Missing or invalid "code" parameter in request body.',
                    provenance: 'backend-inferred',
                  },
                ],
              })
            );
            return;
          }

          const { traceCppCode } = await import(
            '../packages/instrumentation-backend/src/index.ts'
          );
          const result = await traceCppCode(code);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              error: err.message || 'Internal server error',
              diagnostics: [
                {
                  severity: 'error',
                  code: 'server.error',
                  message: err.message || 'Internal server error',
                  provenance: 'backend-inferred',
                },
              ],
            })
          );
        }
      });
    } else {
      res.statusCode = 405;
      res.end('Method Not Allowed');
    }
  };

  return {
    name: 'visualizer-api',
    configureServer(server) {
      server.middlewares.use('/api/visualize', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/visualize', handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), visualizerApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@visualized-gdb/execution-trace': path.resolve(
        __dirname,
        '../packages/execution-trace/src/index.ts'
      ),
      '@visualized-gdb/equation-trace': path.resolve(
        __dirname,
        '../packages/equation-trace/src/index.ts'
      ),
      '@visualized-gdb/instrumentation-backend': path.resolve(
        __dirname,
        '../packages/instrumentation-backend/src/index.ts'
      ),
    },
  },
  server: {
    // 5173 is taken by the Lecture Lens server, which also answers /api/llm
    port: 5174,
  },
});
