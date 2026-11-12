import { app } from './app.js';
import { startSendingWorker } from './services/senderWorker.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 WA Backend server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  startSendingWorker();
});
