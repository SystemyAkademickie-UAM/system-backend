import { Controller, Get } from '@nestjs/common';
import { StudentService } from './student.service';

@Controller('student') // Pełny adres to /api/student
export class StudentController {
  
  constructor(private readonly studentService: StudentService) {}

  // Endpoint dla profilu (GET, bo tylko POBIERAMY dane)
  // Pełny adres: GET /api/student/profile
  @Get('profile')
  pobierzProfil() {
    // Prosimy serwis o nasze sztuczne dane i odsyłamy do Pawła
    return this.studentService.pobierzProfilStudenta();
  }
}
