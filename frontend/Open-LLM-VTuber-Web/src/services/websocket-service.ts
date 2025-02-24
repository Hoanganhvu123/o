import { Subject } from 'rxjs';

export interface MessageEvent {
  type: string;
  text?: string;
  audio?: string;
  actions?: {
    expression?: string;
    motion?: string;
  };
  volumes?: number[];
  slice_length?: number;
  model_info?: any;
  conf_name?: string;
  conf_uid?: string;
  configs?: any[];
  messages?: any[];
  histories?: any[];
  history_uid?: string;
  success?: boolean;
  message?: string;
  files?: string[];
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<MessageEvent>();
  private stateSubject = new Subject<string>();
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3000;
  private currentUrl: string = '';

  getState(): string {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'CLOSED';
    }
  }

  connect(url: string) {
    // Nếu đang trong quá trình kết nối, bỏ qua
    if (this.isConnecting) {
      console.log('⏳ Đang trong quá trình kết nối, bỏ qua yêu cầu mới');
      return;
    }

    // Nếu đã kết nối và URL không đổi, bỏ qua
    if (this.ws?.readyState === WebSocket.OPEN && this.currentUrl === url) {
      console.log('✅ WebSocket đã được kết nối');
      return;
    }

    // Lưu URL hiện tại
    this.currentUrl = url;

    // Đánh dấu đang trong quá trình kết nối
    this.isConnecting = true;

    // Đóng kết nối cũ nếu có
    this.cleanup();

    console.log(`🔌 Kết nối tới WebSocket tại ${url}...`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket đã kết nối thành công');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.stateSubject.next('OPEN');
    };

    this.ws.onclose = () => {
      console.log('❌ WebSocket đã đóng');
      this.stateSubject.next('CLOSED');
      this.ws = null;

      // Chỉ thử kết nối lại nếu không phải do cleanup
      if (this.isConnecting) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Lỗi WebSocket:', error);
      this.stateSubject.next('ERROR');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageSubject.next(data);
      } catch (error) {
        console.error('❌ Lỗi parse message:', error);
      }
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Đã đạt giới hạn số lần thử kết nối lại');
      this.isConnecting = false;
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Thử kết nối lại lần ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.currentUrl);
    }, this.reconnectDelay);
  }

  private cleanup() {
    if (this.ws) {
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.ws.close();
      this.ws = null;
    }
  }

  disconnect() {
    console.log('🔌 Ngắt kết nối WebSocket...');
    this.cleanup();
  }

  sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket chưa kết nối, không thể gửi tin nhắn:', message);
    }
  }

  onMessage(handler: (message: MessageEvent) => void) {
    return this.messageSubject.subscribe(handler);
  }

  onStateChange(handler: (state: string) => void) {
    return this.stateSubject.subscribe(handler);
  }
}

export const wsService = new WebSocketService(); 