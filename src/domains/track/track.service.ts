import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Track } from './entities/track.entity';
import { parseBuffer, parseFile } from 'music-metadata';
import { inspect } from 'util';
import { join } from 'path';

@Injectable()
export class TrackService {
  constructor(@InjectRepository(Track) private trackRepository: Repository<Track>) {}

  async create(createTrackDto: CreateTrackDto, file: Express.Multer.File) {
    try {
      const filePath = join(process.cwd(),'public', 'assets', 'tracks', file.filename);
      const metadata= await parseFile(filePath, { duration: true });
      console.log(metadata);

      // write the file to the public/assets/tracks directory


      const track = this.trackRepository.create({
        title: createTrackDto.title,
        duration: metadata.format.duration,
        filePath: 'public/assets/tracks/' + file.filename,
      });
      return this.trackRepository.save(track);
    }catch (e) {
      throw new BadRequestException(e);
    }
  }

  findAll() {
    return `This action returns all track`;
  }

  findOne(id: number) {
    return `This action returns a #${id} track`;
  }

  update(id: number, updateTrackDto: UpdateTrackDto) {
    return `This action updates a #${id} track`;
  }

  remove(id: number) {
    return `This action removes a #${id} track`;
  }
}
