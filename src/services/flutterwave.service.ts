import axios from 'axios';
import prisma from '../utils/prisma';

export class FlutterwaveService {
    private static async getSecretKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.flutterwaveSecret || process.env.FLUTTERWAVE_SECRET_KEY;
    }

    /**
     * Fetch bill categories from Flutterwave (Airtime, Data, Power, Cable, etc.)
     */
    static async getBillCategories(airtime: 1 | 0 = 0, billerCode?: string) {
        try {
            const secretKey = await this.getSecretKey();
            if (!secretKey) throw new Error('Flutterwave Secret Key not configured');

            const params = new URLSearchParams();
            if (airtime) params.append('airtime', '1');
            if (billerCode) params.append('biller_code', billerCode);

            const response = await axios.get(`https://api.flutterwave.com/v3/bill-categories?${params}`, {
                headers: {
                    'Authorization': `Bearer ${secretKey}`
                }
            });

            return response.data;
        } catch (error: any) {
            console.error('[FLUTTERWAVE ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch bill categories');
        }
    }

    /**
     * Pay a bill (Airtime, Electricity, DSTV, etc.)
     * @param amount Amount to pay (NGN)
     * @param customer ID/Phone number of the customer to fund
     * @param billerName Biller item name mapping (e.g. MTN, DSTV)
     * @param reference Unique transaction reference
     */
    static async payBill(amount: number, customer: string, billerName: string, reference: string) {
        try {
            const secretKey = await this.getSecretKey();
            if (!secretKey) throw new Error('Flutterwave Secret Key not configured');

            const response = await axios.post('https://api.flutterwave.com/v3/bills', {
                country: 'NG',
                customer: customer,
                amount: amount,
                recurrence: 'ONCE',
                type: billerName, // The specific flutterwave biller type string
                reference: reference
            }, {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data; // Includes .data.status "successful"
        } catch (error: any) {
            console.error('[FLUTTERWAVE BILL ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Bill payment failed');
        }
    }
}
