import { db, isDatabaseConfigured } from './index.ts';
import { users, runs, aiCreations } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

interface FallbackUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  coins: number;
  bestScore: number;
  bestCombo: number;
  selectedCarId: string;
  unlockedCarsJson: string;
  carUpgradesJson: string;
  customSpriteUrl: string | null;
  createdAt: Date;
}

interface FallbackRun {
  id: number;
  pilotName: string;
  carId: string;
  score: number;
  distance: number;
  maxCombo: number;
  coinsCollected: number;
  createdAt: Date;
}

const fallbackUsers = new Map<string, FallbackUser>();
let fallbackUserSeq = 1;
let fallbackRunSeq = 100;

const fallbackRuns: FallbackRun[] = [
  { id: 1, pilotName: 'Keisuke_FD', carId: 'apex_valkyrie', score: 18420, distance: 2640, maxCombo: 18, coinsCollected: 195, createdAt: new Date(Date.now() - 1000 * 60 * 180) },
  { id: 2, pilotName: 'Akina_86', carId: 'ae86_trueno_panda', score: 15280, distance: 2190, maxCombo: 16, coinsCollected: 164, createdAt: new Date(Date.now() - 1000 * 60 * 140) },
  { id: 3, pilotName: 'Wangan_Blackbird', carId: 'skyline_r34_gtr_vspec', score: 13640, distance: 1980, maxCombo: 14, coinsCollected: 142, createdAt: new Date(Date.now() - 1000 * 60 * 110) },
  { id: 4, pilotName: 'Haruna_S15', carId: 'sakura_silvia', score: 11290, distance: 1690, maxCombo: 12, coinsCollected: 120, createdAt: new Date(Date.now() - 1000 * 60 * 90) },
  { id: 5, pilotName: 'Midnight_Bunta', carId: 'rally_legend', score: 9850, distance: 1450, maxCombo: 11, coinsCollected: 105, createdAt: new Date(Date.now() - 1000 * 60 * 65) },
  { id: 6, pilotName: 'Tokyo_Ghost', carId: 'cyber_supercar', score: 8140, distance: 1220, maxCombo: 9, coinsCollected: 88, createdAt: new Date(Date.now() - 1000 * 60 * 42) },
  { id: 7, pilotName: 'Canyon_Viper', carId: 'midnight_muscle', score: 6420, distance: 980, maxCombo: 8, coinsCollected: 72, createdAt: new Date(Date.now() - 1000 * 60 * 24) },
  { id: 8, pilotName: 'Touge_Rookie', carId: 'blue_jdm', score: 4210, distance: 680, maxCombo: 6, coinsCollected: 50, createdAt: new Date(Date.now() - 1000 * 60 * 10) },
];

function getOrCreateFallbackUser(uid: string, email: string, displayName?: string): FallbackUser {
  const existing = fallbackUsers.get(uid);
  if (existing) return existing;
  const cleanName = (displayName || email.split('@')[0] || 'Drift Pilot').slice(0, 48);
  const created: FallbackUser = {
    id: fallbackUserSeq++,
    uid,
    email,
    displayName: cleanName,
    coins: 320,
    bestScore: 0,
    bestCombo: 1,
    selectedCarId: 'blue_jdm',
    unlockedCarsJson: '["blue_jdm"]',
    carUpgradesJson: '{"blue_jdm":{"speed":1,"handling":1,"magnet":1}}',
    customSpriteUrl: null,
    createdAt: new Date(),
  };
  fallbackUsers.set(uid, created);
  return created;
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  if (!isDatabaseConfigured || !db) {
    return getOrCreateFallbackUser(uid, email, displayName);
  }
  try {
    const cleanName = (displayName || email.split('@')[0] || 'Drift Pilot').slice(0, 48);
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: cleanName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.warn('Database unavailable in getOrCreateUser, using fallback:', (error as Error).message);
    return getOrCreateFallbackUser(uid, email, displayName);
  }
}

export async function updateUserGarage(
  uid: string,
  email: string,
  payload: {
    coins: number;
    bestScore: number;
    bestCombo: number;
    selectedCarId: string;
    unlockedCarsJson: string;
    carUpgradesJson: string;
    customSpriteUrl?: string;
  }
) {
  const applyFallback = () => {
    const userRow = getOrCreateFallbackUser(uid, email);
    userRow.coins = Math.max(0, Math.round(payload.coins));
    userRow.bestScore = Math.max(0, Math.round(payload.bestScore));
    userRow.bestCombo = Math.max(1, Math.round(payload.bestCombo));
    userRow.selectedCarId = payload.selectedCarId;
    userRow.unlockedCarsJson = payload.unlockedCarsJson;
    userRow.carUpgradesJson = payload.carUpgradesJson;
    if (payload.customSpriteUrl !== undefined) {
      userRow.customSpriteUrl = payload.customSpriteUrl;
    }
    return userRow;
  };

  if (!isDatabaseConfigured || !db) {
    return applyFallback();
  }
  try {
    await getOrCreateUser(uid, email);
    const updated = await db
      .update(users)
      .set({
        coins: Math.max(0, Math.round(payload.coins)),
        bestScore: Math.max(0, Math.round(payload.bestScore)),
        bestCombo: Math.max(1, Math.round(payload.bestCombo)),
        selectedCarId: payload.selectedCarId,
        unlockedCarsJson: payload.unlockedCarsJson,
        carUpgradesJson: payload.carUpgradesJson,
        ...(payload.customSpriteUrl !== undefined ? { customSpriteUrl: payload.customSpriteUrl } : {}),
      })
      .where(eq(users.uid, uid))
      .returning();

    return updated[0];
  } catch (error) {
    console.warn('Database unavailable in updateUserGarage, using fallback:', (error as Error).message);
    return applyFallback();
  }
}

export async function recordDriftRun(
  uid: string,
  email: string,
  displayName: string,
  runData: {
    carId: string;
    score: number;
    distance: number;
    maxCombo: number;
    coinsCollected: number;
  }
) {
  const applyFallback = () => {
    const userRow = getOrCreateFallbackUser(uid, email, displayName);
    const newBestScore = Math.max(userRow.bestScore, Math.round(runData.score));
    const newBestCombo = Math.max(userRow.bestCombo, Math.round(runData.maxCombo));
    const newCoins = Math.max(0, userRow.coins + Math.max(0, Math.round(runData.coinsCollected)));
    userRow.coins = newCoins;
    userRow.bestScore = newBestScore;
    userRow.bestCombo = newBestCombo;

    const entry: FallbackRun = {
      id: fallbackRunSeq++,
      pilotName: userRow.displayName,
      carId: runData.carId,
      score: Math.max(0, Math.round(runData.score)),
      distance: Math.max(0, Math.round(runData.distance)),
      maxCombo: Math.max(1, Math.round(runData.maxCombo)),
      coinsCollected: Math.max(0, Math.round(runData.coinsCollected)),
      createdAt: new Date(),
    };
    fallbackRuns.push(entry);
    fallbackRuns.sort((a, b) => b.score - a.score);
    if (fallbackRuns.length > 50) fallbackRuns.length = 50;

    return {
      run: entry,
      coins: newCoins,
      bestScore: newBestScore,
      bestCombo: newBestCombo,
    };
  };

  if (!isDatabaseConfigured || !db) {
    return applyFallback();
  }
  try {
    const userRow = await getOrCreateUser(uid, email, displayName);
    const newBestScore = Math.max(userRow.bestScore, Math.round(runData.score));
    const newBestCombo = Math.max(userRow.bestCombo, Math.round(runData.maxCombo));
    const newCoins = Math.max(0, userRow.coins + Math.max(0, Math.round(runData.coinsCollected)));

    await db
      .update(users)
      .set({
        coins: newCoins,
        bestScore: newBestScore,
        bestCombo: newBestCombo,
      })
      .where(eq(users.id, userRow.id));

    const insertedRun = await db
      .insert(runs)
      .values({
        userId: userRow.id,
        pilotName: userRow.displayName,
        carId: runData.carId,
        score: Math.max(0, Math.round(runData.score)),
        distance: Math.max(0, Math.round(runData.distance)),
        maxCombo: Math.max(1, Math.round(runData.maxCombo)),
        coinsCollected: Math.max(0, Math.round(runData.coinsCollected)),
      })
      .returning();

    return {
      run: insertedRun[0],
      coins: newCoins,
      bestScore: newBestScore,
      bestCombo: newBestCombo,
    };
  } catch (error) {
    console.warn('Database unavailable in recordDriftRun, using fallback:', (error as Error).message);
    return applyFallback();
  }
}

export async function getTopLeaderboard(limitCount = 15) {
  if (!isDatabaseConfigured || !db) {
    return [...fallbackRuns].sort((a, b) => b.score - a.score).slice(0, limitCount);
  }
  try {
    return await db
      .select({
        id: runs.id,
        pilotName: runs.pilotName,
        carId: runs.carId,
        score: runs.score,
        distance: runs.distance,
        maxCombo: runs.maxCombo,
        coinsCollected: runs.coinsCollected,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.score))
      .limit(limitCount);
  } catch (error) {
    console.warn('Database unavailable in getTopLeaderboard, returning seeded fallback:', (error as Error).message);
    return [...fallbackRuns].sort((a, b) => b.score - a.score).slice(0, limitCount);
  }
}

export async function saveAiCreation(
  uid: string,
  email: string,
  creation: {
    kind: string;
    prompt: string;
    mediaUrl: string;
    metaJson?: string;
  }
) {
  const applyFallback = () => ({
    id: fallbackRunSeq++,
    userId: getOrCreateFallbackUser(uid, email).id,
    kind: creation.kind,
    prompt: creation.prompt.slice(0, 500),
    mediaUrl: creation.mediaUrl,
    metaJson: creation.metaJson || '{}',
    createdAt: new Date(),
  });

  if (!isDatabaseConfigured || !db) {
    return applyFallback();
  }
  try {
    const userRow = await getOrCreateUser(uid, email);
    const result = await db
      .insert(aiCreations)
      .values({
        userId: userRow.id,
        kind: creation.kind,
        prompt: creation.prompt.slice(0, 500),
        mediaUrl: creation.mediaUrl,
        metaJson: creation.metaJson || '{}',
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('Database unavailable in saveAiCreation, using fallback:', (error as Error).message);
    return applyFallback();
  }
}

