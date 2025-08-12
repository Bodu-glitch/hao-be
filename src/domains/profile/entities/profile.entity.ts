import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Playlist } from '../../playlist/entities/playlist.entity';
import { Track } from '../../track/entities/track.entity';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string

  @OneToMany(() => Track, (track) => track.owner, {
    onDelete: 'CASCADE',
  })
  tracks: Track[];

  @OneToMany(() => Playlist, (playlist) => playlist.tracks)
  playlists: Playlist[];

  @ManyToMany(() => Profile, (profile) => profile.following, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinTable({
    name: 'profile_followers',
    joinColumn: { name: 'followerId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'followingId', referencedColumnName: 'id' },
  })
  followers: Profile[]; // người theo dõi

  @ManyToMany(() => Profile, (profile) => profile.followers)
  following: Profile[]; // người đang theo dõi
}
