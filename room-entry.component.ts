// room-entry.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-room-entry',
  standalone: true,
  template: '',
})
export class RoomEntryComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
     console.log('✅ RoomEntryComponent loaded successfully');
    const roomId = this.route.snapshot.paramMap.get('roomId');
    const role = this.route.snapshot.queryParamMap.get('role');

    if (role === 'patient') {
      this.router.navigate([`/room/${roomId}/patient`], { queryParams: { role } });
    } else {
      this.router.navigate([`/room/${roomId}/join`], {
        queryParams: { role: 'doctor', name: 'Doctor' },
      });
    }
  }
}
