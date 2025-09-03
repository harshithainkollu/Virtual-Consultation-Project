import * as CryptoJS from 'crypto-js';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EncryptionService {
  private secretKey = 'your-secure-secret-key'; // Use a secure key in production!

  encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, this.secretKey).toString();
  }

  decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
