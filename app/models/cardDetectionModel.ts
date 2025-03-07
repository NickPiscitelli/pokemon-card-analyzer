import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Initialize TensorFlow.js environment
export const initTensorFlow = async () => {
  if (!isBrowser) return;
  
  await tf.ready();
  await tf.setBackend('webgl');
  console.log('TensorFlow.js initialized with backend:', tf.getBackend());
};

// Class for detecting cards in images
export class CardDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  
  // Initialize the model
  async initialize() {
    if (!isBrowser) return;
    
    if (!this.model) {
      console.log('Loading COCO-SSD model...');
      this.model = await cocoSsd.load();
      console.log('COCO-SSD model loaded.');
    }
  }
  
  // Detect objects in the image and filter for potential cards
  async detectCard(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<cocoSsd.DetectedObject[]> {
    if (!isBrowser) return [];
    
    if (!this.model) {
      await this.initialize();
    }
    
    if (!this.model) {
      throw new Error('Model failed to initialize');
    }
    
    // Detect objects in the image
    const predictions = await this.model.detect(imageElement);
    
    // First try: Filter for rectangles that might be cards
    // Accept more potential objects that could be cards
    let potentialCards = predictions.filter(prediction => {
      // Look for objects with rectangular shapes
      return ['book', 'cell phone', 'remote', 'mouse', 'keyboard', 'laptop', 'tv', 'monitor', 'paper', 'card'].includes(prediction.class) && 
              prediction.score > 0.3; // Accept even lower confidence predictions
    });
    
    // Second try: If no objects detected from our preferred list, 
    // take any detected object with decent confidence
    if (potentialCards.length === 0 && predictions.length > 0) {
      potentialCards = predictions
        .filter(prediction => prediction.score > 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 1); // Take the highest confidence object
    }
    
    // Last resort: If still no objects detected, create a fallback detection
    // that assumes the entire image is a card
    if (potentialCards.length === 0) {
      console.log('No objects detected, using fallback detection');
      const width = imageElement.width || (imageElement as HTMLImageElement).naturalWidth;
      const height = imageElement.height || (imageElement as HTMLImageElement).naturalHeight;
      
      // Create a synthetic detection that covers most of the image
      potentialCards = [{
        bbox: [
          width * 0.05, // x (5% from left)
          height * 0.05, // y (5% from top)
          width * 0.9, // width (90% of image width)
          height * 0.9  // height (90% of image height)
        ],
        class: 'card',
        score: 0.5
      }];
    }
    
    return potentialCards;
  }
}

// Singleton instance
export const cardDetector = new CardDetector(); 