import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Icons')
@Controller('gamification/icons')
export class IconsController {
  /**
   * GET /gamification/icons
   * Returns a list of available SVG icons from the assets/icons directory.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available SVG icons' })
  getIcons() {
    const iconsDir = path.join(__dirname, '..', '..', 'assets', 'icons');
    try {
      const files = fs.readdirSync(iconsDir);
      return files
        .filter((f) => f.endsWith('.svg'))
        .map((f) => {
          // Generowanie czytelnej etykiety na podstawie nazwy pliku (np. "face-smile.svg" -> "Face smile")
          const label = f
            .replace('.svg', '')
            .replace(/-/g, ' ')
            .replace(/^./, (str) => str.toUpperCase());
          
          return {
            filename: f,
            name: label,
          };
        });
    } catch (e) {
      console.error('Failed to read icons directory', e);
      return [];
    }
  }
}
