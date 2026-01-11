
// import express from 'express';
import express, { Express, Request, Response } from 'express';


import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import walletRoutes from './routes/wallet.routes';
import escrowRoutes from './routes/escrow.routes';
import trustiscoreRoutes from './routes/trustiscore.routes';
import portfolioRoutes from './routes/portfolio.routes';
import exchangeRoutes from './routes/exchange.routes';
import userRoutes from './routes/user.routes';
import transactionsRoutes from './routes/transactions.routes';
import disputeRoutes from './routes/dispute.routes';
import savingsRoutes from './routes/savings.routes';
import notificationRoutes from './routes/notification.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'TrustiChain Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

// Debug endpoint to test log writing (for debugging on Render)
app.get('/debug/test-write', (_req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const testLogPath = path.join(process.cwd(), 'debug.log');
    const testEntry = {
      location: 'index.ts:debug/test-write',
      message: 'Test log entry from debug endpoint',
      data: {
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        __dirname,
        testPath: testLogPath,
      },
      timestamp: Date.now(),
      sessionId: 'debug-test',
      runId: 'test-write',
    };
    
    try {
      fs.appendFileSync(testLogPath, JSON.stringify(testEntry) + '\n');
      res.status(200).json({
        success: true,
        message: 'Test log entry written successfully',
        logPath: testLogPath,
        testEntry,
        fileExists: fs.existsSync(testLogPath),
        canRead: (() => {
          try {
            fs.readFileSync(testLogPath, 'utf-8');
            return true;
          } catch {
            return false;
          }
        })(),
      });
    } catch (writeError) {
      res.status(500).json({
        success: false,
        message: 'Failed to write test log entry',
        error: writeError instanceof Error ? writeError.message : String(writeError),
        logPath: testLogPath,
        cwd: process.cwd(),
        __dirname,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error in test write endpoint',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Debug endpoint to retrieve logs (for debugging on Render)
app.get('/debug/logs', (_req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    // Try multiple possible log file locations (prioritize process.cwd() for Render)
    const possiblePaths = [
      path.join(process.cwd(), 'debug.log'), // Primary path for Render
      path.join(__dirname, 'debug.log'), // If running from dist/
      path.join(__dirname, '..', 'debug.log'), // Parent of dist/
      path.join(__dirname, '..', '.cursor', 'debug.log'),
      path.join(process.cwd(), '.cursor', 'debug.log'),
      path.join('/tmp', 'debug.log'),
    ];
    
    // Check which paths exist
    const pathStatus = possiblePaths.map(p => ({
      path: p,
      exists: fs.existsSync(p),
      readable: (() => {
        try {
          if (fs.existsSync(p)) {
            fs.accessSync(p, fs.constants.R_OK);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      })(),
    }));
    
    let logPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        logPath = p;
        break;
      }
    }
    
    if (logPath) {
      const logs = fs.readFileSync(logPath, 'utf-8');
      const logLines = logs.split('\n').filter((line: string) => line.trim());
      res.status(200).json({
        success: true,
        logPath,
        logCount: logLines.length,
        logs: logLines.map((line: string) => {
          try {
            return JSON.parse(line);
          } catch {
            return line;
          }
        }),
        pathStatus, // Include path checking info for debugging
        cwd: process.cwd(),
        __dirname,
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Log file not found',
        checkedPaths: possiblePaths,
        pathStatus,
        cwd: process.cwd(),
        __dirname,
        hint: 'Try calling /debug/test-write first to create the log file',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reading logs',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cwd: process.cwd(),
      __dirname,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/trustiscore', trustiscoreRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: Function) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TrustiChain Backend API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});


