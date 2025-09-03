import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState
} from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';//change
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection!: HubConnection;
  private readonly signalHubUrl = environment.signalHubUrl;

  private participants: any[] = [];
  private participantsSubject = new BehaviorSubject<string[]>([]);
  participants$ = this.participantsSubject.asObservable();//change

  constructor() {
    this.buildConnection();
    this.startConnection();
    this.registerReconnectionHandlers();
  }

  // Establishing the connection
  private buildConnection(): void {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.signalHubUrl, { withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();
  }

  // Start the connection and retry on failure
  private async startConnection(): Promise<void> {
    try {
      await this.hubConnection.start();
      console.log('✅ SignalR connected');
      this.registerParticipantsHandler(); //change
    } catch (error) {
      console.error('❌ SignalR start error:', error);
      setTimeout(() => this.startConnection(), 3000); // Retry
    }
  }

  private registerOnServerEvents() {
    this.hubConnection.on('UserJoined', (participant) => {
      this.participants.push(participant);
      this.participantsSubject.next(this.participants);
    });

    this.hubConnection.on('UserLeft', (connectionId: string) => {
      this.participants = this.participants.filter(p => p.connectionId !== connectionId);
      this.participantsSubject.next(this.participants);
    });
  }

  // Register events for reconnection and closure
  private registerReconnectionHandlers(): void {
    this.hubConnection.onreconnecting(error => {
      console.warn('🔁 SignalR reconnecting...', error);
    });

    this.hubConnection.onreconnected(connectionId => {
      console.log('✅ SignalR reconnected with connectionId:', connectionId);
    });

    this.hubConnection.onclose(error => {
      console.error('❌ SignalR connection closed:', error);
      this.startConnection(); // Retry
    });
  }

  private registerParticipantsHandler(): void {
    this.hubConnection.on('ParticipantsUpdated', (participants: string[]) => {
      console.log('👥 Participants updated:', participants);
      this.participantsSubject.next(participants);
    });
  }
  // Join the room with a role (doctor or patient)
  async joinRoom(roomId: string, role: string): Promise<void> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      try {
        // Validate role
        if (role !== 'doctor' && role !== 'patient') {
          throw new Error('Invalid role. Must be "doctor" or "patient".');
        }
        await this.hubConnection.invoke('JoinRoom', roomId, role);
        console.log(`✅ Joined room: ${roomId} as ${role}`);
      } catch (error) {
        console.error(`❌ Join room error (${roomId}):`, error);
      }
    } else {
      console.warn('⚠️ Cannot join room — SignalR not connected');
    }
  }

  // Get participants in a room
  async getParticipants(roomId: string): Promise<string[]> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      try {
        const participants = await this.hubConnection.invoke<string[]>('GetParticipantsInRoom', roomId);
        console.log(`👥 Participants in ${roomId}:`, participants);
        return participants;
      } catch (error) {
        console.error(`❌ Get participants error:`, error);
        return [];
      }
    } else {
      console.warn('⚠️ Cannot get participants — SignalR not connected');
      return [];
    }
  }

  // Send signaling data
  async sendSignal(roomId: string, senderId: string, signalData: any): Promise<void> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('SendSignal', roomId, senderId, signalData);
        console.log(`📡 Signal sent in ${roomId}`);
      } catch (error) {
        console.error(`❌ Signal send error (${roomId}):`, error);
      }
    }
  }

  async endCall(roomId: string): Promise<void> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      try {
        // Invoke the EndCall method first
        await this.hubConnection.invoke('EndCall', roomId);
        console.log(`📞 Call ended in ${roomId}`);

        // Stop the connection after the call is ended
        await this.hubConnection.stop();
        console.log('🔌 Connection stopped after ending the call');
      } catch (error) {
        console.error(`❌ End call error (${roomId}):`, error);
      }
    } else {
      console.warn('⚠️ Connection is not in the "Connected" state, cannot end call');
    }
  }

  // Get the current connection ID
  getConnectionId(): string | null {
    return this.hubConnection?.connectionId ?? null;
  }

  // Check if the connection is established
  isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }

  // Register a callback for receiving sng ignaling data
  onSignal(callback: (senderId: string, data: any) => void): void {
    this.hubConnection.on('ReceiveSignal', callback);
  }

  // Register a callback for when the call ends
  onCallEnded(callback: () => void): void {
    this.hubConnection.on('CallEnded', callback);
  }
}

