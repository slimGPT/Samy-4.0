# PowerShell version of test-listen.sh for Windows users
# Usage: .\test-listen.ps1 [path_to_audio_file]

param(
    [Parameter(Mandatory=$false)]
    [string]$AudioFile = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "http://localhost:3001"
)

Write-Host "🧪 Testing /listen endpoint" -ForegroundColor Cyan
Write-Host "================================"
Write-Host "API URL: $ApiUrl/listen"
Write-Host ""

# Check if audio file is provided
if ([string]::IsNullOrEmpty($AudioFile)) {
    Write-Host "❌ Error: No audio file provided" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage: .\test-listen.ps1 -AudioFile <path_to_audio_file>"
    Write-Host ""
    Write-Host "Example:"
    Write-Host "  .\test-listen.ps1 -AudioFile recording.webm"
    Write-Host "  .\test-listen.ps1 -AudioFile test-audio.mp3"
    Write-Host ""
    Write-Host "Supported formats: webm, mp3, wav, m4a, ogg"
    exit 1
}

# Check if file exists
if (-not (Test-Path $AudioFile)) {
    Write-Host "❌ Error: Audio file not found: $AudioFile" -ForegroundColor Red
    exit 1
}

# Get file info
$FileInfo = Get-Item $AudioFile
Write-Host "📁 File: $($FileInfo.Name)"
Write-Host "📊 Size: $($FileInfo.Length) bytes"
Write-Host ""

# Test the endpoint
Write-Host "🚀 Sending request..."
Write-Host ""

try {
    # Prepare multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileBytes = [System.IO.File]::ReadAllBytes($AudioFile)
    
    # Build multipart form data
    $LF = "`r`n"
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($FileInfo.Name)`"",
        "Content-Type: application/octet-stream$LF",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
        "--$boundary--$LF"
    ) -join $LF

    # Make request
    $response = Invoke-WebRequest -Uri "$ApiUrl/listen" `
        -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyLines `
        -UseBasicParsing

    $statusCode = $response.StatusCode
    $body = $response.Content
    
    Write-Host "📥 Response (HTTP $statusCode):" -ForegroundColor Green
    
    # Try to format JSON
    try {
        $json = $body | ConvertFrom-Json
        $json | ConvertTo-Json -Depth 10
        Write-Host ""
        
        if ($json.text) {
            Write-Host "✅ SUCCESS: Received transcription" -ForegroundColor Green
            Write-Host "📝 Transcribed text: `"$($json.text)`"" -ForegroundColor Cyan
        } else {
            Write-Host "⚠️  WARNING: Response is 200 but missing 'text' field" -ForegroundColor Yellow
            Write-Host "Expected format: { `"text`": `"...`" }"
        }
    } catch {
        Write-Host $body
        Write-Host ""
        Write-Host "⚠️  Could not parse JSON response" -ForegroundColor Yellow
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "❌ FAILED: HTTP $statusCode" -ForegroundColor Red
    
    try {
        $errorBody = $_.ErrorDetails.Message
        Write-Host "Error details:"
        $errorJson = $errorBody | ConvertFrom-Json
        $errorJson | ConvertTo-Json -Depth 10
    } catch {
        Write-Host $_.Exception.Message
    }
    
    Write-Host ""
    Write-Host "Common issues:"
    Write-Host "  - Is the API server running? (npm run dev in apps/api)"
    Write-Host "  - Is OPENAI_API_KEY configured?"
    Write-Host "  - Is the audio file format supported?"
}

Write-Host ""
Write-Host "================================"

