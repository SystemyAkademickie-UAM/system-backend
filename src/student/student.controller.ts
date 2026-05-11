import { Controller, Get } from '@nestjs/common';
import { StudentService } from './student.service';

@Controller('student') // Pełny adres to /api/student
export class StudentController {
  
  constructor(private readonly studentService: StudentService) {}

  // Profile endpoint (GET, because we only FETCH data)
  // Full address: GET /api/student/profile
  @Get('profile')
  getProfile() {
    // Ask the service for mock data
    return this.studentService.getStudentProfile();
  }
}
