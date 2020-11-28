/*
 * Copyright (C) 2018 - present Alexander, Matthias, Glynis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { song, songs } from './song';
import JSON5 from 'json5';
import type { Song } from '../../entity';
import { logger } from '../../../shared';
import { v4 as uuid } from 'uuid';

/* eslint-disable @typescript-eslint/no-unused-vars,require-await,@typescript-eslint/require-await */
export class SongServiceMock {
    async findById(id: string) {
        song._id = id;
        return song;
    }

    async find(_?: unknown) {
        return songs;
    }

    async create(songData: Song) {
        songData._id = uuid();
        logger.info(`Neuer Song: ${JSON5.stringify(songData)}`);
        return songData;
    }

    async update(songData: Song) {
        if (songData.__v !== undefined) {
            songData.__v++;
        }
        logger.info(`Aktualisierter Song: ${JSON5.stringify(songData)}`);
        return Promise.resolve(songData);
    }

    async remove(id: string) {
        logger.info(`ID des geloeschten Songs: ${id}`);
        return true;
    }
}

/* eslint-enable @typescript-eslint/no-unused-vars,require-await,@typescript-eslint/require-await */
