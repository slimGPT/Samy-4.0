# 🤖 SamyBear 4.0 - Avatar Integration Guide

**How to connect 3D avatars to SamyBear 4.0, regardless of engine (Unity, Unreal, Three.js, etc.)**

---

## 🎯 Overview

SamyBear 4.0 is **avatar-ready** and designed to work with any 3D engine or framework. This guide covers:
1. Real-time emotion and state synchronization
2. Lip-sync data streaming
3. Audio playback coordination
4. Implementation examples for major engines

---

## 📡 Integration Architecture

```
SamyBear 4.0 API
    ↓
WebSocket Server (or REST polling)
    ↓
Avatar Client (Unity/Unreal/Three.js/etc.)
    ↓
3D Character Animation
```

### Data Flow
```
User Speaks
    ↓
SamyBear processes (ElevenLabs STT → GPT-4o → ElevenLabs TTS)
    ↓
API sends emotion + audio URL
    ↓
Avatar receives data
    ↓
Avatar animates emotion + plays audio + lip-sync
```

---

## 🔌 Integration Methods

### Method 1: REST API Polling (Simple)
**Best for**: Quick prototypes, low-frequency updates

```typescript
// Poll every 500ms for state updates
setInterval(async () => {
  const response = await fetch('http://localhost:3001/state');
  const { emotion, energy, phase, audioUrl, lang } = await response.json();
  
  // Update avatar
  avatar.setEmotion(emotion);
  avatar.setEnergy(energy);
  avatar.setPhase(phase);
  
  if (audioUrl && audioUrl !== lastAudioUrl) {
    avatar.playAudio(audioUrl);
    lastAudioUrl = audioUrl;
  }
}, 500);
```

**Pros**: Simple to implement  
**Cons**: Not real-time, higher latency, more bandwidth

---

### Method 2: WebSocket (Recommended)
**Best for**: Real-time updates, production applications

#### Server-Side (Add to `apps/api/src/index.ts`)
```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3002 });

// Broadcast to all avatar clients
function broadcastToAvatars(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// In /talk endpoint, after emotion update:
broadcastToAvatars({
  type: 'emotion_update',
  emotion: detectedEmotion, // curious, happy, calm, sleepy, confused, excited, empathetic, sad
  energy: emotionEnergy, // 0-1
  phase: 'speaking', // idle, listening, thinking, speaking
  audioUrl: result.audioUrl,
  text: reply,
  lang: 'en', // en, fr, ar
  timestamp: Date.now(),
});
```

#### Client-Side (Any language)
```typescript
const ws = new WebSocket('ws://localhost:3002');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'emotion_update':
      avatar.setEmotion(data.emotion);
      avatar.setEnergy(data.energy);
      avatar.playAudio(data.audioUrl);
      avatar.speak(data.text); // For lip-sync
      break;
      
    case 'phase_change':
      avatar.setPhase(data.phase);
      break;
  }
};
```

**Pros**: Real-time, low latency, efficient  
**Cons**: Slightly more complex setup

---

### Method 3: Server-Sent Events (SSE)
**Best for**: One-way server → avatar updates

```typescript
// Server (Express)
app.get('/avatar-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send updates
  function sendUpdate(data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
  
  // Store this connection for broadcasts
  avatarClients.push(sendUpdate);
});

// Client
const eventSource = new EventSource('http://localhost:3001/avatar-stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  avatar.update(data);
};
```

---

## 📦 Data Structures

### Emotion Update Event
```typescript
interface EmotionUpdate {
  type: 'emotion_update';
  emotion: string;          // 'curious', 'happy', 'calm', 'sleepy', 'confused', 'excited', 'empathetic', 'sad'
  energy: number;           // 0.0 - 1.0
  phase: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioUrl: string;         // URL to audio file
  text: string;             // Text being spoken
  lang: string;             // 'en', 'fr', 'ar'
  timestamp: number;        // Unix timestamp
}
```

### Phase Change Event
```typescript
interface PhaseChange {
  type: 'phase_change';
  phase: 'idle' | 'listening' | 'thinking' | 'speaking';
  timestamp: number;
}
```

### Lip-Sync Data (Advanced)
```typescript
interface LipSyncData {
  type: 'lipsync';
  phonemes: Array<{
    phoneme: string;        // 'AH', 'EE', 'OH', etc.
    startTime: number;      // Seconds from audio start
    endTime: number;
  }>;
  duration: number;         // Total audio duration
}
```

---

## 🎮 Unity Integration

### Setup
1. Install `WebSocketSharp` or use Unity's native `ClientWebSocket`
2. Create `CandyAvatarController.cs`

### Implementation
```csharp
using UnityEngine;
using WebSocketSharp;
using System;

public class SamyBearAvatarController : MonoBehaviour
{
    private WebSocket ws;
    private Animator animator;
    private AudioSource audioSource;
    
    // Emotion blend shapes or animation states
    [SerializeField] private SkinnedMeshRenderer faceRenderer;
    
    void Start()
    {
        animator = GetComponent<Animator>();
        audioSource = GetComponent<AudioSource>();
        
        // Connect to SamyBear 4.0 WebSocket
        ws = new WebSocket("ws://localhost:3002");
        
        ws.OnMessage += (sender, e) =>
        {
            var data = JsonUtility.FromJson<EmotionUpdate>(e.Data);
            HandleEmotionUpdate(data);
        };
        
        ws.Connect();
    }
    
    void HandleEmotionUpdate(EmotionUpdate data)
    {
        // Update emotion animation
        animator.SetTrigger($"Emotion_{data.emotion}");
        
        // Update energy (affects animation speed/intensity)
        animator.speed = 0.8f + (data.energy * 0.4f); // 0.8 - 1.2 range
        
        // Set phase
        switch (data.phase)
        {
            case "idle":
                animator.SetBool("IsListening", false);
                animator.SetBool("IsSpeaking", false);
                break;
            case "listening":
                animator.SetBool("IsListening", true);
                animator.SetBool("IsSpeaking", false);
                break;
            case "thinking":
                animator.SetTrigger("Think");
                animator.SetBool("IsListening", false);
                animator.SetBool("IsSpeaking", false);
                break;
            case "speaking":
                animator.SetBool("IsListening", false);
                animator.SetBool("IsSpeaking", true);
                StartCoroutine(PlayAudio(data.audioUrl));
                StartCoroutine(AnimateLipSync(data.text));
                break;
        }
        
        // Apply emotion blend shapes (for facial expressions)
        ApplyEmotionBlendShapes(data.emotion, data.energy);
    }
    
    void ApplyEmotionBlendShapes(string emotion, float energy)
    {
        // Reset all blend shapes
        for (int i = 0; i < faceRenderer.sharedMesh.blendShapeCount; i++)
        {
            faceRenderer.SetBlendShapeWeight(i, 0);
        }
        
        // Apply emotion-specific blend shapes (child-appropriate)
        switch (emotion)
        {
            case "curious":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("HeadTilt"), 60 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeWide"), 50 * energy);
                break;
            case "happy":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Smile"), 100 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeWide"), 70 * energy);
                break;
            case "calm":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Smile"), 60 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeSoft"), 70 * energy);
                break;
            case "sleepy":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeClose"), 80 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Yawn"), 50 * energy);
                break;
            case "confused":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("HeadTilt"), 70 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("BrowFurrow"), 60 * energy);
                break;
            case "excited":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Smile"), 100 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeWide"), 90 * energy);
                break;
            case "empathetic":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Smile"), 70 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeSoft"), 80 * energy);
                break;
            case "sad":
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("Frown"), 70 * energy);
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("EyeDowncast"), 80 * energy);
                break;
            // Add more emotions...
        }
    }
    
    IEnumerator PlayAudio(string url)
    {
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
                audioSource.clip = clip;
                audioSource.Play();
            }
        }
    }
    
    IEnumerator AnimateLipSync(string text)
    {
        // Simple phoneme-based lip sync
        // For production, use Oculus LipSync, SALSA, or similar
        
        float syllableTime = 0.15f; // Average syllable duration
        int syllables = EstimateSyllables(text);
        
        for (int i = 0; i < syllables; i++)
        {
            // Animate mouth open/close
            float t = 0;
            while (t < syllableTime)
            {
                float weight = Mathf.Sin(t / syllableTime * Mathf.PI) * 100;
                faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("MouthOpen"), weight);
                t += Time.deltaTime;
                yield return null;
            }
        }
        
        // Close mouth
        faceRenderer.SetBlendShapeWeight(GetBlendShapeIndex("MouthOpen"), 0);
    }
    
    int GetBlendShapeIndex(string name)
    {
        for (int i = 0; i < faceRenderer.sharedMesh.blendShapeCount; i++)
        {
            if (faceRenderer.sharedMesh.GetBlendShapeName(i) == name)
                return i;
        }
        return -1;
    }
    
    int EstimateSyllables(string text)
    {
        // Simple syllable estimation
        int count = 0;
        string vowels = "aeiouAEIOU";
        for (int i = 0; i < text.Length; i++)
        {
            if (vowels.Contains(text[i]))
                count++;
        }
        return Math.Max(count / 2, 1);
    }
    
    void OnDestroy()
    {
        ws?.Close();
    }
}

[Serializable]
public class EmotionUpdate
{
    public string type;
    public string emotion;
    public float energy;
    public string phase;
    public string audioUrl;
    public string text;
    public long timestamp;
}
```

### Unity Emotion Animations
**Recommended Approach**: Use Animation Layers

```
Base Layer: Idle animations
Emotion Layer: Emotion-specific poses/animations
Speaking Layer: Lip-sync and mouth movements
```

**Animation Controller Setup**:
```
Parameters:
- Emotion_curious (Trigger)
- Emotion_happy (Trigger)
- Emotion_calm (Trigger)
- Emotion_sleepy (Trigger)
- Emotion_confused (Trigger)
- Emotion_excited (Trigger)
- Emotion_empathetic (Trigger)
- Emotion_sad (Trigger)
- IsListening (Bool)
- IsSpeaking (Bool)
- Energy (Float 0-1)

Transitions:
- Any State → Emotion States (via triggers)
- Emotion States blend based on Energy parameter
```

---

## 🎬 Unreal Engine Integration

### Blueprint Setup
1. Create `BP_SamyBearAvatar` Blueprint
2. Add `WebSocket` component (plugin: `WebSocketNetworking`)
3. Add `Audio` component
4. Add `SkeletalMesh` with morph targets

### Blueprint Graph
```
Event BeginPlay
  ↓
Connect to WebSocket (ws://localhost:3002)
  ↓
Bind Event: On Message Received
  ↓
Parse JSON → Struct (EmotionUpdate)
  ↓
Branch: Type == "emotion_update"
  ↓
Set Animation Blueprint Variable: CurrentEmotion
Set Animation Blueprint Variable: EnergyLevel
Play Sound from URL: AudioUrl
Start Lip Sync Animation
```

### Animation Blueprint
```cpp
// C++ or Blueprint
void USamyBearAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);
    
    // Get emotion from character
    ASamyBearCharacter* SamyBear = Cast<ASamyBearCharacter>(TryGetPawnOwner());
    if (SamyBear)
    {
        CurrentEmotion = SamyBear->CurrentEmotion;
        EnergyLevel = SamyBear->EnergyLevel;
        
        // Blend emotion poses
        CuriousAlpha = (CurrentEmotion == "curious") ? EnergyLevel : 0.0f;
        HappyAlpha = (CurrentEmotion == "happy") ? EnergyLevel : 0.0f;
        CalmAlpha = (CurrentEmotion == "calm") ? EnergyLevel : 0.0f;
        SleepyAlpha = (CurrentEmotion == "sleepy") ? EnergyLevel : 0.0f;
        ConfusedAlpha = (CurrentEmotion == "confused") ? EnergyLevel : 0.0f;
        ExcitedAlpha = (CurrentEmotion == "excited") ? EnergyLevel : 0.0f;
        EmpatheticAlpha = (CurrentEmotion == "empathetic") ? EnergyLevel : 0.0f;
        SadAlpha = (CurrentEmotion == "sad") ? EnergyLevel : 0.0f;
        // ... etc
        
        // Apply morph targets
        GetMesh()->SetMorphTarget("Smile", GetEmotionBlendValue("Smile"));
        GetMesh()->SetMorphTarget("EyeWide", GetEmotionBlendValue("EyeWide"));
    }
}
```

---

## 🌐 Three.js / Web-Based Avatar Integration

### Setup
```bash
npm install three @react-three/fiber @react-three/drei
```

### Implementation
```typescript
import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

function SamyBearAvatar() {
  const avatarRef = useRef<THREE.Group>();
  const { scene, animations } = useGLTF('/models/samybear-avatar.glb');
  const { actions } = useAnimations(animations, avatarRef);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  
  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:3002');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'emotion_update') {
        // Trigger emotion animation
        actions[`emotion_${data.emotion}`]?.reset().fadeIn(0.5).play();
        
        // Adjust animation speed based on energy
        actions[`emotion_${data.emotion}`]?.setEffectiveTimeScale(0.8 + data.energy * 0.4);
        
        // Play audio
        if (data.audioUrl) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.play();
          
          // Start lip-sync
          animateLipSync(data.text, audioRef.current.duration);
        }
        
        // Update morph targets (facial expressions)
        updateMorphTargets(data.emotion, data.energy);
      }
    };
    
    return () => ws.close();
  }, [actions]);
  
  const updateMorphTargets = (emotion: string, energy: number) => {
    const mesh = scene.getObjectByName('Face') as THREE.SkinnedMesh;
    if (!mesh || !mesh.morphTargetInfluences) return;
    
    // Reset all morph targets
    mesh.morphTargetInfluences.fill(0);
    
    // Get morph target indices
    const morphTargets = mesh.morphTargetDictionary;
    
    switch (emotion) {
      case 'flirty':
        mesh.morphTargetInfluences[morphTargets['Smile']] = 0.8 * energy;
        mesh.morphTargetInfluences[morphTargets['EyeWink']] = 0.5 * energy;
        break;
      case 'playful':
        mesh.morphTargetInfluences[morphTargets['Smile']] = 1.0 * energy;
        mesh.morphTargetInfluences[morphTargets['EyeWide']] = 0.6 * energy;
        break;
      // ... more emotions
    }
  };
  
  const animateLipSync = (text: string, duration: number) => {
    const mesh = scene.getObjectByName('Face') as THREE.SkinnedMesh;
    if (!mesh) return;
    
    const mouthIndex = mesh.morphTargetDictionary['MouthOpen'];
    const syllables = estimateSyllables(text);
    const syllableDuration = duration / syllables;
    
    let currentSyllable = 0;
    const interval = setInterval(() => {
      if (currentSyllable >= syllables) {
        clearInterval(interval);
        mesh.morphTargetInfluences![mouthIndex] = 0;
        return;
      }
      
      // Animate mouth open/close
      const phase = (Date.now() % (syllableDuration * 1000)) / (syllableDuration * 1000);
      mesh.morphTargetInfluences![mouthIndex] = Math.sin(phase * Math.PI);
      
      currentSyllable++;
    }, syllableDuration * 1000);
  };
  
  return <primitive ref={avatarRef} object={scene} />;
}
```

---

## 🎙️ Advanced: Phoneme-Based Lip Sync

### Server-Side Phoneme Generation
Add to `apps/api/src/services/tts.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function generatePhonemesFromAudio(audioPath: string) {
  // Use Rhubarb Lip Sync or similar tool
  const { stdout } = await execPromise(`rhubarb -f json ${audioPath}`);
  const phonemeData = JSON.parse(stdout);
  
  return phonemeData.mouthCues.map((cue: any) => ({
    phoneme: cue.value,
    startTime: cue.start,
    endTime: cue.end,
  }));
}

// In TTS function, after generating audio:
const phonemes = await generatePhonemesFromAudio(audioFilePath);

// Broadcast to avatars
broadcastToAvatars({
  type: 'lipsync',
  phonemes,
  duration: audioDuration,
  audioUrl: result.audioUrl,
});
```

### Client-Side Phoneme Mapping
```typescript
const VISEME_MAP = {
  'X': 0,    // Rest
  'A': 1,    // 'ah' sound
  'B': 2,    // 'b', 'm', 'p'
  'C': 3,    // 'ch', 'j', 'sh'
  'D': 4,    // 'd', 'th'
  'E': 5,    // 'e', 'eh'
  'F': 6,    // 'f', 'v'
  'G': 7,    // 'g', 'k'
  'H': 8,    // 'ih', 'i'
  // ... full ARKit/Oculus viseme set
};

function applyPhoneme(mesh: THREE.SkinnedMesh, phoneme: string, intensity: number) {
  const visemeIndex = VISEME_MAP[phoneme] || 0;
  mesh.morphTargetInfluences![visemeIndex] = intensity;
}
```

---

## 🎨 Emotion Mapping Reference

### Visual Emotion Indicators
| Emotion | Facial Expression | Body Language | Color Scheme |
|---------|------------------|---------------|--------------|
| **Curious** 🐻 | Head tilt, attentive eyes | Leaning forward, exploring | Sky blue, indigo |
| **Happy** 🎉 | Wide smile, bright eyes | Bouncy, energetic | Yellow, amber |
| **Calm** 🌸 | Soft smile, relaxed | Still, centered | Blue, cyan |
| **Sleepy** 😴 | Gentle eyes, yawn | Slow, gentle movements | Soft purple |
| **Confused** 🤔 | Head tilt, questioning look | Slight uncertainty | Indigo, purple |
| **Excited** 🤩 | Big smile, wide eyes | Animated, high energy | Orange, yellow |
| **Empathetic** 💙 | Gentle smile, caring eyes | Open, supportive | Purple, blue |
| **Sad** 💙 | Downturned mouth, soft eyes | Gentle, comforting | Blue, indigo |

### Animation Timing
- **Emotion transition**: 700ms fade
- **Energy change**: 1000ms smooth
- **Phase change**: Immediate (no fade)
- **Lip-sync**: ~150ms per syllable

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Audio Not Playing
```typescript
// Ensure CORS headers are set
app.use(cors({
  origin: '*',  // Or specific avatar client origin
  methods: ['GET', 'POST'],
}));
```

#### 2. WebSocket Connection Failed
```typescript
// Check firewall rules
// Windows: Allow port 3002 inbound
// Linux: sudo ufw allow 3002
```

#### 3. Emotion Not Updating
```typescript
// Verify emotion is being broadcast
console.log('Broadcasting emotion:', data);
broadcastToAvatars(data);

// Client-side: Log received data
ws.onmessage = (event) => {
  console.log('Received:', event.data);
  // ... handle update
};
```

#### 4. Lip-Sync Out of Sync
```typescript
// Add audio delay compensation
const AUDIO_DELAY = 50; // ms
setTimeout(() => {
  avatar.startLipSync(text);
}, AUDIO_DELAY);
```

---

## 🚀 Production Checklist

- [ ] WebSocket server with reconnection logic
- [ ] Audio CDN for faster loading (CloudFront, Cloudflare)
- [ ] Phoneme generation for accurate lip-sync
- [ ] Error handling and fallbacks
- [ ] Network latency compensation
- [ ] Multiple avatar client support
- [ ] Session synchronization
- [ ] Performance monitoring

---

## 📚 Additional Resources

### Lip-Sync Tools
- **Rhubarb Lip Sync**: Command-line phoneme generator
- **Oculus LipSync**: Unity/Unreal plugin
- **SALSA**: Unity lip-sync asset
- **Mimic**: Web-based phoneme extraction

### Avatar Models
- **ReadyPlayerMe**: Customizable avatars with Unity/Unreal SDK
- **VRoid Studio**: Anime-style avatar creation
- **MetaHuman**: Unreal Engine realistic avatars
- **Mixamo**: Free rigged characters

### Animation Libraries
- **Mixamo**: Free animation library
- **Adobe Animate**: Character animation
- **Live2D**: 2D avatar animation

---

**Your avatar integration is ready! Choose your engine and start bringing SamyBear to life in 3D. 🎨🤖**

