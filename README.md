# Pokémon Card Analyzer

A web-based application that analyzes Pokémon trading card centering to help collectors predict potential grading scores before submission.

## Features

- **Card Centering Analysis**: Precise measurements of card borders and calculation of centering scores
- **Multiple Input Methods**: Capture cards using your device's camera or upload existing images
- **Grading Prediction**: Get potential grading scores based on card centering
- **Analysis Reports**: Generate and download detailed analysis reports with visualizations
- **Card History**: Save and review your analyzed cards
- **Settings Customization**: Adjust analysis parameters and application preferences

## Technologies Used

- **Frontend**: React, TypeScript, Tailwind CSS, Remix
- **Computer Vision**: TensorFlow.js, Canvas API
- **Storage**: IndexedDB (client-side)
- **Runtime**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- Modern web browser with camera access permissions (for camera functionality)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pokemon-card-analyzer.git
   cd pokemon-card-analyzer
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage Instructions

1. **Analyze a Card**:
   - Use your device's camera or upload an existing image
   - For best results, place your card on a dark, contrasting background with even lighting

2. **Review Analysis**:
   - View border measurements and centering scores
   - Check potential grading outcomes based on centering
   - Download a detailed analysis report

3. **Access History**:
   - View and manage previously analyzed cards
   - Select a card from history to view its detailed analysis

## Deployment

To build the application for production:

```bash
bun run build
```

The built files will be in the `build` directory, ready to be deployed to your preferred hosting service.

## Privacy Notice

All card analysis is performed locally in your browser. No card images or analysis data are sent to any servers. Your card history is stored only on your device using IndexedDB.

## Disclaimer

This tool is for educational purposes only. The Pokémon Card Analyzer is not affiliated with Nintendo, The Pokémon Company, PSA, BGS, CGC, or any other trading card grading service. All trademarks belong to their respective owners.

The analysis provided by this tool is based on card centering only, which is just one factor in professional grading. Results should be considered as estimates rather than guarantees of professional grading outcomes.

## License

MIT License - see the LICENSE file for details.

## Acknowledgements

- TensorFlow.js for providing browser-based machine learning capabilities
- The Pokémon TCG community for inspiration and feedback
