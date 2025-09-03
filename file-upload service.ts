import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private uploadUrl = environment.openApiUrl +'/api/VirtualConsultation/upload';

  constructor(private http: HttpClient) { }

  upload(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);

    // Get the login details object JSON string from localStorage
    const LoginDetailsString = localStorage.getItem('LoginDetails'); // or whatever key you use
    let userName = 'anonymous';

    if (LoginDetailsString) {
      try {
        const loginDetails = JSON.parse(LoginDetailsString);
        if (loginDetails && loginDetails.name) {
          userName = loginDetails.name;
        }
      } catch (e) {
        console.error('Error parsing loginDetails from localStorage', e);
      }
    }

    formData.append('userName', userName);

    return this.http.post<any[]>(this.uploadUrl, formData).pipe(
      map(response => {
        if (Array.isArray(response) && response.length > 0 && response[0].fileUrl) {
          console.log(response[0].fileUrl);
          return response[0].fileUrl;
        }
        throw new Error('Invalid upload response');
      })
    );
  }


}
