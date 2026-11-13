import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('Drift Pilot').notNull(),
  coins: integer('coins').default(250).notNull(),
  bestScore: integer('best_score').default(0).notNull(),
  bestCombo: integer('best_combo').default(1).notNull(),
  selectedCarId: text('selected_car_id').default('blue_jdm').notNull(),
  unlockedCarsJson: text('unlocked_cars_json').default('["blue_jdm"]').notNull(),
  carUpgradesJson: text('car_upgrades_json').default('{"blue_jdm":{"speed":1,"handling":1,"magnet":1}}').notNull(),
  customSpriteUrl: text('custom_sprite_url').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  pilotName: text('pilot_name').notNull(),
  carId: text('car_id').notNull(),
  score: integer('score').notNull(),
  distance: integer('distance').notNull(),
  maxCombo: integer('max_combo').notNull(),
  coinsCollected: integer('coins_collected').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiCreations = pgTable('ai_creations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  kind: text('kind').notNull(), // 'livery' | 'poster' | 'music' | 'video' | 'tts'
  prompt: text('prompt').notNull(),
  mediaUrl: text('media_url').notNull(),
  metaJson: text('meta_json').default('{}').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  runs: many(runs),
  aiCreations: many(aiCreations),
}));

export const runsRelations = relations(runs, ({ one }) => ({
  pilot: one(users, {
    fields: [runs.userId],
    references: [users.id],
  }),
}));

export const aiCreationsRelations = relations(aiCreations, ({ one }) => ({
  creator: one(users, {
    fields: [aiCreations.userId],
    references: [users.id],
  }),
}));
