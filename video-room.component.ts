import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { FileUploadService } from '../../services/file-upload service';
import * as CryptoJS from 'crypto-js';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

type MessageType = 'text' | 'image' | 'file';

interface ChatMessage {
  sender: string;
  type: MessageType;
  content: any;
}

interface Participant {
  connectionId: string;
  role: string;
  userName: string;
  isMicOn: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
}

@Component({
  selector: 'app-video-room',
  templateUrl: './video-room.component.html',
  imports: [CommonModule, FormsModule, NgIf, NgFor],
  styleUrls: ['./video-room.component.scss'],
})

export class VideoRoomComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: true }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: true }) remoteVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('chatBox') chatBox!: ElementRef;
  @ViewChild('chatInput') chatInput!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  chatMessage: string = '';
  messages: ChatMessage[] = [];

  roomId: string = '';
  role: string = 'patient';

  screenRecorder: MediaRecorder | null = null;
  screenTrack: MediaStreamTrack | null = null;
  screenRecordingChunks: Blob[] = [];
  isScreenRecording: boolean = false;
  recordingStream: MediaStream | null = null;
  recordingTrack: MediaStreamTrack | null = null;

  selectedFile: File | null = null;
  selectedFilePreviewUrl: string | null = null;
  previewImageUrl: string | null = null;

  isChatOpen: boolean = false;
  isParticipantsOpen: boolean = false;

  participants: Participant[] = [];
  userName: string = '';

  isRemoteScreenSharing = false;

  unreadMessagesCount = 0;

  showRoomLinkPopupBox: boolean = false;
  patientLink: string = '';

  toggleRoomLinkPopup() {
    this.showRoomLinkPopupBox = !this.showRoomLinkPopupBox;
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.patientLink).then(
      // () => alert('Link copied to clipboard!'),
      // () => alert('Failed to copy link.')
    );
  }


  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.isParticipantsOpen = false;
      this.unreadMessagesCount = 0;
    }
  }

  toggleParticipants() {
    this.isParticipantsOpen = !this.isParticipantsOpen;
    if (this.isParticipantsOpen) {
      this.isChatOpen = false;
    }
  }

  public hubConnection!: signalR.HubConnection;
  private localStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private readonly signalHubUrl = environment.signalHubUrl;

  private iceCandidateQueue: RTCIceCandidate[] = [];
  private remoteDescriptionSet: boolean = false;

  private secretKey = 'yira-secret-key-123';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fileUploadService: FileUploadService,
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.roomId = params.get('roomId') || '';
    });

    this.route.queryParamMap.subscribe(queryParams => {
      const roleParam = queryParams.get('role');
      const nameParam = queryParams.get('name');


      this.role = roleParam === 'doctor' ? 'doctor' : 'patient';

      let storedName = 'anonymous';
      const LoginDetails = localStorage.getItem('LoginDetails');

      if (LoginDetails) {
        try {
          const parsed = JSON.parse(LoginDetails);
          storedName = parsed.name || 'anonymous';
        } catch (error) {
          console.error('Error parsing loginDetails from localStorage:', error);
        }
      }

      this.userName = this.role === 'doctor' ? storedName : (nameParam || 'anonymous');

      console.log('Role:', this.role);
      console.log('User Name:', this.userName);

      if (!this.roomId) {
        console.error('Room ID is missing!');
        return;
      }

      const baseUrl = window.location.origin;
      this.patientLink = `${baseUrl}/room/${this.roomId}?role=patient`;

      this.startConnection(); // Start SignalR connection
    });
  }

  getRoleForUserName(userName: string): string {
    return userName.toLowerCase().includes('doctor') ? 'doctor' : 'patient';
  }

  async startConnection() {
    console.log('Starting SignalR connection...');
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.signalHubUrl)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ExistingUsers', async (existingUsers: { connectionId: string; userName: string; role: string }[]) => {
      console.log('Existing users in the room:', existingUsers);
      console.log(this.userName)

      this.participants = existingUsers.map(user => ({
        connectionId: user.connectionId,
        role: this.getRoleForUserName(user.userName),
        userName: user.userName,
        isMicOn: true,
        isVideoOn: true,
        isScreenSharing: false,
        isRecording: false
      }));


      if (this.role === 'doctor') {
        for (const userId of existingUsers) {
          console.log(`Sending offer to existing user: ${userId}`);
          // Create a new peer connection if you're handling multiple peers
          // For now, assuming single peerConnection
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);

          this.sendSignal({
            type: 'offer',
            sdp: offer.sdp,
          });
        }
      }
    });

    this.hubConnection.on('ParticipantsUpdated', (participants: { connectionId: string; userName: string }[]) => {
      console.log('Participants updated:', participants);

      this.participants = participants.map(p => ({
        connectionId: p.connectionId,
        role: this.getRoleForUserName(p.userName),
        userName: p.userName,
        isMicOn: true,
        isVideoOn: true,
        isScreenSharing: false,
        isRecording: false
      }));

      if (this.hubConnection.connectionId && !this.participants.find(p => p.connectionId === this.hubConnection.connectionId)) {
        this.participants.push({
          connectionId: this.hubConnection.connectionId,
          role: this.role,
          userName: this.userName,
          isMicOn: true,
          isVideoOn: true,
          isScreenSharing: false,
          isRecording: false
        });
      }

      console.log('Updated participants list:', this.participants);
    });

    this.hubConnection.on('ReceiveSignal', async (senderId, signal) => {
      console.log('Received signal from peer:', signal);
      try {
        if (signal.type === 'offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
          this.remoteDescriptionSet = true;
          this.iceCandidateQueue.forEach(candidate => this.peerConnection.addIceCandidate(candidate));
          this.iceCandidateQueue = [];
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          this.sendSignal(answer);
        } else if (signal.type === 'answer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
          this.remoteDescriptionSet = true;
          this.iceCandidateQueue.forEach(candidate => this.peerConnection.addIceCandidate(candidate));
          this.iceCandidateQueue = [];
        } else if (signal.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate);
          if (this.remoteDescriptionSet) {
            await this.peerConnection.addIceCandidate(candidate);
          } else {
            console.log('Queuing ICE candidate until remote description is set.');
            this.iceCandidateQueue.push(candidate);
          }
        } else if (signal.type === 'media-toggle') {
          this.handleMediaToggle(senderId, signal);
        } else if (signal.type === 'screen-share-toggle') {
          const participant = this.participants.find(p => p.connectionId === senderId);
          if (participant) {
            participant.isScreenSharing = signal.isScreenSharing;
            this.participants = [...this.participants];

            if (senderId !== this.hubConnection.connectionId) {
              this.isRemoteScreenSharing = signal.isScreenSharing;
            }
          }
        } else if (signal.type === 'record-toggle') {
          const participant = this.participants.find(p => p.connectionId === senderId);
          if (participant) {
            participant.isRecording = signal.isRecording;
            this.participants = [...this.participants];
          }
        }

      } catch (error) {
        console.error('Error handling incoming signal:', error);
      }
    });

    this.hubConnection.on('ReceiveChatMessage', (message: ChatMessage) => {
      // console.log('Encrypted received message:', message.content);

      const decryptedContent = this.decryptMessage(message.content);
      // console.log('Decrypted received message:', decryptedContent);

      const decryptedMessage = { ...message, content: decryptedContent };
      this.messages.push(decryptedMessage);

      if (!this.isChatOpen) {
        this.unreadMessagesCount++;
      }
      setTimeout(() => this.scrollChatToBottom(), 0);
    });


    this.hubConnection.on('CallEnded', () => {
      alert('Call ended by the other participant.');
      this.cleanup();
      this.router.navigate(['']);
    });

    this.hubConnection.on('UserJoined', async (connectionId: string) => {
      console.log(`User joined room with ConnectionId: ${connectionId}`);
      this.participants.push({
        connectionId, role: this.role, userName: this.userName, isMicOn: true,
        isVideoOn: true, isScreenSharing: false, isRecording: false
      });

      this.hubConnection.on('UserLeft', (connectionId: string) => {
        console.log(`User left: ${connectionId}`);
        this.participants = this.participants.filter(p => p.connectionId !== connectionId);
      });

      if (this.role === 'doctor') {
        console.log('Patient joined, doctor initiating offer...');
        try {
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          this.sendSignal(offer);
        } catch (error) {
          console.error('Error initiating offer after user joined:', error);
        }
      }
    });

    try {
      await this.hubConnection.start();
      console.log('SignalR connected.');

      await this.setupWebRTC();

      await this.hubConnection.invoke('JoinRoom', this.roomId, this.userName, this.role);
      console.log('Joined room:', this.roomId);

    } catch (error) {
      console.error('Error connecting to SignalR hub:', error);
    }

  }

  async setupWebRTC() {
    console.log('Setting up WebRTC...');
    this.peerConnection = new RTCPeerConnection();

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate...');
        this.sendSignal({ candidate: event.candidate.toJSON() });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track.');
      const remoteStream = event.streams[0];
      if (this.remoteVideo.nativeElement.srcObject !== remoteStream) {
        this.remoteVideo.nativeElement.srcObject = remoteStream;
        console.log('Remote stream set to video element');
      }
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localVideo.nativeElement.srcObject = this.localStream;

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      console.log('Local media stream ready.');
    } catch (err) {
      console.error('Failed to access media devices:', err);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  sendSignal(signal: any) {
    if (!this.hubConnection) {
      console.warn('Hub connection not ready.');
      return;
    }
    console.log('Sending signal to peers:', signal);
    this.hubConnection.invoke('SendSignal', this.roomId, this.hubConnection.connectionId, signal);
  }

  encryptMessage(message: string): string {
    return CryptoJS.AES.encrypt(message, this.secretKey).toString();
  }

  decryptMessage(encryptedMessage: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, this.secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  isAudioOn: boolean = true;
  isVideoOn: boolean = true;

  toggleMute() {
    if (!this.localStream) {
      console.warn('Cannot mute — localStream not ready.');
      return;
    }

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
      this.isAudioOn = track.enabled;
      console.log('Audio track enabled:', track.enabled);
    });

    const me = this.participants.find(p => p.connectionId === this.hubConnection.connectionId);
    if (me) {
      me.isMicOn = this.isAudioOn;
    }

    this.sendMediaToggleSignal();
  }

  toggleVideo() {
    if (!this.localStream) {
      console.warn('Cannot toggle video — localStream not ready.');
      return;
    }

    const isVideoEnabled = this.localStream.getVideoTracks()[0].enabled;
    const newEnabledState = !isVideoEnabled;

    this.localStream.getVideoTracks().forEach(track => {
      track.enabled = newEnabledState;
      this.isVideoOn = track.enabled;
      console.log('Video track enabled:', track.enabled);
    });

    const me = this.participants.find(p => p.connectionId === this.hubConnection.connectionId);
    if (me) {
      me.isVideoOn = this.isVideoOn;
    }

    this.sendMediaToggleSignal();
  }

  sendMediaToggleSignal() {
    const isAudioEnabled = this.localStream.getAudioTracks()[0].enabled;
    const isVideoEnabled = this.localStream.getVideoTracks()[0].enabled;

    this.sendSignal({
      type: 'media-toggle',
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
    });
  }

  sendScreenShareToggleSignal(isSharing: boolean) {
    this.sendSignal({
      type: 'screen-share-toggle',
      isScreenSharing: isSharing,
    });
  }

  sendRecordToggleSignal(isRecording: boolean) {
    this.sendSignal({
      type: 'record-toggle',
      isRecording: isRecording,
    });
  }

  handleMediaToggle(senderId: string, signal: { audioEnabled: boolean; videoEnabled: boolean }) {
    const participant = this.participants.find(p => p.connectionId === senderId);
    if (participant) {
      participant.isMicOn = signal.audioEnabled;
      participant.isVideoOn = signal.videoEnabled;
    }

    if (this.remoteVideo.nativeElement.srcObject) {
      const remoteStream = this.remoteVideo.nativeElement.srcObject as MediaStream;

      const remoteVideoTrack = remoteStream.getVideoTracks()[0];
      if (remoteVideoTrack) {
        remoteVideoTrack.enabled = signal.videoEnabled;
        this.remoteVideo.nativeElement.srcObject = null;
        this.remoteVideo.nativeElement.srcObject = remoteStream;
      }

      const remoteAudioTrack = remoteStream.getAudioTracks()[0];
      if (remoteAudioTrack) {
        remoteAudioTrack.enabled = signal.audioEnabled;
      }
    }
  }

  async toggleScreenShare() {
    if (!this.peerConnection) {
      console.warn('No peer connection to share screen.');
      return;
    }

    const me = this.participants.find(p => p.connectionId === this.hubConnection.connectionId);

    // 🔴 Stop screen share if it's already active
    if (me?.isScreenSharing && this.screenTrack) {
      const originalTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(originalTrack);
      }

      this.screenTrack.stop();
      this.screenTrack = null;

      me.isScreenSharing = false;
      this.participants = [...this.participants];
      this.sendScreenShareToggleSignal(false);

      console.log('Screen sharing stopped, switched back to camera.');
      return;
    }

    // 🟢 Start screen sharing
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      this.screenTrack = screenStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');

      if (sender) {
        sender.replaceTrack(this.screenTrack);

        if (me) {
          me.isScreenSharing = true;
          this.participants = [...this.participants];
        }

        this.sendScreenShareToggleSignal(true);

        console.log('Screen sharing started.');

        this.screenTrack.onended = () => {
          this.toggleScreenShare();
        };
      }
    } catch (err) {
      console.error('Screen sharing failed:', err);
    }
  }

  endCall() {
    console.log('Ending call...');
    this.hubConnection.invoke('EndCall', this.roomId);
    this.cleanup();
    this.router.navigate(['']);
  }

  cleanup() {
    console.log('Cleaning up call resources...');
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    this.hubConnection?.stop();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  sendMessage() {
    const trimmedMessage = this.chatMessage.trim();
    const file = this.selectedFile;

    if (file) {
      const fileType: MessageType = file.type.startsWith('image/') ? 'image' : 'file';

      this.fileUploadService.upload(file).subscribe((url: string) => {
        const fileMessage: ChatMessage = {
          sender: this.role,
          type: fileType,
          // content: url,
          content: this.encryptMessage(url),
        };

        this.hubConnection.invoke('SendChatMessage', this.roomId, fileMessage.sender, fileMessage.type, fileMessage.content);
        setTimeout(() => this.scrollChatToBottom(), 0);
      });

      this.removeSelectedFile();
    }

    if (trimmedMessage !== '') {
      const encryptedContent = this.encryptMessage(trimmedMessage);
      // console.log('Encrypted message:', encryptedContent);
      const textMessage: ChatMessage = {
        sender: this.role,
        type: 'text',
        content: encryptedContent,
      };

      // console.log('Sending encrypted message:', encryptedContent);
      this.hubConnection.invoke('SendChatMessage', this.roomId, textMessage.sender, textMessage.type, textMessage.content);
      this.chatMessage = '';
      setTimeout(() => this.scrollChatToBottom(), 0);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.selectedFile = file;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedFilePreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFilePreviewUrl = null;
    }

    if (this.chatInput?.nativeElement) {
      this.chatInput.nativeElement.focus();
    }

    const keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.sendMessage();
        window.removeEventListener('keydown', keyListener);
      }
    };

    window.addEventListener('keydown', keyListener);
  }

  removeSelectedFile() {
    this.selectedFile = null;
    this.selectedFilePreviewUrl = null;

    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  scrollChatToBottom() {
    if (this.chatBox && this.chatBox.nativeElement) {
      const el = this.chatBox.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  closeChat() {
    this.isChatOpen = false;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatMessageContent(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  startOrStopScreenRecording() {
    if (!this.isScreenRecording) {
      this.startScreenRecording();
    } else {
      this.stopScreenRecording();
    }
  }

  async startScreenRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      this.recordingStream = screenStream;
      this.screenRecordingChunks = [];

      this.screenRecorder = new MediaRecorder(screenStream);
      this.screenRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.screenRecordingChunks.push(event.data);
        }
      };

      this.screenRecorder.onstop = () => {
        const blob = new Blob(this.screenRecordingChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'screen-recording.webm';
        a.click();

        URL.revokeObjectURL(url);
      };

      this.screenRecorder.start();
      this.isScreenRecording = true;

      const me = this.participants.find(p => p.connectionId === this.hubConnection.connectionId);
      if (me) {
        me.isRecording = true;
        this.participants = [...this.participants];
      }

      // ✅ Notify others
      this.sendRecordToggleSignal(true);

      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenRecording();
      });

    } catch (error) {
      console.error('Error starting screen recording:', error);
    }
  }

  stopScreenRecording() {
    if (this.screenRecorder && this.isScreenRecording) {
      this.screenRecorder.stop();
      this.isScreenRecording = false;

      const me = this.participants.find(p => p.connectionId === this.hubConnection.connectionId);
      if (me) {
        me.isRecording = false;
        this.participants = [...this.participants];
      }

      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach(track => track.stop());
        this.recordingStream = null;
      }

      this.sendRecordToggleSignal(false);
    }
  }

  openImagePreview(url: string) {
    this.previewImageUrl = url;
  }

  closeImagePreview() {
    this.previewImageUrl = null;
  }

}