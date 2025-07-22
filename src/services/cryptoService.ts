import CryptoJS from 'crypto-js';

export interface EncryptionResult {
  encryptedData: string;
  salt: string;
  iv: string;
}

export const cryptoService = {
  /**
   * Generate a key from password using PBKDF2
   */
  deriveKey(password: string, salt: string): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000
    });
  },

  /**
   * Encrypt data using AES with password
   */
  encrypt(data: string, password: string): EncryptionResult {
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const iv = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const key = this.deriveKey(password, salt);
    
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encryptedData: encrypted.toString(),
      salt,
      iv
    };
  },

  /**
   * Decrypt data using AES with password
   */
  decrypt(encryptedData: string, password: string, salt: string, iv: string): string {
    try {
      const key = this.deriveKey(password, salt);
      
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error('Invalid password or corrupted data');
      }
      
      return decryptedString;
    } catch (error) {
      throw new Error('Failed to decrypt: Invalid password or corrupted data');
    }
  }
};