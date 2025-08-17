import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { PlaylistTrackDto, CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdateThumbnailDto, UpdateTitleDto } from './dto/update-playlist.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('playlist')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post('create')
  create(@Body() createPlaylistDto: CreatePlaylistDto) {
    return this.playlistService.createPlaylist(
      createPlaylistDto,
      'e8d29e92-000d-4478-b8c4-41dafc556323',
    );
  }

  @Post('add-track')
  addTrack(@Body() trackDto: PlaylistTrackDto) {
    const { playlistId, trackId } = trackDto;
    return this.playlistService.addTrackToPlaylist(playlistId, trackId);
  }

  @Delete('delete')
  delete(@Param('id') id: string) {
    return this.playlistService.deletePlaylist(id);
  }

  @Delete('remove-track')
  removeTrack(@Body() deleteTrackDto: PlaylistTrackDto) {
    const { playlistId, trackId } = deleteTrackDto;
    return this.playlistService.removeTrackFromPlaylist(playlistId, trackId);
  }

  @Put('update-title')
  updateTitle(
    @Query()
    params: UpdateTitleDto,
  ) {
    return this.playlistService.updatePlaylistTitle(params);
  }

  @Put('update-thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  updateThumbnail(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateThumbnailDto,
  ) {
    return this.playlistService.updatePlaylistThumbnailWithFile(
      body.playlistId,
      file,
    );
  }

  @Get('all-tracks/:id')
  async getTracks(@Param('id') id: string) {
    return this.playlistService.getPlaylistTracksWithDetails(id);
  }

  @Get('all-playlists/:uid')
  async getPlaylist(@Param('uid') uid: string) {
    return this.playlistService.getAllPlaylistsWithTracksByUser(uid);
  }
}
