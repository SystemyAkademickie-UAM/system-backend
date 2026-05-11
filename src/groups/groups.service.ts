import { Injectable } from '@nestjs/common';

@Injectable()
export class GroupsService {
  
  // Function to generate a random code
  generateCode(type: string) {
    // Generate a simple 6-character code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return {
      wiadomosc: 'Udalo sie wygenerowac kod',
      kod: code,
      typ: type // e.g. 'one-time' or 'permanent'
    };
  }

  // Function to check code and join group
  joinGroup(code: string) {
    // Mocking database check
    if (code.length === 6) {
      return {
        sukces: true,
        wiadomosc: `Pomyslnie dolaczono do grupy za pomoca kodu: ${code}`
      };
    } else {
      return {
        sukces: false,
        wiadomosc: 'Blad: Kod musi miec dokladnie 6 znakow!'
      };
    }
  }
}
