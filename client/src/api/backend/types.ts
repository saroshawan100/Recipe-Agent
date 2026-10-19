import type {
  ChatMessage,
  CheckinResponse,
  CoachingScript,
  CookSession,
  PantryItem,
  Preferences,
  RecipeDto,
  RecipeSummary,
  ScanResponse,
  ShoppingItem,
  SuggestResponse,
} from "../types";

export type StorageMode = "browser" | "mongo";

export interface SuggestInput {
  ingredients: PantryItem[];
  staples: string[];
  preferences: Preferences;
}

export interface PantryData {
  items: PantryItem[];
  staples: string[];
}

export type ListResponse = { items: ShoppingItem[] };

export type SessionPatch = Partial<Pick<CookSession, "currentStep" | "stepElapsedSeconds" | "completedSteps" | "status">>;

export interface CheckinInput {
  recipeId: string;
  stepIndex: number;
  sessionId?: string;
  cueId?: string;
  answer: "notYet" | "problem";
  issue?: string;
  note?: string;
  image?: string;
  elapsedSeconds: number;
}

export interface AskInput {
  recipeId: string;
  stepIndex: number;
  elapsedSeconds: number;
  messages: ChatMessage[];
}

export interface ChatInput {
  messages: ChatMessage[];
  pantry: string[];
  recipeId: string | null;
}

export type OnDelta = (delta: string, full: string) => void;

/** Everything the UI needs from storage + AI. Implemented by the MongoDB API and by browser storage. */
export interface Backend {
  mode: StorageMode;

  suggest(input: SuggestInput): Promise<SuggestResponse>;
  getRecipe(id: string): Promise<RecipeDto>;
  recipeDetails(id: string): Promise<RecipeDto>;
  recipeImage(id: string): Promise<{ imageUrl: string }>;

  /** Identifies ingredients in a photo (a base64 data URL). Stateless, so both modes use `/api/ai/scan`. */
  scanPhoto(image: string, knownNames: string[]): Promise<ScanResponse>;
  getPantry(): Promise<PantryData>;
  savePantry(data: PantryData): Promise<PantryData>;

  listSaved(): Promise<RecipeSummary[]>;
  setSaved(id: string, saved: boolean): Promise<{ id: string; saved: boolean }>;

  shoppingList(): Promise<ListResponse>;
  addRecipeToList(v: { recipeId: string; scale?: number }): Promise<ListResponse & { added: number }>;
  addListItem(v: { name: string; aisle?: string }): Promise<ListResponse>;
  setListItemChecked(id: string, checked: boolean): Promise<ListResponse>;
  deleteListItem(id: string): Promise<ListResponse>;
  clearChecked(): Promise<ListResponse>;
  clearList(): Promise<ListResponse>;

  coachScript(recipeId: string, step: number): Promise<CoachingScript>;
  stepReferenceImage(recipeId: string, step: number): Promise<{ imageUrl: string }>;
  startSession(recipeId: string): Promise<CookSession>;
  restartSession(sessionId: string): Promise<CookSession>;
  updateSession(sessionId: string, patch: SessionPatch): Promise<CookSession>;
  checkin(input: CheckinInput): Promise<CheckinResponse>;

  askStream(input: AskInput, onDelta: OnDelta, signal?: AbortSignal): Promise<string>;
  chatStream(input: ChatInput, onDelta: OnDelta, signal?: AbortSignal): Promise<string>;
}
