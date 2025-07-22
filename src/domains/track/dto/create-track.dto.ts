import { IsString } from 'class-validator';

export class CreateTrackDto {
  @IsString(
    { message: 'Title must be a string' }
  )
  title: string;
}
