import axios from 'axios';

export class FlutterwaveService {
    private secretKey: string;

    constructor() {
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    }

    async payBill(data: any) {
        try {
            const response = await axios.post(`https://api.flutterwave.com/v3/bills`, data, {
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error paying bill via Flutterwave:', error.response?.data || error.message);
            throw error;
        }
    }

    async getBillCategories() {
        try {
            const response = await axios.get(`https://api.flutterwave.com/v3/bill-categories`, {
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error fetching bill categories:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const flutterwaveService = new FlutterwaveService();
