import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Initialize TensorFlow.js environment
export const initTensorFlow = async () => {
  await tf.ready();
  await tf.setBackend('webgl');
  console.log('TensorFlow.js initialized with backend:', tf.getBackend());
};

// Class for detecting cards in images
export class CardDetector {
  private model: cocoSsd.ObjectDetection | null = null;
  
  // Initialize the model
  async initialize() {
    if (!this.model) {
      console.log('Loading COCO-SSD model...');
      this.model = await cocoSsd.load();
      console.log('COCO-SSD model loaded.');
    }
  }
  
  // Detect objects in the image and filter for potential cards
  async detectCard(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<cocoSsd.DetectedObject[]> {
    if (!this.model) {
      await this.initialize();
    }
    
    if (!this.model) {
      throw new Error('Model failed to initialize');
    }
    
    // Detect objects in the image
    const predictions = await this.model.detect(imageElement);
    
    // Filter for rectangles that might be cards
    // Cards are usually rectangular objects
    const potentialCards = predictions.filter(prediction => {
      // Look for book, cell phone, or similar rectangular objects
      // We'll refine this later with our own model
      return prediction.class === 'book' || 
             prediction.class === 'cell phone' || 
             prediction.class === 'remote' ||
             prediction.class === 'mouse';
    });
    
    return potentialCards;
  }
}

// Singleton instance
export const cardDetector = new CardDetector(); 