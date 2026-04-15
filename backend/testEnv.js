import dotenv from 'dotenv';

dotenv.config();
console.log('Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
console.log('Value starts with:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) : 'None');
