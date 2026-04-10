"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flutterwaveService = exports.FlutterwaveService = void 0;
const axios_1 = __importDefault(require("axios"));
class FlutterwaveService {
    secretKey;
    constructor() {
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    }
    async payBill(data) {
        try {
            const response = await axios_1.default.post(`https://api.flutterwave.com/v3/bills`, data, {
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error paying bill via Flutterwave:', error.response?.data || error.message);
            throw error;
        }
    }
    async getBillCategories() {
        try {
            const response = await axios_1.default.get(`https://api.flutterwave.com/v3/bill-categories`, {
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching bill categories:', error.response?.data || error.message);
            throw error;
        }
    }
}
exports.FlutterwaveService = FlutterwaveService;
exports.flutterwaveService = new FlutterwaveService();
//# sourceMappingURL=flutterwave.service.js.map