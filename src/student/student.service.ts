import { Injectable } from '@nestjs/common';

@Injectable()
export class StudentService {
  
  // Zwracamy sztuczne dane (mocki) dla profilu studenta
  pobierzProfilStudenta() {
    return {
      zycia: 3,                 // Student ma 3 życia
      waluta: 1500,             // Waluta z tabeli statystyk
      ranga: 'Poczatkujacy',    // Jego ranga
      odznaki: ['Szybki Start'] // Pierwsza odznaka zdobyta
    };
  }
}
