import { whapiService } from '../src/services/whapi.service';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        await whapiService.sendMessage('2349056963124', '🛠️ ChatPay System Update: Your bot is being restored. Please try saying "Hi" in 30 seconds.');
        console.log('Update sent');
    } catch(e) {
        console.error('Failed:', e.message);
    }
    process.exit(0);
}
run();
