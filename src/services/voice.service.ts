import OpenAI from 'openai';
import fs from 'fs';
import prisma from '../utils/prisma.js';

export class VoiceService {
    private static async getOpenAI(): Promise<OpenAI | null> {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            const key = config?.openaiKey || process.env.OPENAI_API_KEY;
            
            if (key && key !== 'your_openai_api_key_here' && key !== '') {
                return new OpenAI({ apiKey: key });
            }
        } catch (e) {
            console.error('[Voice] Failed to fetch key:', e);
        }
        return null;
    }

    /**
     * Transcribe a local voice note file to text
     */
    static async transcribe(filePath: string): Promise<string> {
        try {
            const openai = await this.getOpenAI();
            if (!openai) {
                console.error('[Voice] OpenAI API Key missing for transcription');
                return '';
            }

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: "whisper-1",
            });

            return transcription.text;
        } catch (error) {
            console.error('Transcription failed:', error);
            return '';
        }
    }

    /**
     * Convert text to a Voice Note (ogg) buffer
     */
    static async textToSpeech(text: string): Promise<Buffer> {
        try {
            const openai = await this.getOpenAI();
            if (!openai) throw new Error('OpenAI API Key missing for TTS');

            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: text,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            return buffer;
        } catch (error) {
            console.error('TTS failed:', error);
            throw error;
        }
    }
}
