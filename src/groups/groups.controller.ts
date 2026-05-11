import { Controller, Post, Body } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups') // Pełny adres to /api/groups (dzięki ustawieniom w main.ts)
export class GroupsController {

  // Wstrzykujemy nasz serwis (czyli klasę z logiką) do kontrolera
  constructor(private readonly groupsService: GroupsService) { }

  // Endpoint 1: Lecturer generates a code
  // Full address: POST /api/groups/generate-code
  @Post('generate-code')
  generateCode(@Body('typ') type: string) {
    // Call the service function and return result
    return this.groupsService.generateCode(type);
  }

  // Endpoint 2: Student enters code to join
  // Full address: POST /api/groups/join
  @Post('join')
  joinGroup(@Body('kod') code: string) {
    // Call the service function with the provided code
    return this.groupsService.joinGroup(code);
  }
}
