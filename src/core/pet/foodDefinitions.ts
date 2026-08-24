export type FoodPreference = "LOVE" | "LIKE" | "NORMAL" | "DISLIKE";
export type FoodReactionKey =
  | "FEED_LOVE"
  | "FEED_NORMAL"
  | "FEED_DISLIKE";

export interface FoodDefinition {
  readonly id: string;
  readonly name: string;
  readonly hungerRestore: number;
  readonly moodDelta: number;
  readonly preference: FoodPreference;
  readonly reactionKey: FoodReactionKey;
  readonly asset?: string;
}

export const DEFAULT_FOOD_DEFINITIONS: readonly FoodDefinition[] = [
  {
    id: "strawberry",
    name: "草莓",
    hungerRestore: 12,
    moodDelta: 3,
    preference: "LOVE",
    reactionKey: "FEED_LOVE",
    asset: "🍓",
  },
  {
    id: "rice_ball",
    name: "饭团",
    hungerRestore: 25,
    moodDelta: 1,
    preference: "NORMAL",
    reactionKey: "FEED_NORMAL",
    asset: "🍙",
  },
  {
    id: "carrot",
    name: "胡萝卜",
    hungerRestore: 18,
    moodDelta: -1,
    preference: "DISLIKE",
    reactionKey: "FEED_DISLIKE",
    asset: "🥕",
  },
];

const foodDefinitionById = new Map(
  DEFAULT_FOOD_DEFINITIONS.map((food) => [food.id, food]),
);

export function getFoodDefinition(foodId: string): FoodDefinition | null {
  return foodDefinitionById.get(foodId) ?? null;
}
