import { Injectable } from '@nestjs/common';

@Injectable()
export class GroupsService {
  
  // Funkcja do generowania losowego kodu
  generujKod(typ: string) {
    // Generujemy prosty 6-znakowy kod
    const znaki = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let kod = '';
    for (let i = 0; i < 6; i++) {
      kod += znaki.charAt(Math.floor(Math.random() * znaki.length));
    }
    
    return {
      wiadomosc: 'Udalo sie wygenerowac kod',
      kod: kod,
      typ: typ // np. 'jednorazowy' lub 'staly'
    };
  }

  // Funkcja do sprawdzania kodu i dołączania do grupy
  dolaczDoGrupy(kod: string) {
    // Na razie udajemy, że sprawdzamy w bazie
    if (kod.length === 6) {
      return {
        sukces: true,
        wiadomosc: `Pomyslnie dolaczono do grupy za pomoca kodu: ${kod}`
      };
    } else {
      return {
        sukces: false,
        wiadomosc: 'Blad: Kod musi miec dokladnie 6 znakow!'
      };
    }
  }
}
