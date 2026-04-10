import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { WebhookController } from './controllers/webhook.controller';
import { AdminController } from './controllers/admin.controller';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to ChatPay API' });
});

// Admin Routes (God Mode)
app.get('/api/admin/metrics', AdminController.getMetrics);
app.get('/api/admin/transactions', AdminController.getTransactions);
app.get('/api/admin/kyc-pending', AdminController.getPendingKYC);
app.post('/api/admin/verify-user', AdminController.verifyUser);

// Webhook route for Whapi.cloud
app.post('/webhook/whatsapp', WebhookController.handleIncoming);

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`ChatPay Server is running on port ${PORT}`);
});
