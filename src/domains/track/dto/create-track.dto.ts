import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateTrackDto {
  @IsNotEmpty()
  @IsUUID()
  trackId: string;

  @IsNotEmpty()
  @IsString()
  trackName: string;
}
