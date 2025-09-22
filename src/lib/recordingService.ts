import { getServerUrl } from "../config";
const SERVER_URL = getServerUrl();

export interface RecordingStatus {
  recordingSid: string;
  status: "in-progress" | "completed" | "failed" | "stopped" | "enqueued";
  duration?: number;
  size?: number;
  url?: string;
  roomSid?: string;
}

export class RecordingService {
  private static instance: RecordingService;
  private currentRecording: RecordingStatus | null = null;

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  async startRecording(roomSid: string): Promise<RecordingStatus> {
    try {
      const response = await fetch(`${SERVER_URL}/api/recording/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomSid: roomSid }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText}`);
      }

      const data = await response.json();
      this.currentRecording = data;
      console.log("Recording started:", data);
      return data;
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  async stopRecording(): Promise<RecordingStatus | null> {
    if (!this.currentRecording) {
      throw new Error("No active recording to stop");
    }

    try {
      const response = await fetch(`${SERVER_URL}/api/recording/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordingSid: this.currentRecording.recordingSid,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop recording: ${response.statusText}`);
      }

      const data = await response.json();
      this.currentRecording = { ...this.currentRecording, ...data };
      console.log("Recording stopped:", data);

      // If URL is not ready yet, poll status until it is available or failed/timeouts
      const hasUrl = !!data.url;
      const isCompleted = data.status === "completed";
      if (!hasUrl || !isCompleted) {
        const recordingSid = this.currentRecording!.recordingSid;
        const maxAttempts = 15; // ~30s
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const status = await this.getRecordingStatus(recordingSid);
            this.currentRecording = { ...this.currentRecording!, ...status };
            if (status.status === "completed" && status.url) {
              break;
            }
            if (status.status === "failed") {
              break;
            }
          } catch (e) {
            // continue polling on transient errors
          }
          await delay(2000);
        }
      }

      return this.currentRecording;
    } catch (error) {
      console.error("Error stopping recording:", error);
      throw error;
    }
  }

  async getRecordingStatus(recordingSid: string): Promise<RecordingStatus> {
    try {
      const response = await fetch(
        `${SERVER_URL}/api/recording/${recordingSid}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get recording status: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting recording status:", error);
      throw error;
    }
  }

  getCurrentRecording(): RecordingStatus | null {
    return this.currentRecording;
  }

  clearCurrentRecording(): void {
    this.currentRecording = null;
  }
}

export const recordingService = RecordingService.getInstance();
