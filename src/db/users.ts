import { db } from './index.ts';
import { users, runs, aiCreations } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
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
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to load or register user profile.', { cause: error });
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
    console.error('Database query failed in updateUserGarage:', error);
    throw new Error('Failed to save garage progression.', { cause: error });
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
    console.error('Database query failed in recordDriftRun:', error);
    throw new Error('Failed to record drift run.', { cause: error });
  }
}

export async function getTopLeaderboard(limitCount = 15) {
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
    console.error('Database query failed in getTopLeaderboard:', error);
    throw new Error('Failed to fetch leaderboard.', { cause: error });
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
    console.error('Database query failed in saveAiCreation:', error);
    throw new Error('Failed to save AI studio creation.', { cause: error });
  }
}
