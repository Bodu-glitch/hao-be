import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Playlist } from '../../playlist/entities/playlist.entity';
import { Category } from '../../category/entities/category.entity';
import { Profile } from '../../profile/entities/profile.entity';
import { TrackEnum } from '../../../enums/track.enum';
import { PlaylistTrack } from '../../playlist_tracks/entities/playlist_track.entity';

@Entity()
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  duration: number;

  @Column('text')
  filePath: string;

  @Column('int8')
  viewCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column('text', { nullable: true })
  thumbnailPath: string;

  @ManyToOne(() => Profile, (profile) => profile.tracks, {
    onDelete: 'CASCADE',
    eager: true,
  })
  owner: Profile;

  @OneToMany(() => PlaylistTrack, (playlistTrack) => playlistTrack.track)
  playlistTracks: PlaylistTrack[];

  @ManyToOne(() => Category, (category) => category.tracks, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  category: Category;
}
