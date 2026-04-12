import { generateRoadmap } from './src/services/roadmap.generator';
import path from 'path';

const run = async () => {
    const publicPath = path.join(__dirname, 'public', 'receipts', 'ChatPay_Strategic_Roadmap.pdf');
    try {
        await generateRoadmap(publicPath);
        console.log('✅ Strategic Roadmap generated at: /public/receipts/ChatPay_Strategic_Roadmap.pdf');
    } catch (e) {
        console.error('❌ Failed to generate roadmap:', e);
    }
};

run();
