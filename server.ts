import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  updateUserGarage,
  recordDriftRun,
  getTopLeaderboard,
  saveAiCreation,
} from './src/db/users.ts';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // --- Cloud SQL Leaderboard & User Progression Routes ---
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const rows = await getTopLeaderboard(15);
      res.json({ leaderboard: rows });
    } catch (error: unknown) {
      console.error('Failed to fetch leaderboard:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      });
    }
  });

  app.get('/api/user/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'pilot@apexslash.io';
      const name = req.user!.name || email.split('@')[0];
      const profile = await getOrCreateUser(uid, email, name);
      res.json({ profile });
    } catch (error: unknown) {
      console.error('Failed to get user profile:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load profile',
      });
    }
  });

  app.post('/api/user/garage', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'pilot@apexslash.io';
      const updated = await updateUserGarage(uid, email, req.body);
      res.json({ profile: updated });
    } catch (error: unknown) {
      console.error('Failed to update garage:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update garage',
      });
    }
  });

  app.post('/api/runs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'pilot@apexslash.io';
      const name = req.user!.name || req.body.pilotName || email.split('@')[0];
      const result = await recordDriftRun(uid, email, name, {
        carId: String(req.body.carId || 'blue_jdm'),
        score: Number(req.body.score || 0),
        distance: Number(req.body.distance || 0),
        maxCombo: Number(req.body.maxCombo || 1),
        coinsCollected: Number(req.body.coinsCollected || 0),
      });
      res.json(result);
    } catch (error: unknown) {
      console.error('Failed to record drift run:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record run',
      });
    }
  });

  // --- Server-Side Gemini AI Pit Studio Endpoints ---

  // 1. Gemini Intelligence: Multi-model Race Engineer & Telemetry Strategist
  // Supports: gemini-4-carbon (deep reasoning), gemini-4-argon (complex interactive),
  // gemini-3.8-flash (general tasks), gemini-3.1-flash-lite (ultra-fast callouts)
  app.post('/api/ai/coach', async (req, res) => {
    try {
      const {
        mode = 'fast',
        prompt = '',
        carName = 'Hachiroku GT-Apex',
        bestScore = 0,
        lastScore = 0,
        maxCombo = 1,
      } = req.body;

      let modelName = 'gemini-3.8-flash';
      if (mode === 'deep') modelName = 'gemini-4-carbon';
      else if (mode === 'interactive') modelName = 'gemini-4-argon';
      else if (mode === 'instant') modelName = 'gemini-3.1-flash-lite';
      else modelName = 'gemini-3.8-flash';

      const sysInstruction =
        'You are Chief Drift Engineer Keiichi in Apex Slash, a vertical 3D diagonal drift game where cars cut between / (right-diagonal) and \\ (left-diagonal) canyon hairpins. Give punchy, high-dopamine, actionable tuning and rhythm advice in 2-4 sentences.';

      const userPrompt =
        prompt.trim() ||
        `Analyze my telemetry in ${carName}: Last Run ${lastScore} pts, Best Score ${bestScore} pts, Max Drift Combo x${maxCombo}. How do I chain tighter / and \\ edge-drifts and upgrade my garage optimally?`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: sysInstruction,
          ...(modelName === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      res.json({
        modelUsed: modelName,
        text: response.text || 'Hold the inside curb on rapid / to \\ transitions to charge Fever 3x faster!',
      });
    } catch (error: unknown) {
      console.error('Gemini coach error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'AI Race Engineer request failed.',
      });
    }
  });

  // 2. Convert Text to Speech using gemini-3.8-flash-tts (Dual-Speaker Drift Announcer Booth)
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const {
        score = 1200,
        combo = 8,
        carName = 'Hachiroku GT-Apex',
        customScript = '',
      } = req.body;

      const line1 =
        customScript.trim() ||
        `Blaze: <gasp> Unbelievable angle in the ${carName}! Clocking ${score} points with a ${combo}x diagonal slash combo!`;
      const line2 = `Nova: |yeah| <laugh> Those rear tires were hanging millimeter-close to the canyon abyss!`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: line1,
                speechMetadata: {
                  speaker: 'Blaze',
                  style: 'Hyped energetic drift announcer',
                },
              },
              {
                text: line2,
                speechMetadata: {
                  speaker: 'Nova',
                  style: 'Cool technical motorsport co-commentator',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Blaze',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' },
                  },
                },
                {
                  speaker: 'Nova',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              ],
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('No audio returned from gemini-3.8-flash-tts.');
      }

      res.json({
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        transcript: `${line1} ${line2}`,
      });
    } catch (error: unknown) {
      console.error('Gemini TTS error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'TTS generation failed.',
      });
    }
  });

  // 3. Generate Music using lyria-3-clip-preview (30s clip) or lyria-3-pro-preview (full track)
  app.post('/api/ai/music', async (req, res) => {
    try {
      const {
        prompt = 'High-octane Japanese drift phonk and synthwave beat with punchy 808 cowbells and turbo bassline',
        durationMode = 'clip', // 'clip' -> lyria-3-clip-preview, 'full' -> lyria-3-pro-preview
      } = req.body;

      const modelName =
        durationMode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        throw new Error(`No audio stream chunks returned from ${modelName}.`);
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        modelUsed: modelName,
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics: lyrics.trim(),
      });
    } catch (error: unknown) {
      console.error('Lyria music generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Music generation failed.',
      });
    }
  });

  // 4. Create & Edit Car Sprites / Liveries using gemini-nano-banana-2.1
  app.post('/api/ai/image-livery', async (req, res) => {
    try {
      const {
        prompt = 'Rear-three-quarter diagonal arcade drift car sprite with flame decals, dark background',
        base64Image,
        mimeType = 'image/png',
        aspectRatio = '1:1',
      } = req.body;

      const parts: Array<
        | { inlineData: { data: string; mimeType: string } }
        | { text: string }
      > = [];

      if (base64Image) {
        const cleanBase64 = base64Image.includes(',')
          ? base64Image.split(',')[1]
          : base64Image;
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize: '1K',
          },
        },
      });

      let imageUrl = '';
      let textNote = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${outMime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textNote += part.text;
        }
      }

      if (!imageUrl) {
        throw new Error('No image returned from gemini-nano-banana-2.1.');
      }

      res.json({
        modelUsed: 'gemini-nano-banana-2.1',
        imageUrl,
        textNote,
      });
    } catch (error: unknown) {
      console.error('Nano Banana 2.1 image error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Image creation/edit failed.',
      });
    }
  });

  // 5. Generate High-Quality Drift Key Art / Posters using gemini-3-pro-image-preview (1K, 2K, 4K)
  app.post('/api/ai/image-pro', async (req, res) => {
    try {
      const {
        prompt = 'Vertical 9:16 automotive drift poster of a widebody coupe sliding along a cliffside canyon road at sunset',
        imageSize = '1K', // '1K' | '2K' | '4K'
        aspectRatio = '9:16',
      } = req.body;

      const validSize = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio,
              imageSize: validSize,
            },
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404') || msg.includes('NOT_FOUND')) {
          response = await ai.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: {
              parts: [{ text: prompt }],
            },
            config: {
              imageConfig: {
                aspectRatio,
                imageSize: validSize,
              },
            },
          });
        } else {
          throw err;
        }
      }

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${outMime};base64,${part.inlineData.data}`;
        }
      }

      if (!imageUrl) {
        throw new Error('No high-res image returned.');
      }

      res.json({
        modelUsed: 'gemini-3-pro-image-preview',
        imageSize: validSize,
        imageUrl,
      });
    } catch (error: unknown) {
      console.error('Pro image generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'High-res image generation failed.',
      });
    }
  });

  // 6. Animate Images into Video using gemini-omni-1.2-flash via Interactions API (16:9 or 9:16)
  app.post('/api/ai/video-animate', async (req, res) => {
    try {
      const {
        base64Image,
        mimeType = 'image/jpeg',
        prompt = 'The drift car slides sideways throwing glowing tire smoke and orange sparks along the canyon highway.',
        aspectRatio = '9:16', // '9:16' or '16:9'
      } = req.body;

      if (!base64Image) {
        return res.status(400).json({ error: 'Please upload or select a photo to animate.' });
      }

      const cleanBase64 = base64Image.includes(',')
        ? base64Image.split(',')[1]
        : base64Image;
      const validRatio = aspectRatio === '16:9' ? '16:9' : '9:16';

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: cleanBase64,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validRatio,
            duration: '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart?.data) {
        const vMime = videoPart.mime_type || 'video/mp4';
        return res.json({
          modelUsed: 'gemini-omni-1.2-flash',
          aspectRatio: validRatio,
          videoUrl: `data:${vMime};base64,${videoPart.data}`,
        });
      }
      if (videoPart?.uri) {
        return res.json({
          modelUsed: 'gemini-omni-1.2-flash',
          aspectRatio: validRatio,
          videoUrl: videoPart.uri,
        });
      }

      throw new Error('No video output returned from gemini-omni-1.2-flash.');
    } catch (error: unknown) {
      console.error('Omni Flash video animation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Video animation failed.',
      });
    }
  });

  // Save AI Studio Creation to Cloud SQL if authenticated
  app.post('/api/ai/save', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'pilot@apexslash.io';
      const saved = await saveAiCreation(uid, email, req.body);
      res.json({ saved });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save creation',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Slash server running on http://localhost:${PORT}`);
  });
}

startServer();
