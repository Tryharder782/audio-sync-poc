import { useState, useRef, useEffect } from 'react';

const METRONOME_BPM = 120;
const METRONOME_INTERVAL = 60 / METRONOME_BPM; // 0.5s

// --- COMPONENTS ---

const WaveformVisualizer = ({
  buffer,
  calculatedOffset,
  manualOffset,
  isPlaying,
  onPlayPause,
  onSeek,
  playbackMethodRef // Pass ref to check current playback time from parent if needed
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorTime, setCursorTime] = useState(0); // For visualizing playhead
  const animationRef = useRef();

  // Animation Loop for Cursor
  useEffect(() => {
    const animate = () => {
      if (isPlaying && playbackMethodRef.current) {
        const time = playbackMethodRef.current(); // Get current Time from parent
        setCursorTime(time);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, playbackMethodRef]);

  // Cleanup cursor on stop
  useEffect(() => {
    if (!isPlaying && !isDragging) {
      // If stopped and not seeking, reset cursor? Or keep it?
      // Let's keep it at last pos or 0 if stopped fully. 
      // Actually parent doesn't reset time on stop usually for these UX.
      // But we'll trust active interaction.
    }
  }, [isPlaying, isDragging]);

  const draw = () => {
    if (!canvasRef.current || !buffer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Draw Waveform
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#44ff44';
    ctx.beginPath();
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      if (min === 1.0) min = 0;
      if (max === -1.0) max = 0;

      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw Beat Lines
    // Sync Rule: VoiceTime = N * Interval - TotalOffset
    // TotalOffset = Calculated + Manual(s)
    const totalOffset = calculatedOffset + (manualOffset / 1000);
    const pixelsPerSecond = width / buffer.duration;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    // Iterate beats
    // We want VoiceTime >= 0. So N * Interval - TotalOffset >= 0 => N * Interval >= TotalOffset
    // Start N from ceil(TotalOffset / Interval)

    let startN = Math.floor(totalOffset / METRONOME_INTERVAL);
    // Be safe look back a bit
    startN -= 2;

    for (let n = startN; ; n++) {
      const beatTimeInVoice = (n * METRONOME_INTERVAL) - totalOffset;

      if (beatTimeInVoice > buffer.duration) break;
      if (beatTimeInVoice >= 0) {
        const x = beatTimeInVoice * pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw Cursor (Playhead)
    // If dragging, show drag pos. Else show actual cursorTime
    const effectiveTime = isDragging && hoverTime !== null ? hoverTime : cursorTime;
    const cursorX = Math.min(width, Math.max(0, effectiveTime * pixelsPerSecond));

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();

    // Draw time text
    ctx.fillStyle = '#ffff00';
    ctx.font = '10px monospace';
    ctx.fillText(effectiveTime.toFixed(2) + 's', cursorX + 4, 12);
  };

  useEffect(() => {
    draw();
  }, [buffer, calculatedOffset, manualOffset, cursorTime, isDragging, hoverTime]);

  // Interaction Handlers
  const getTimeFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cappedX = Math.max(0, Math.min(x, rect.width));
    return (cappedX / rect.width) * buffer.duration;
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const t = getTimeFromEvent(e);
    setHoverTime(t);
    setCursorTime(t); // Update visual immediately
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const t = getTimeFromEvent(e);
      setHoverTime(t);
      setCursorTime(t);
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      const t = getTimeFromEvent(e);
      setIsDragging(false);
      setHoverTime(null);
      onSeek(t);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setHoverTime(null);
      // Don't trigger seek on leave to avoid accidental jumps, or maybe do?
      // Standard behavior: usually seek only on MouseUp. 
      // If they leave, we assume they cancelled or just released outside.
      // Let's treat release outside as a seek.
      onSeek(cursorTime);
    }
  };

  return (
    <div className="waveform-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        className="waveform-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'text' }}
      />
      <div className="waveform-controls">
        <button
          onClick={() => {
            if (isPlaying) onPlayPause(); // Pause
            else onSeek(cursorTime); // Play from current cursor
          }}
          className="mini-play-btn"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>
    </div>
  );
};

const AboutSection = () => (
  <div className="about-section">
    <h3>About this Project</h3>
    <p>
      This is a <strong>latency-correction engine</strong> proof of concept.
      It demonstrates how to synchronize a user's microphone recording with a
      programmatic backing track using the Web Audio API's precise timing system.
    </p>
    <p>Use the slider above to fine-tune the offset if your hardware introduces input latency.</p>

    <div className="contacts">
      <h4>Created by Arkabaev Semetei</h4>
      <p>📧 <a href="mailto:semetei.arkabaev@gmail.com">semetei.arkabaev@gmail.com</a></p>
      <p>💼 <a href="https://www.upwork.com/freelancers/~01c743dbd4dafb51c7" target="_blank" rel="noreferrer">Upwork Profile</a></p>
    </div>
  </div>
);

// --- MAIN APP ---

function App() {
  const [status, setStatus] = useState('ready');
  const [calculatedOffset, setCalculatedOffset] = useState(null);
  const [manualOffset, setManualOffset] = useState(-80); // Default -80ms
  const [debugLog, setDebugLog] = useState([]);
  const [recordingBuffer, setRecordingBuffer] = useState(null);

  // Audio Refs
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingBlobRef = useRef(null);

  // Timing Refs
  const playbackStartTimeRef = useRef(0);
  const recordingStartTimeRef = useRef(0);

  // Nodes
  const scheduledNodesRef = useRef([]);

  // Playback State for Visualizer
  const activeSourceStartTimeRef = useRef(0); // AudioContext time when current playback started
  const activeSourceOffsetRef = useRef(0); // How far into the buffer we started (seek time)

  const log = (msg) => setDebugLog(prev => [...prev.slice(-4), msg]);

  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const createMetronomeBuffer = (ctx, duration = 60) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const intervalSamples = sampleRate * METRONOME_INTERVAL;
    const beepLength = sampleRate * 0.1;

    for (let i = 0; i < length; i += intervalSamples) {
      for (let j = 0; j < beepLength && i + j < length; j++) {
        data[i + j] = Math.sin(2 * Math.PI * 880 * (j / sampleRate)) * 0.5;
        if (j < 100) data[i + j] *= (j / 100);
        if (j > beepLength - 100) data[i + j] *= ((beepLength - j) / 100);
      }
    }
    return buffer;
  };

  // Play Backing
  const startBackingTrack = async () => {
    stopEverything(false);
    const ctx = initAudioContext();

    const buffer = createMetronomeBuffer(ctx, 60);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = ctx.currentTime + 0.1;
    source.start(startTime);

    playbackStartTimeRef.current = startTime;
    scheduledNodesRef.current.push(source);

    setStatus('playing_backing');
    log(`Metronome started.`);
  };

  // Record
  const startRecording = async () => {
    if (status !== 'playing_backing') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
          channelCount: 1
        }
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        recordingBlobRef.current = blob;
        const arrayBuffer = await blob.arrayBuffer();
        const rawBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        // Force Mono Mixdown if 2 channels
        // Sometimes raw constraint isn't enough, we must manually mix
        let finalBuffer = rawBuffer;
        if (rawBuffer.numberOfChannels > 1) {
          const ctx = audioCtxRef.current;
          const monoBuffer = ctx.createBuffer(1, rawBuffer.length, rawBuffer.sampleRate);
          const inputL = rawBuffer.getChannelData(0);
          const inputR = rawBuffer.getChannelData(1);
          const output = monoBuffer.getChannelData(0);

          for (let i = 0; i < rawBuffer.length; i++) {
            // Simple average mix
            output[i] = (inputL[i] + inputR[i]) / 2;
          }
          finalBuffer = monoBuffer;
        }

        setRecordingBuffer(finalBuffer);
        log(`Captured. Channels: ${rawBuffer.numberOfChannels} -> ${finalBuffer.numberOfChannels}`);
      };

      const ctx = audioCtxRef.current;
      const recStartTime = ctx.currentTime;
      recordingStartTimeRef.current = recStartTime;
      const calcOffset = recStartTime - playbackStartTimeRef.current;

      mediaRecorder.start();
      setCalculatedOffset(calcOffset);
      setStatus('recording');
      log(`Rec started.`);
    } catch (e) {
      log(`Error: ${e.message}`);
    }
  };

  const stopEverything = (fullStop = true) => {
    scheduledNodesRef.current.forEach(n => { try { n.stop(); } catch (e) { } });
    scheduledNodesRef.current = [];

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (fullStop) setStatus('stopped');
  };

  // Play Synced (with Seek Support)
  const playSynced = async (startTime = 0) => {
    if (!recordingBuffer) return;
    stopEverything(false);

    // Clamp start time
    if (startTime < 0) startTime = 0;
    if (startTime >= recordingBuffer.duration) startTime = 0;

    const ctx = initAudioContext();

    // Create sources
    const metronomeSource = ctx.createBufferSource();
    metronomeSource.buffer = createMetronomeBuffer(ctx, 60);
    metronomeSource.connect(ctx.destination);

    const voiceSource = ctx.createBufferSource();
    voiceSource.buffer = recordingBuffer;
    voiceSource.connect(ctx.destination);

    const now = ctx.currentTime + 0.1;
    // Total Offset = System Offset + Manual Correction
    const totalOffset = calculatedOffset + (manualOffset / 1000);

    // Scheduling:
    // Voice starts at `now` seeking to `startTime`.
    // Metronome starts at `now` seeking to `totalOffset + startTime`.

    const metronomeSeek = totalOffset + startTime;

    // Handle case where metronome seek is negative (voice starts BEFORE metronome?)
    // If metronomeSeek < 0, it means metronome hasn't started yet relative to this point in voice.
    // e.g. Voice is at 0:01, but TotalOffset is 5s. Metronome should be at 5:01. (Positive)
    // If offset is NEGATIVE (e.g. -5s), Metronome should be at -4.59s.
    // If seek time is negative, we delay start.

    if (metronomeSeek >= 0) {
      metronomeSource.start(now, metronomeSeek);
    } else {
      // Metronome starts in future? (0 - metronomeSeek) seconds later?
      // This is complex edge case. Simplification: Just start at 0 if negative.
      metronomeSource.start(now + Math.abs(metronomeSeek), 0);
    }

    voiceSource.start(now, startTime);

    scheduledNodesRef.current.push(metronomeSource, voiceSource);

    // Track for Visualizer
    activeSourceStartTimeRef.current = now;
    activeSourceOffsetRef.current = startTime;

    voiceSource.onended = () => {
      // Only set stopped if we didn't just start another one
      // Can be tricky with React state. We'll ignore for PoC.
      // setStatus('stopped'); 
    };

    setStatus('playing_synced');
    log(`Playing from ${startTime.toFixed(2)}s`);
  };

  // Callback to get current playback time for visualizer
  const getCurrentPlaybackTime = () => {
    if (status !== 'playing_synced') return activeSourceOffsetRef.current; // Return last known pos
    const ctx = audioCtxRef.current;
    if (!ctx) return 0;
    const elapsed = ctx.currentTime - activeSourceStartTimeRef.current;
    return activeSourceOffsetRef.current + elapsed;
  };

  const clearRecording = () => {
    stopEverything(true);
    setRecordingBuffer(null);
    setCalculatedOffset(null);
    recordingBlobRef.current = null;
    audioChunksRef.current = [];
    setStatus('ready');
    log('Recording cleared.');
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Audio Sync PoC</h1>

      <div className="card">
        <div className="status-badge state">{status.toUpperCase()}</div>

        {calculatedOffset !== null && (
          <div className="stats-box">
            <div>Calculated Offset: <strong>{(calculatedOffset * 1000).toFixed(0)} ms</strong></div>

            <div className="slider-container">
              <label>Manual Latency Correction: <strong>{manualOffset > 0 ? '+' : ''}{manualOffset} ms</strong></label>
              <input
                type="range"
                min="-200"
                max="200"
                value={manualOffset}
                onChange={(e) => setManualOffset(Number(e.target.value))}
              />
              <small className="hint">Move slider to fix hardware latency. Default is -80ms.</small>
            </div>
          </div>
        )}
      </div>

      {recordingBuffer && (
        <WaveformVisualizer
          buffer={recordingBuffer}
          calculatedOffset={calculatedOffset}
          manualOffset={manualOffset}
          isPlaying={status === 'playing_synced'}
          onPlayPause={() => {
            if (status === 'playing_synced') stopEverything(true);
            else playSynced(activeSourceOffsetRef.current);
          }}
          onSeek={(t) => playSynced(t)}
          playbackMethodRef={{ current: getCurrentPlaybackTime }}
        />
      )}

      <div className="controls-grid">
        <button
          disabled={status !== 'ready' && status !== 'stopped'}
          onClick={startBackingTrack}>
          1. Start Backing
        </button>

        <button
          disabled={status !== 'playing_backing'}
          onClick={startRecording}
          className="record-btn">
          2. Start Recording
        </button>

        <button
          onClick={() => stopEverything(true)}
          className="stop-btn">
          3. Stop
        </button>
      </div>

      {recordingBuffer && (
        <div style={{ marginTop: '10px' }}>
          <button onClick={clearRecording} style={{ backgroundColor: '#444' }}>
            🗑 Clear Recording
          </button>
        </div>
      )}

      <AboutSection />

      <div className="debug">
        {debugLog.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        color: '#666',
        fontSize: '0.8rem',
        pointerEvents: 'none'
      }}>
        v1.2 (Mono Mix + NoFilters)
      </div>
    </div>
  );
}

export default App;
