import { Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Track } from '../../track/entities/track.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @OneToMany(() => Track, (track) => track.category, {
    onDelete: 'CASCADE',
  })
  tracks: Track[];
}
