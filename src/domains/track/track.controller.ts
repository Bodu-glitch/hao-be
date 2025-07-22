import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException, Res, Req, NotFoundException, InternalServerErrorException, Query,
} from '@nestjs/common';
import { TrackService } from './track.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ReadStream, Stats } from 'fs';
import * as fs from 'node:fs';
import { Response, Request } from 'express';


@Controller('track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/assets/tracks',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${file.fieldname}-${uniqueSuffix}.${file.originalname.split('.').pop()}`;
        cb(null, fileName);
      }
    }),
    fileFilter: async (req, file, cb) => {
      console.log(file.mimetype);
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only support audio file'), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    }
  }))
  async create(@Body() createTrackDto: CreateTrackDto, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    console.log(file);
    // const fileType = await fileTypeFromBuffer(file.buffer)
    return await this.trackService.create(createTrackDto, file);
  }

  @Get('stream')
  async stream(
    @Query('filePath') filePath: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const music = `${__dirname}/../../../${filePath}`;
    console.log(`Streaming file: ${music}`);

    let stat: Stats;

    try {
      stat = fs.statSync(`${__dirname}/../../../${filePath}`);
    } catch (e) {
      throw new NotFoundException();
    }

    const range = req.headers.range;

    let readStream: ReadStream;

    if (range !== undefined) {
      const parts = range.replace(/bytes=/, '').split('-');

      const partialStart = parts[0];
      const partialEnd = parts[1];

      if ((isNaN(Number(partialStart)) && partialStart.length > 1) || (isNaN(Number(partialEnd)) && partialEnd.length > 1)) {
        throw new InternalServerErrorException('something went wrong'); //ERR_INCOMPLETE_CHUNKED_ENCODING
      }

      const start = parseInt(partialStart, 10);
      const end = partialEnd ? parseInt(partialEnd, 10) : stat.size - 1;
      const contentLength = (end - start) + 1;

      res.status(206).header({
        'Content-Type': 'audio/mpeg',
        'Content-Length': contentLength,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
      });

      readStream = fs.createReadStream(music, { start: start, end: end });
    } else {
      res.header({
        'Content-Type': 'audio/mpeg',
        'Content-Length': stat.size,
      });
      readStream = fs.createReadStream(music);
    }

    // await this.trackService.findAll()

    readStream.pipe(res);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trackService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTrackDto: UpdateTrackDto) {
    return this.trackService.update(+id, updateTrackDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trackService.remove(+id);
  }
}
