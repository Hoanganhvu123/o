/**
 * Simple audio task queue manager
 */
class AudioTaskQueue {
  private isProcessing: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;

  /**
   * Stop current audio playback
   */
  stopCurrentAudio() {
    if (this.currentAudio) {
      console.log('⏹️ Dừng và reset audio element');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0; // Reset position
      this.currentAudio = null;
    }
    this.isProcessing = false;
  }

  /**
   * Set processing state
   */
  setProcessing(state: boolean) {
    this.isProcessing = state;
    console.log(`🔄 Audio processing state: ${state}`);
  }

  /**
   * Get current processing state
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Check if there's an active task
   */
  hasTask(): boolean {
    return this.isProcessing || this.currentAudio !== null;
  }

  /**
   * Set current audio element
   */
  setCurrentAudio(audio: HTMLAudioElement | null) {
    if (this.currentAudio && audio !== this.currentAudio) {
      console.log('⏹️ Dừng audio cũ trước khi set audio mới');
      this.stopCurrentAudio();
    }
    this.currentAudio = audio;
  }
}

// Export singleton instance
export const audioTaskQueue = new AudioTaskQueue(); 