import { Injectable } from '@nestjs/common';

@Injectable()
export class StudentService {

  // Returns mock data for the student profile
  getStudentProfile() {
    return {
      id: 1,
      imie: 'Jacek',
      nazwisko: 'Testowy',
      album: '123456',
      email: 'student.test@st.amu.edu.pl',
      rola: 1,                 // Student role
      zycia: 3,                 // Remaining lives
      waluta: 1500,             // Currency
      ranga: 'Poczatkujacy',    // Rank
      odznaki: ['Szybki Start'] // Earned badges
    };
  }
}
