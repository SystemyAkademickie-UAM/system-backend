import { Controller, Post, Body } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups') // Pełny adres to /api/groups (dzięki ustawieniom w main.ts)
export class GroupsController {

  // Wstrzykujemy nasz serwis (czyli klasę z logiką) do kontrolera
  constructor(private readonly groupsService: GroupsService) { }

  // Endpoint 1: Prowadzący generuje kod
  // Pełny adres: POST /api/groups/generate-code
  @Post('generate-code')
  generujKod(@Body('typ') typ: string) {
    // Wywołujemy funkcję z serwisu i od razu odsyłamy jej wynik
    return this.groupsService.generujKod(typ);
  }

  // Endpoint 2: Student wpisuje kod żeby dołączyć
  // Pełny adres: POST /api/groups/join
  @Post('join')
  dolaczDoGrupy(@Body('kod') kod: string) {
    // Wywołujemy funkcję z serwisu z wpisanym kodem
    return this.groupsService.dolaczDoGrupy(kod);
  }
}
