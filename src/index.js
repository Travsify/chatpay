"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const webhook_controller_1 = require("./controllers/webhook.controller");
const admin_controller_1 = require("./controllers/admin.controller");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(body_parser_1.default.json());
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to ChatPay API' });
});
// Admin Routes (God Mode)
app.get('/api/admin/metrics', admin_controller_1.AdminController.getMetrics);
app.get('/api/admin/transactions', admin_controller_1.AdminController.getTransactions);
app.get('/api/admin/kyc-pending', admin_controller_1.AdminController.getPendingKYC);
app.post('/api/admin/verify-user', admin_controller_1.AdminController.verifyUser);
// Webhook route for Whapi.cloud
app.post('/webhook/whatsapp', webhook_controller_1.WebhookController.handleIncoming);
app.listen(PORT, () => {
    console.log(`ChatPay Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map