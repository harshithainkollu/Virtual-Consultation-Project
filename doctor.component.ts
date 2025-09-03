import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-doctor',
  standalone: true,
  templateUrl: './doctor.component.html',
  styleUrls: ['./doctor.component.scss'],
  imports: [NgIf],
})
export class DoctorComponent implements OnInit {
  patientLink: string = '';
  roomId: string = '';
  errorMessage: string = '';

  constructor(private http: HttpClient, public router: Router) { }

  ngOnInit(): void {
    console.log('✅ DoctorComponent loaded successfully');
    const preloader = document.getElementById('preloader');
    if (preloader) {
      preloader.style.display = 'none'; // Hides the logo screen
    }
  }

  startVideoCall() {
    this.http.get<any>(environment.openApiUrl + '/api/VirtualConsultation/generate-room?role=patient').subscribe({
      next: (response) => {
        this.roomId = response.roomId;
        const baseUrl = window.location.origin;
        this.patientLink = `${baseUrl}/room/${this.roomId}?role=patient`; // sent to patient
      },
      error: (error) => {
        console.error('Error generating room:', error);
        this.errorMessage = 'An error occurred while generating the room. Please try again later.';
      }
    });
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.patientLink).then(
      () => this.showToast('Link copied to clipboard!'),
      (err) => {
        console.error('Error copying link:', err);
        this.showToast('Failed to copy link.');
      }
    );
  }

  joinRoomAsDoctor() {
    if (this.roomId) {
      this.router.navigate([`/room/${this.roomId}`], { queryParams: { role: 'doctor' } });
    }
  }

  private showToast(message: string): void {
    alert(message); // Simple alert; replace with a toast in production
  }
}
