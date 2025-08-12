import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from '../../profile/entities/profile.entity';
import { Track } from '../../track/entities/track.entity';

@Entity()
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  thumbnailPath: string;

  @ManyToOne(() => Profile, (profile) => profile.playlists)
  @JoinColumn()
  profile: Profile;

  @ManyToMany(() => Track, (track) => track.playlists, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  tracks: Track[];
}
