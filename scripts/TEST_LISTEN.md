# Testing the /listen Endpoint

This document describes how to test the `/listen` audio transcription endpoint independently.

## Overview

The `/listen` endpoint accepts audio files and returns transcribed text using OpenAI's transcription API.

**Endpoint:** `POST /listen`

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Field name: `file`
- Supported formats: webm, mp3, wav, m4a, ogg
- Max file size: 25MB

**Response (Success):**
```json
{
  "text": "transcribed text here"
}
```

**Response (Error):**
```json
{
  "error": "error message",
  "message": "detailed message",
  "details": { ... },
  "openaiError": { ... }
}
```

## Test Scripts

### Bash Script (Linux/Mac/WSL)

```bash
# Make executable (first time only)
chmod +x scripts/test-listen.sh

# Run test
./scripts/test-listen.sh path/to/audio.webm

# With custom API URL
API_URL=http://localhost:3001 ./scripts/test-listen.sh recording.mp3
```

### PowerShell Script (Windows)

```powershell
# Run test
.\scripts\test-listen.ps1 -AudioFile path\to\audio.webm

# With custom API URL
.\scripts\test-listen.ps1 -AudioFile recording.mp3 -ApiUrl http://localhost:3001
```

## Manual cURL Testing

### Basic Test

```bash
curl -X POST \
  -F "file=@recording.webm" \
  http://localhost:3001/listen
```

### With Verbose Output

```bash
curl -v -X POST \
  -F "file=@recording.webm" \
  http://localhost:3001/listen
```

### Windows (PowerShell) - Using Invoke-WebRequest

```powershell
$boundary = [System.Guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes("recording.webm")
$LF = "`r`n"
$bodyLines = (
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"recording.webm`"",
    "Content-Type: audio/webm$LF",
    [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
    "--$boundary--$LF"
) -join $LF

Invoke-WebRequest -Uri "http://localhost:3001/listen" `
    -Method POST `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body $bodyLines
```

## Testing Workflow

1. **Start the API server:**
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Prepare a test audio file:**
   - Record a short audio clip (webm, mp3, wav, etc.)
   - Or use an existing audio file
   - Keep it under 25MB

3. **Run the test:**
   ```bash
   # From project root
   ./scripts/test-listen.sh path/to/audio.webm
   ```

4. **Check the output:**
   - ✅ Success: Should return `{ "text": "..." }`
   - ❌ Error: Check error details and server logs

## Troubleshooting

### "Connection refused"
- Make sure the API server is running: `npm run dev` in `apps/api`
- Check the API URL (default: http://localhost:3001)

### "OPENAI_API_KEY is not configured"
- Set your OpenAI API key in `apps/api/.env`:
  ```
  OPENAI_API_KEY=sk-...
  ```

### "Invalid audio file type"
- Ensure the file is one of: webm, mp3, wav, m4a, ogg
- Check file integrity (not corrupted)

### "Failed to transcribe audio"
- Check server logs for detailed error
- Verify OpenAI API key is valid
- Ensure audio file has actual audio content (not silent)

## Integration with Client

The client sends audio using the same format:

```typescript
const formData = new FormData();
formData.append('file', audioBlob, 'recording.webm');

const response = await fetch(`${API_URL}/listen`, {
  method: 'POST',
  body: formData,
});

const { text } = await response.json();
console.log('Transcribed:', text);
```

## Model Information

The endpoint uses:
1. **Primary:** `gpt-4o-mini-transcribe` (faster, cheaper)
2. **Fallback:** `whisper-1` (reliable standard)

The server automatically falls back to `whisper-1` if the primary model fails.

