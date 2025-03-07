import { get, set, del, createStore } from 'idb-keyval';

// Define a type for analyzed card results
export interface AnalyzedCard {
  id: string;
  timestamp: number;
  imageUrl: string;
  measurements: {
    leftBorder: number;
    rightBorder: number;
    topBorder: number;
    bottomBorder: number;
    horizontalCentering: number;
    verticalCentering: number;
    overallCentering: number;
  };
  potentialGrade: string;
  // Note: fullImageData cannot be stored in IndexedDB directly
  // We'll need to reconstruct it from the imageUrl when needed
}

// Define user settings
export interface UserSettings {
  theme: 'light' | 'dark';
  showGridOverlay: boolean;
  preferredGradingCompany: 'PSA' | 'BGS' | 'CGC' | 'all';
  calibrationFactor: number;
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Create custom stores only in browser environment
const cardHistoryStore = isBrowser ? createStore('pokemon-card-analyzer', 'card-history') : null;
const settingsStore = isBrowser ? createStore('pokemon-card-analyzer', 'settings') : null;

// Card history operations
export const saveCard = async (card: AnalyzedCard): Promise<void> => {
  if (!isBrowser) return;
  
  try {
    // Get existing cards
    const cards = await getCardHistory();
    
    // Add the new card
    cards.unshift(card);
    
    // Store up to 50 cards max
    const trimmedCards = cards.slice(0, 50);
    
    // Save to IndexedDB
    await set('cards', trimmedCards, cardHistoryStore!);
  } catch (error) {
    console.error('Error saving card:', error);
    throw error;
  }
};

export const getCardHistory = async (): Promise<AnalyzedCard[]> => {
  if (!isBrowser) return [];
  
  try {
    const cards = await get('cards', cardHistoryStore!);
    return cards || [];
  } catch (error) {
    console.error('Error getting card history:', error);
    return [];
  }
};

export const deleteCard = async (cardId: string): Promise<void> => {
  if (!isBrowser) return;
  
  try {
    const cards = await getCardHistory();
    const filteredCards = cards.filter(card => card.id !== cardId);
    await set('cards', filteredCards, cardHistoryStore!);
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
};

export const clearCardHistory = async (): Promise<void> => {
  if (!isBrowser) return;
  
  try {
    await set('cards', [], cardHistoryStore!);
  } catch (error) {
    console.error('Error clearing card history:', error);
    throw error;
  }
};

// Settings operations
export const getSettings = async (): Promise<UserSettings> => {
  // Default settings
  const defaultSettings: UserSettings = {
    theme: 'light',
    showGridOverlay: true,
    preferredGradingCompany: 'all',
    calibrationFactor: 1.0
  };
  
  if (!isBrowser) return defaultSettings;
  
  try {
    const settings = await get('settings', settingsStore!);
    
    // Return default settings if none exist
    return settings || defaultSettings;
  } catch (error) {
    console.error('Error getting settings:', error);
    
    // Return default settings on error
    return defaultSettings;
  }
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  if (!isBrowser) return;
  
  try {
    await set('settings', settings, settingsStore!);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

// Helper function to generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}; 