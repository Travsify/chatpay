export class EmailService {
    static async sendReceipt(to: string, data: { type: string, amount: number, reference: string, balance: number, recipient?: string }) {
        if (!to) return;
        
        console.log(`[EmailService] Sending receipt to ${to}...`);
        const body = `
            🧾 ChatPay Transaction Receipt
            ------------------------------
            Type: ${data.type}
            Amount: ₦${data.amount.toLocaleString()}
            Ref: ${data.reference}
            New Balance: ₦${data.balance.toLocaleString()}
            ${data.recipient ? `Recipient: ${data.recipient}` : ''}
            
            Thank you for using ChatPay.
        `;
        
        // In a real production environment, integrate with SendGrid, Mailgun or Nodemailer here.
        // For this demo, we log the outbound "email" to the console.
        console.log('--- EMAIL CONTENT ---');
        console.log(body);
        console.log('---------------------');
        
        return true;
    }
}
