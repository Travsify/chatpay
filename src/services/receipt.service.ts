import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { whapiService } from './whapi.service';

export class ReceiptService {
    /**
     * Generates a professional PDF receipt and sends it to the user via WhatsApp.
     */
    static async generateAndSend(phoneNumber: string, data: {
        type: string,
        amount: string,
        reference: string,
        recipient?: string,
        bank?: string,
        status: string,
        date: string
    }) {
        try {
            const fileName = `receipt_${data.reference}.pdf`;
            const filePath = path.join(process.cwd(), 'public', 'receipts', fileName);
            const doc = new PDFDocument({ margin: 50 });

            doc.pipe(fs.createWriteStream(filePath));

            // Header
            doc.fontSize(20).text('CHATPAY VAULT', { align: 'center' });
            doc.fontSize(10).text('Your Autonomous Banking Companion', { align: 'center' });
            doc.moveDown(2);

            // Divider
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e0e0e0').stroke();
            doc.moveDown(2);

            // Receipt Title
            doc.fontSize(16).fillColor('#25D366').text('Transaction Receipt', { align: 'center' });
            doc.moveDown(1);

            // Data Table Styling
            const drawRow = (label: string, value: string) => {
                doc.fillColor('#8696a0').fontSize(10).text(label, { continued: true });
                doc.fillColor('#000000').fontSize(11).text(`: ${value}`, { align: 'right' });
                doc.moveDown(0.5);
            };

            drawRow('Transaction Type', data.type);
            drawRow('Amount', data.amount);
            drawRow('Reference', data.reference);
            if (data.recipient) drawRow('Recipient', data.recipient);
            if (data.bank) drawRow('Bank', data.bank);
            drawRow('Status', data.status);
            drawRow('Date', data.date);

            doc.moveDown(2);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e0e0e0').stroke();
            doc.moveDown(2);

            // Footer
            doc.fillColor('#8696a0').fontSize(9).text('Encryption: AES-256 Secured', { align: 'center' });
            doc.text('This is an automated receipt. No signature required.', { align: 'center' });

            doc.end();

            // Wait for file to be written
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Send via Whapi (Assuming Render URL is set in env)
            const baseUrl = process.env.BASE_URL || 'https://chatpay-l4ej.onrender.com';
            const fileUrl = `${baseUrl}/receipts/${fileName}`;

            await whapiService.sendDocument(phoneNumber, fileUrl, fileName, `📄 Receipt: ${data.type} (Ref: ${data.reference})`);
            
            console.log(`[Receipt] Sent to ${phoneNumber}: ${fileUrl}`);
            return fileUrl;
        } catch (error) {
            console.error('[Receipt Service] Error:', error);
            throw error;
        }
    }
}
