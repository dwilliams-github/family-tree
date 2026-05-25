import './config.js'; // validate env vars at startup
import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
