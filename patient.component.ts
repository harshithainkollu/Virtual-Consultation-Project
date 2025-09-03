import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { RouterModule } from '@angular/router'; 
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-patient',
   standalone: true,
  imports: [FormsModule, RouterModule], //
  templateUrl: './patient.component.html',
  styleUrls: ['./patient.component.scss']
})
export class PatientComponent implements OnInit {
  name = '';

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // console.log('✅ DoctorComponent loaded successfully');
    const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.display = 'none'; // Hides the logo screen
  }
  }

  joinRoom() {
    const roomId = this.route.snapshot.paramMap.get('roomId');
    const role = this.route.snapshot.queryParamMap.get('role') || 'patient';

    if (this.name.trim()) {
      this.router.navigate([`/patient-room/${roomId}/join`], {
        queryParams: { name: this.name.trim(), role }
      });
    }
  }

}
