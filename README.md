# Audio Sync PoC

A **Proof of Concept (PoC)** React application demonstrating **zero-drift synchronization** between a backing track and user microphone input using the **Web Audio API**.

This project solves the common issue of recording latency by calculating the precise offset between `AudioContext.currentTime` of the playback and the recording start time, allowing for perfect alignment even when starting to record mid-playback.

## Features

-   **Precision Audio Engine**: Uses `AudioContext` for timing instead of `setTimeout`/`setInterval` to prevent drift.
-   **Mid-Playback Synchronization**: Recording can start at any point; the engine calculates the exact offset.
-   **Waveform Visualization**: Interactive canvas visualization of the recorded audio with **beat grid overlays**.
-   **Latency Correction**: manual slider to fine-tune offsets (default -80ms) to compensate for hardware/driver latency.
-   **Interactive Scrubbing**: Click and drag on the waveform to scrub and play from specific points.

## How it Works

1.  **Backing Track**: Generates a Metronome using an `OscillatorNode` (no external files).
2.  **Recording**: Captures audio via `MediaRecorder`.
3.  **Synchronization Logic**:
    -   `playbackStartTime` is captured when the metronome starts.
    -   `recordingStartTime` is captured when the user hits record.
    -   `offset = recordingStartTime - playbackStartTime`.
4.  **Playback**: The recorded audio buffer is scheduled to play at `currentTime + offset + manualCorrection`, ensuring it aligns with the backing track.

## Tech Stack

-   **React** (Vite)
-   **Web Audio API** (Native)
-   **CSS** (Minimal custom styling)

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Tryharder782/audio-sync-poc.git
    cd audio-sync-poc
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

## Usage

1.  **Start Backing**: Click "1. Start Backing Track" to hear the metronome.
2.  **Record**: Click "2. Start Recording" and make noise on the beat (clap, sing).
3.  **Stop**: Click "3. Stop" to process the audio.
4.  **Verify**:
    -   Click "4. Play Synced Result".
    -   adjust the **Latency Slider** if needed.
    -   Check the **Waveform** to see if your peaks align with the white vertical lines.

## Author

**Arkabaev Semetei**

-   📧 [semetei.arkabaev@gmail.com](mailto:semetei.arkabaev@gmail.com)
-   💼 [Upwork Profile](https://www.upwork.com/freelancers/~01c743dbd4dafb51c7)
