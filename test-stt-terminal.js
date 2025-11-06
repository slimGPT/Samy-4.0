/**
 * Terminal STT Test
 * Records audio from microphone and transcribes using ElevenLabs STT
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load dependencies from apps/api/node_modules (monorepo setup)
let axios, FormData;

// Helper to load axios correctly
function loadAxios() {
  // Try root first
  try {
    const axiosModule = require('axios');
    if (axiosModule && typeof axiosModule.post === 'function') {
      return axiosModule;
    }
    if (axiosModule && axiosModule.default && typeof axiosModule.default.post === 'function') {
      return axiosModule.default;
    }
  } catch (e) {
    // Continue to try from apps/api/node_modules
  }
  
  // Try from apps/api/node_modules
  try {
    const apiModulesPath = path.join(__dirname, 'apps', 'api', 'node_modules');
    const axiosPath = require.resolve('axios', { paths: [apiModulesPath] });
    const axiosModule = require(axiosPath);
    
    if (axiosModule && typeof axiosModule.post === 'function') {
      return axiosModule;
    }
    if (axiosModule && axiosModule.default && typeof axiosModule.default.post === 'function') {
      return axiosModule.default;
    }
    
    // Last resort: try direct path
    const directPath = path.join(apiModulesPath, 'axios', 'index.js');
    if (fs.existsSync(directPath)) {
      const axiosModule = require(directPath);
      return axiosModule.default || axiosModule;
    }
  } catch (e) {
    // Will throw error below
  }
  
  throw new Error('Could not load axios');
}

// Load axios
try {
  axios = loadAxios();
  if (!axios || typeof axios.post !== 'function') {
    throw new Error('Axios loaded but post method not found');
  }
} catch (e) {
  console.error('❌ Failed to load axios!');
  console.error('   Error:', e.message);
  console.error('   Install with: npm install axios');
  process.exit(1);
}

// Load FormData
try {
  FormData = require('form-data');
} catch (e) {
  try {
    const apiModulesPath = path.join(__dirname, 'apps', 'api', 'node_modules');
    FormData = require(path.join(apiModulesPath, 'form-data'));
  } catch (e2) {
    console.error('❌ Failed to load form-data!');
    console.error('   Error:', e2.message);
    console.error('   Install with: npm install form-data');
    process.exit(1);
  }
}

// Load dotenv
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  try {
    const apiModulesPath = path.join(__dirname, 'apps', 'api', 'node_modules');
    require(path.join(apiModulesPath, 'dotenv')).config({ 
      path: path.join(__dirname, '.env') 
    });
  } catch (e2) {
    console.warn('⚠️ dotenv not loaded');
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function transcribeWithElevenLabs(audioFilePath) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }
  
  const stats = fs.statSync(audioFilePath);
  if (stats.size === 0) {
    throw new Error('Audio file is empty');
  }
  
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model_id', 'scribe_v1');
  
  console.log('📤 Sending to ElevenLabs STT API...');
  console.log(`   File: ${audioFilePath} (${stats.size} bytes)`);
  console.log(`   API Key: ${process.env.ELEVENLABS_API_KEY.substring(0, 15)}...`);
  
  const response = await axios.post(
    'https://api.elevenlabs.io/v1/speech-to-text',
    formData,
    {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        ...formData.getHeaders(),
      },
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );
  
  console.log(`📥 Response: ${response.status}`);
  console.log(`   Data:`, JSON.stringify(response.data, null, 2));
  
  if (response.status !== 200) {
    throw new Error(`ElevenLabs returned ${response.status}: ${JSON.stringify(response.data)}`);
  }
  
  const transcription = response.data?.text || response.data?.transcript || response.data?.transcription || '';
  
  if (!transcription || transcription.trim() === '') {
    throw new Error('Empty transcription from ElevenLabs');
  }
  
  return transcription.trim();
}

async function getAvailableAudioDevices() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('ffmpeg -list_devices true -f dshow -i dummy', (error, stdout, stderr) => {
      const devices = [];
      const output = stderr || stdout;
      const lines = output.split('\n');
      
      // Look for lines with format: [dshow @ ...] "Device Name" (audio)
      for (const line of lines) {
        // Match: [dshow @ ...] "Device Name" (audio)
        const match = line.match(/\[dshow[^\]]+\]\s+"([^"]+)"\s+\(audio\)/);
        if (match && match[1]) {
          const deviceName = match[1].trim();
          if (deviceName && deviceName.length > 1) {
            devices.push(deviceName);
          }
        }
      }
      
      // Remove duplicates
      const uniqueDevices = [...new Set(devices)];
      resolve(uniqueDevices);
    });
  });
}

async function selectAudioDevice() {
  const devices = await getAvailableAudioDevices();
  
  if (devices.length === 0) {
    console.error('\n❌ No audio devices found!');
    console.log('\n📝 Please record audio on your phone or computer, then run:');
    console.log(`   node test-stt-terminal.js <path-to-file>\n`);
    return null;
  }
  
  console.log(`\n📋 Found ${devices.length} audio device(s):\n`);
  devices.forEach((device, index) => {
    console.log(`   ${index + 1}. "${device}"`);
  });
  console.log('');
  
  return new Promise((resolve) => {
    rl.question(`Select device (1-${devices.length}) or press Enter for first device: `, (answer) => {
      const choice = parseInt(answer);
      
      if (!answer || isNaN(choice)) {
        // Use first device by default
        console.log(`✅ Using first device: "${devices[0]}"\n`);
        resolve(devices[0]);
      } else if (choice >= 1 && choice <= devices.length) {
        console.log(`✅ Selected: "${devices[choice - 1]}"\n`);
        resolve(devices[choice - 1]);
      } else {
        console.log(`⚠️  Invalid choice. Using first device: "${devices[0]}"\n`);
        resolve(devices[0]);
      }
    });
  });
}

async function recordAudioWithFFmpeg(duration = 5) {
  return new Promise(async (resolve) => {
    const { exec } = require('child_process');
    const tempDir = path.join(__dirname, 'temp', 'recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const outputFile = path.join(tempDir, `recording-${Date.now()}.wav`);
    
    // Let user select device
    const deviceName = await selectAudioDevice();
    
    if (!deviceName) {
      resolve(null);
      return;
    }
    
    console.log(`🎤 Recording audio for ${duration} seconds...`);
    console.log(`   Using device: "${deviceName}"`);
    console.log('   Speak now!\n');
    
    // Use ffmpeg to record from microphone
    // -f dshow: Windows DirectShow
    // -i audio="<device>": Use selected microphone device
    // -t <duration>: Record for specified seconds
    // -acodec pcm_s16le: PCM 16-bit little-endian (WAV format)
    // -ar 16000: Sample rate 16kHz
    const ffmpegCommand = `ffmpeg -f dshow -i audio="${deviceName}" -t ${duration} -acodec pcm_s16le -ar 16000 "${outputFile}" -y -hide_banner -loglevel error`;
    
    console.log('📹 Starting recording...\n');
    
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error && error.code !== 0) {
        console.error('❌ FFmpeg recording failed:', error.message);
        if (stderr) {
          console.error('   Error details:', stderr.substring(0, 300));
        }
        console.log('\n📝 Alternative: Record audio on your phone or computer, then run:');
        console.log(`   node test-stt-terminal.js <path-to-file>\n`);
        resolve(null);
      } else {
        // Wait a moment for file to be written
        setTimeout(() => {
          if (fs.existsSync(outputFile)) {
            const stats = fs.statSync(outputFile);
            if (stats.size > 0) {
              console.log(`✅ Recording saved: ${outputFile} (${stats.size} bytes)\n`);
              resolve(outputFile);
            } else {
              console.error('❌ Recording file is empty');
              resolve(null);
            }
          } else {
            console.error('❌ Recording file not created');
            resolve(null);
          }
        }, 500);
      }
    });
  });
}

async function recordAndTranscribe() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🎤 TERMINAL STT TEST');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Check for audio file path as argument
  const audioFilePath = process.argv[2];
  
  if (audioFilePath) {
    // User provided audio file path
    if (!fs.existsSync(audioFilePath)) {
      console.error(`❌ Audio file not found: ${audioFilePath}`);
      process.exit(1);
    }
    
    console.log(`📁 Using provided audio file: ${audioFilePath}\n`);
    try {
      const transcription = await transcribeWithElevenLabs(audioFilePath);
      console.log('\n✅ TRANSCRIPTION:');
      console.log('═══════════════════════════════════════════════════');
      console.log(`"${transcription}"`);
      console.log('═══════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('\n❌ Transcription failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      process.exit(1);
    }
  } else {
    // Interactive mode - ask to record or provide file
    console.log('Options:');
    console.log('1. Record audio now (using microphone)');
    console.log('2. Provide audio file path\n');
    
    rl.question('Record audio now? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        // Record audio using ffmpeg
        rl.question('How many seconds to record? (default: 5): ', async (durationInput) => {
          const duration = parseInt(durationInput) || 5;
          
          const recordedFile = await recordAudioWithFFmpeg(duration);
          
          if (recordedFile) {
            console.log('⏱️ Transcribing...\n');
            try {
              const transcription = await transcribeWithElevenLabs(recordedFile);
              console.log('\n✅ TRANSCRIPTION:');
              console.log('═══════════════════════════════════════════════════');
              console.log(`"${transcription}"`);
              console.log('═══════════════════════════════════════════════════\n');
              
              // Clean up
              if (fs.existsSync(recordedFile)) {
                fs.unlinkSync(recordedFile);
              }
            } catch (error) {
              console.error('\n❌ Transcription failed:', error.message);
              if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
              }
            }
          }
          rl.close();
        });
      } else {
        rl.question('Enter the path to your audio file: ', async (filePath) => {
          if (fs.existsSync(filePath)) {
            try {
              const transcription = await transcribeWithElevenLabs(filePath);
              console.log('\n✅ TRANSCRIPTION:');
              console.log('═══════════════════════════════════════════════════');
              console.log(`"${transcription}"`);
              console.log('═══════════════════════════════════════════════════\n');
            } catch (error) {
              console.error('\n❌ Transcription failed:', error.message);
              if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
              }
            }
          } else {
            console.error(`❌ File not found: ${filePath}`);
          }
          rl.close();
        });
      }
    });
  }
}

// Run
recordAndTranscribe().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
});

