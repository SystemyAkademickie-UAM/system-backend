import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InventoryHistoryItemDto {
  @ApiProperty({ description: 'ID operacji w systemie powiadomień' })
  id: number;

  @ApiProperty({ description: 'Typ operacji (SHOP_PURCHASE lub ITEM_USED)', enum: ['SHOP_PURCHASE', 'ITEM_USED'] })
  type: string;

  @ApiProperty({ description: 'Data operacji w formacie ISO' })
  date: string;

  @ApiProperty({ description: 'ID przedmiotu, którego dotyczy operacja' })
  itemId: number;

  @ApiPropertyOptional({ description: 'Oryginalna nazwa przedmiotu w momencie wykonania operacji' })
  itemName?: string;

  @ApiPropertyOptional({ description: 'Cena, za jaką dokonano zakupu (jeśli operacja to zakup)' })
  price?: number;

  @ApiPropertyOptional({ description: 'Czy przedmiot był dodatkowym życiem' })
  isExtraLife?: boolean;

  @ApiPropertyOptional({ description: 'Dodatkowa wiadomość / szczegóły akcji' })
  message?: string;
}
