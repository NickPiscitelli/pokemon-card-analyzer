// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Simple card detection without ML model
export class CardDetector {
  // Detect card in the image using basic dimensions
  detectCard(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): DetectedObject[] {
    const width = imageElement.width || (imageElement as HTMLImageElement).naturalWidth;
    const height = imageElement.height || (imageElement as HTMLImageElement).naturalHeight;
    
    // Create a detection that covers most of the image
    const detection = {
      bbox: [
        width * 0.05, // x (5% from left)
        height * 0.05, // y (5% from top)
        width * 0.9, // width (90% of image width)
        height * 0.9  // height (90% of image height)
      ],
      class: 'card',
      score: 1.0
    };
    
    return [detection];
  }
}

// Define the DetectedObject interface to maintain compatibility
interface DetectedObject {
  bbox: number[];
  class: string;
  score: number;
}

// Singleton instance
export const cardDetector = new CardDetector(); 