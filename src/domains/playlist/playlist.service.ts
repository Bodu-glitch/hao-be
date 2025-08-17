import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdateTitleDto } from './dto/update-playlist.dto';
import { supabase } from '../../utils/supbabase';

@Injectable()
export class PlaylistService {
  async createPlaylist(createPlaylistDto: CreatePlaylistDto, userId: string) {
    const { data, error } = await supabase
      .from('playlist')
      .insert({
        title: createPlaylistDto.title,
        thumbnailPath:
          'https://cajbdmrbdoctltruejun.supabase.co/storage/v1/object/public/thumbnail/492a1aa6-ab7f-4cc6-befc-c8a809db7f3b/thumbnail.jpg',
        profileId: userId,
      })
      .select();

    if (error) {
      console.log(error);
      throw new BadRequestException('Failed to create playlist');
    }

    return data[0];
  }

  async addTrackToPlaylist(playlistId: string, trackId: string) {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .insert({
        playlistId: playlistId,
        trackId: trackId,
      })
      .select();

    if (error) {
      throw new BadRequestException(error);
    }

    return data[0];
  }

  async deletePlaylist(id: string) {
    const { error } = await supabase
      .from('playlist')
      .delete()
      .eq('id', id)
      .select();
    if (error) {
      throw new BadRequestException('Failed to delete playlist');
    }
    return { message: 'Playlist deleted successfully' };
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlistId', playlistId)
      .eq('trackId', trackId);

    if (error) {
      throw new BadRequestException(error);
    }

    return { message: 'Track removed from playlist successfully' };
  }

  async updatePlaylistTitle(updateTitleDto: UpdateTitleDto) {
    const { data, error } = await supabase
      .from('playlist')
      .update({ title: updateTitleDto.title })
      .eq('id', updateTitleDto.playlistId)
      .select();

    if (error) {
      throw new BadRequestException(error);
    }

    return data[0];
  }

  async updatePlaylistThumbnailWithFile(
    playlistId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const bucket = 'thumbnail';
    const folder = `${playlistId}`;
    // 1. List files in the folder
    const { data: listData, error: listError } = await supabase.storage
      .from(bucket)
      .list(folder);
    if (listError) {
      throw new BadRequestException('Failed to list thumbnails');
    }
    // 2. Delete old thumbnail if exists
    if (listData && listData.length > 0) {
      const filesToDelete = listData.map((f) => `${folder}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove(filesToDelete);
      if (deleteError) {
        throw new BadRequestException('Failed to delete old thumbnail');
      }
    }
    // 3. Upload new file
    const ext = file.originalname.split('.').pop();
    const filename = `thumbnail.${ext}`;
    const path = `${folder}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (uploadError) {
      throw new BadRequestException('Failed to upload new thumbnail');
    }
    // 4. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;
    // 5. Update DB
    const { data: updateData, error: updateError } = await supabase
      .from('playlist')
      .update({ thumbnailPath: publicUrl })
      .eq('id', playlistId)
      .select();
    if (updateError) {
      throw new BadRequestException('Failed to update playlist thumbnail');
    }
    return updateData[0];
  }

  async getPlaylistTracksWithDetails(playlistId: string) {
    // 1. Get playlist info
    const { data: playlistData, error: playlistError } = await supabase
      .from('playlist')
      .select('*')
      .eq('id', playlistId)
      .single();
    if (playlistError || !playlistData) {
      throw new BadRequestException('Playlist not found');
    }
    // 2. Get all playlist_tracks for this playlist
    const { data: playlistTracks, error: playlistTracksError } = await supabase
      .from('playlist_tracks')
      .select('trackId')
      .eq('playlistId', playlistId);
    if (playlistTracksError) {
      throw new BadRequestException('Failed to get playlist tracks');
    }
    const trackIds = playlistTracks.map((pt) => pt.trackId);
    if (trackIds.length === 0) {
      return { ...playlistData, tracks: [] };
    }
    // 3. Get all tracks with full details
    const { data: tracks, error: tracksError } = await supabase
      .from('track')
      .select('*')
      .in('id', trackIds);
    if (tracksError) {
      throw new BadRequestException('Failed to get tracks');
    }
    return { ...playlistData, tracks };
  }

  async getAllPlaylistsWithTracksByUser(uid: string) {
    // 1. Get all playlists for the user
    const { data: playlists, error: playlistsError } = await supabase
      .from('playlist')
      .select('*')
      .eq('profileId', uid);
    if (playlistsError) {
      throw new BadRequestException('Failed to get playlists');
    }
    if (!playlists || playlists.length === 0) {
      return [];
    }
    const playlistIds = playlists.map((p) => p.id);
    // 2. Get all playlist_tracks for these playlists
    const { data: playlistTracks, error: playlistTracksError } = await supabase
      .from('playlist_tracks')
      .select('playlistId, trackId')
      .in('playlistId', playlistIds);
    if (playlistTracksError) {
      throw new BadRequestException('Failed to get playlist tracks');
    }
    // 3. Get all unique trackIds
    const trackIds = [...new Set(playlistTracks.map((pt) => pt.trackId))];
    let tracks: any[] = [];
    if (trackIds.length > 0) {
      // 4. Get all tracks with full details
      const { data: tracksData, error: tracksError } = await supabase
        .from('track')
        .select('*')
        .in('id', trackIds);
      if (tracksError) {
        throw new BadRequestException('Failed to get tracks');
      }
      tracks = tracksData;
    }
    // 5. Map tracks to their playlists
    const playlistIdToTracks = {};
    for (const pt of playlistTracks) {
      if (!playlistIdToTracks[pt.playlistId])
        playlistIdToTracks[pt.playlistId] = [];
      const track = tracks.find((t) => t.id === pt.trackId);
      if (track) playlistIdToTracks[pt.playlistId].push(track);
    }
    // 6. Attach tracks to playlists
    const result = playlists.map((playlist) => ({
      ...playlist,
      tracks: playlistIdToTracks[playlist.id] || [],
    }));
    return {
      playlists: result,
    };
  }
}
