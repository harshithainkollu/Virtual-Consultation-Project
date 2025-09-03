# Virtual-Consultation-Project
Virtual Consultation System – A modern telemedicine platform enabling secure doctor-patient interactions via real-time video/audio (WebRTC + SignalR). Features include encrypted chat, file &amp; image sharing, screen sharing, and session recording. Ideal for remote consultations, follow-ups, and second opinions.

**Workflow – Virtual Consultation System**
**Frontend (Angular)**

**1.DoctorComponent**

  Doctor logs in and clicks “Join Room”.

**2.RoomEntryComponent (Doctor Flow)**

  Assigns Doctor role.
  
  Generates a unique Room ID.
  
  Navigates to VideoRoomComponent.
  

**3.PatientComponent**

  Patient opens shared room link and enters name.

**4.RoomEntryComponent (Patient Flow)**

  Assigns Patient role.
  
  Routes patient to the same room using Room ID.

**5.VideoRoomComponent**

  Both participants join via SignalR (registering role & name).
  
  WebRTC establishes real-time video/audio streaming.

  Features:
  
  1.Encrypted chat
  
  2.Screen sharing
  
  3.File & image sharing
  
  4.Session recording (doctor only)
  
  5.Session cleanup on exit.

**Backend (ASP.NET Core)**

**1.SignalR Hub – WebRTCSignalHub.cs**

  Manages real-time signaling and session control.

  Main Methods:
  
  1.JoinRoom – Register user into room
  
  2.LeaveRoom – Remove user from room
  
  3.EndCall – End session for all participants

  4.SendSignal – Exchange WebRTC offers/answers

  5.SendIceCandidate – Share ICE candidates for connectivity
  
  6.SendMessage – Handle encrypted chat
  
  7.BroadcastParticipants – Update participant list

  Tracks:
  1.ConnectionId
  2.RoomId
  3.Name
  4.Role

**2.VirtualConsultationController.cs**

  Generates unique Room IDs for new sessions.
  Provides REST APIs for consultation flow.
  Handles secure file uploads/downloads via HTTP.


  **Outputs:**

  **Doctor component**
  
  <img width="400" height="433" alt="image" src="https://github.com/user-attachments/assets/3f436712-2153-44cd-af6d-f88c67926137" />

  **Patient Component**

  <img width="400" height="528" alt="image" src="https://github.com/user-attachments/assets/6713f675-5bd3-4f78-88ab-e8c2db8ad2cf" />

  **Video-room component**

  <img width="400" height="527" alt="image" src="https://github.com/user-attachments/assets/a4c6dd73-5fff-4f14-9f8c-1754ad24987f" />


  
