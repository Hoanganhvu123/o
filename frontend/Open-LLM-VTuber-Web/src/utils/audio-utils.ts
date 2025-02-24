import { toaster } from '@/components/ui/toaster';

/**
 * Slice audio from a specific position and return base64 string
 */
export const sliceAudioFromPosition = async (audioUrl: string, position: number): Promise<string> => {
  try {
    // Create audio context
    const audioContext = new AudioContext();
    
    // Fetch and decode audio
    const response = await fetch(audioUrl);
    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculate audio length in seconds
    const audioLengthInSeconds = audioBuffer.length / audioBuffer.sampleRate;
    
    // Validate position
    if (position >= audioLengthInSeconds) {
      const error = new Error('Invalid position: beyond audio length');
      console.error('❌ Position validation failed:', {
        position,
        audioLength: audioLengthInSeconds,
        error: error.message
      });
      throw error;
    }
    
    console.log('✂️ Processing audio:', {
      url: audioUrl,
      position,
      audioLength: audioLengthInSeconds
    });
    
    // Calculate start position in samples
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(position * sampleRate);
    
    console.log('📊 Buffer info:', {
      sampleRate,
      startSample,
      totalSamples: audioBuffer.length,
      channels: audioBuffer.numberOfChannels
    });
    
    // Create and fill new buffer
    const remainingSamples = audioBuffer.length - startSample;
    const slicedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      remainingSamples,
      sampleRate
    );
    
    // Copy data
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const newChannelData = channelData.subarray(startSample, audioBuffer.length);
      slicedBuffer.copyToChannel(newChannelData, channel);
    }

    // Convert to WAV and base64
    const wavBlob = await convertBufferToWav(slicedBuffer);
    const base64 = await blobToBase64(wavBlob);
    
    console.log('✅ Audio processed successfully:', {
      position,
      outputLength: remainingSamples / sampleRate
    });
    
    return base64;
  } catch (error) {
    console.error('❌ Error processing audio:', error);
    toaster.create({
      title: 'Error processing audio',
      type: 'error',
      duration: 2000,
    });
    throw error;
  }
};

/**
 * Convert AudioBuffer to WAV format
 */
const convertBufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
  // Create WAV header
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  
  // Create array buffer for WAV data
  const arrayBuffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(arrayBuffer);
  
  // Write WAV header
  writeString(dataView, 0, 'RIFF');
  dataView.setUint32(4, totalSize - 8, true);
  writeString(dataView, 8, 'WAVE');
  writeString(dataView, 12, 'fmt ');
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, 1, true);
  dataView.setUint16(22, numChannels, true);
  dataView.setUint32(24, sampleRate, true);
  dataView.setUint32(28, byteRate, true);
  dataView.setUint16(32, blockAlign, true);
  dataView.setUint16(34, bitsPerSample, true);
  writeString(dataView, 36, 'data');
  dataView.setUint32(40, dataSize, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const value = Math.max(-1, Math.min(1, sample));
      dataView.setInt16(offset, value * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

/**
 * Convert Blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Write string to DataView
 */
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}; 