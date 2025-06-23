import fs from 'fs';
import OpenAI from 'openai';

const openai = new OpenAI();

const stream = await openai.audio.transcriptions.create({
    file: fs.createReadStream('/path/to/file/speech.mp3'),
    model: 'gpt-4o-mini-transcribe',
    response_format: 'text',
    stream: true,
});

for await (const event of stream) {
    console.log(event);
}