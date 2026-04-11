import { whapiService } from './services/whapi.service.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('--- TESTING INTERACTIVE LIST ---');
    const rows = [
        { id: "TEST_1", title: "Option 1", description: "Test description 1" },
        { id: "TEST_2", title: "Option 2", description: "Test description 2" }
    ];
    
    try {
        const result = await whapiService.sendList('2349056963124', 'This is a test list', 'Open Menu', rows);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Test Failed:', e.message);
    }
    process.exit(0);
}

run();
