import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class VoiceService {
    /**
     * Transcribe a voice note URL to text
     */
    static async transcribe(url: string): Promise<string> {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const tempFile = path.join(process.cwd(), 'temp_audio.ogg');
            fs.writeFileSync(tempFile, Buffer.from(response.data));

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFile),
                model: "whisper-1",
            });

            fs.unlinkSync(tempFile);
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
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy", // "shimmer" or "alloy" are good for clarity
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
