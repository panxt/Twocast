import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import lamejs from 'lamejs';
import { AudioResult, ScriptItem } from './types';
import { parseAudioBuffer } from '@/utils/ffprobe-util';

async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
   return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
         channels,
         sampleRate: rate,
         bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
   });
}

export async function genWhole(items: ScriptItem[], voiceId_1: string, voiceId_2: string, solo = false): Promise<AudioResult> {
   const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
   const script = items.map(item => `${item.role}: ${item.text}`).join('\n');

   const prompt = solo
      ? `TTS the following narration by a single host, with natural conversational tone:\n         ${items.map(item => item.text).join('\n')}`
      : `TTS the following conversation between host and guest, with natural tone:
         ${script}`;

   const response = await ai.models.generateContent({
      model: "gemini-2.5-pro-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
         responseModalities: ['AUDIO'],
         speechConfig: solo ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId_1 } } } : {
            multiSpeakerVoiceConfig: {
               speakerVoiceConfigs: [
                  {
                     speaker: 'host',
                     voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceId_1 }
                     }
                  },
                  {
                     speaker: 'guest',
                     voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceId_2 }
                     }
                  }
               ]
            }
         }
      }
   });

   const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
   if (!data) {
      throw new Error('No audio data found');
   }
   const audioBuffer = Buffer.from(data, 'base64');

   // 计算时长
   const duration = await parseAudioBuffer(audioBuffer);

   return {audio: audioBuffer, format: 'wav', duration: duration.duration};
}

async function convertToMp3(audioBuffer: Buffer): Promise<Buffer> {
   // Create MP3 encoder
   const mp3encoder = new lamejs.Mp3Encoder(1, 24000, 128);
   const mp3Data: Int8Array[] = [];

   // Convert buffer to Int16Array
   const samples = new Int16Array(audioBuffer.buffer);
   
   // Process samples in chunks
   const sampleBlockSize = 1152; // Must be multiple of 576
   for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.slice(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
         mp3Data.push(mp3buf);
      }
   }

   // Add end of stream
   const end = mp3encoder.flush();
   if (end.length > 0) {
      mp3Data.push(end);
   }

   // Combine all chunks into single buffer
   return Buffer.concat(mp3Data.map(buf => new Uint8Array(buf)));
}