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
  BadRequestException,
  Res,
  Req,
  NotFoundException,
  InternalServerErrorException,
  Query,
  UploadedFiles,
} from '@nestjs/common';
import { TrackService } from './track.service';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ReadStream, Stats } from 'fs';
import * as fs from 'node:fs';
import { Response, Request } from 'express';
import { finished } from 'stream/promises';
import { supabase } from '../../utils/supbabase';
import { parseFile } from 'music-metadata';
import { getAudioDuration } from '../../utils/hls-converter';

@Controller('track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: './public/assets/tracks',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileName = `${file.fieldname}-${uniqueSuffix}.${file.originalname.split('.').pop()}`;
          cb(null, fileName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async create(
    @Body() createTrackDto: CreateTrackDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Res() res: Response,
  ) {
    if (!files) {
      throw new BadRequestException('File is required');
    }
    const trackId = createTrackDto.trackId!;
    const nameDir = `public/assets/chunks/${trackId}`;

    if (!fs.existsSync(nameDir)) {
      fs.mkdirSync(nameDir);
    }

    fs.cpSync(files[0].path, `${nameDir}/${createTrackDto.trackName}`);

    fs.rmSync(files[0].path);

    res.status(201).json({
      message: 'Track uploaded successfully',
      trackId: createTrackDto.trackId,
      trackName: createTrackDto.trackName,
    });
  }

  @Post('merge')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      fileFilter(
        req: any,
        file: {
          fieldname: string;
          originalname: string;
          encoding: string;
          mimetype: string;
          size: number;
          destination: string;
          filename: string;
          path: string;
          buffer: Buffer;
        },
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) {
        // Validate thumbnail file type
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024, // 5MB limit for thumbnail
      },
    }),
  )
  async merge(
    @Query('trackId') trackId: string,
    @Query('trackName') trackName: string,
    @Query('categoryId') categoryId: string,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    const nameDir = `public/assets/chunks/${trackId}`;
    if (!fs.existsSync(nameDir)) {
      throw new BadRequestException('Video chunks directory does not exist');
    }

    if (!trackId || !trackName || !categoryId) {
      throw new BadRequestException(
        'trackId, trackName, and categoryId are required',
      );
    }

    // Ensure the directory exists
    const files = fs
      .readdirSync(nameDir)
      .filter((f) => f.endsWith('.mp4') || f.includes('.part'))
      .sort((a, b) => {
        const aIndex = parseInt(a.split('.part')[1] || '0', 10);
        const bIndex = parseInt(b.split('.part')[1] || '0', 10);
        return aIndex - bIndex;
      });

    if (files.length === 0) {
      throw new BadRequestException('No track chunks found to merge');
    }

    const originalFileName = files[0].split('.part')[0];
    const mergedFilePath = `public/assets/tracks/${trackId}/${originalFileName}`;
    fs.mkdirSync(`public/assets/tracks/${trackId}`, { recursive: true });

    const writeStream = fs.createWriteStream(mergedFilePath);

    for (const file of files) {
      const filePath = `${nameDir}/${file}`;
      const readStream = fs.createReadStream(`${filePath}`);
      readStream.pipe(writeStream, { end: false });
      await finished(readStream); // ensure one finishes before starting next
    }

    writeStream.end();

    // Clean up chunks directory
    fs.rmSync(nameDir, { recursive: true, force: true });

    // convert to HLS
    console.log(
      'mergedFilePath =',
      mergedFilePath,
      'exists =',
      fs.existsSync(mergedFilePath),
    );

    let output: string;

    try {
      output = await this.trackService.convertToAac(mergedFilePath, {});
    } catch (err) {
      throw new BadRequestException(
        'Failed to convert track to AAC format: ' + err.message,
      );
    }

    // read buffer of the output file
    if (!fs.existsSync(output)) {
      throw new NotFoundException('Converted track file not found');
    }

    // thumknail upload
    let thumbnailPath!: string;
    if (thumbnail) {
      const { data: thumbnailData, error: thumbnailError } =
        await supabase.storage
          .from('thumbnail')
          .upload(`${trackId}/thumbnail.jpg`, thumbnail.buffer, {
            contentType: thumbnail.mimetype,
            upsert: true,
          });

      if (thumbnailError) {
        throw new BadRequestException(thumbnailError);
      }
      thumbnailPath = thumbnailData.path;
    }

    //Push to supabase storage named tracks
    const { data: track, error } = await supabase.storage
      .from('tracks')
      .upload(`${trackId}/${trackId}.aac`, fs.readFileSync(output), {
        contentType: 'audio/aac',
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(error);
    }

    // Get audio metadata for duration use ffmpeg

    const duration = await getAudioDuration(output);

    // Create track record in database
    const savedTrack = await this.trackService.create(
      { trackId: trackId, trackName: trackName },
      categoryId,
      'bb86ff93-57ac-4169-8fe9-12f0746e3c93',
      track?.path || '',
      duration,
      thumbnailPath,
    );

    // Clean up local files
    fs.unlinkSync(output);
    fs.rmSync(`public/assets/tracks/${trackId}`, {
      recursive: true,
      force: true,
    });

    return savedTrack;
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
