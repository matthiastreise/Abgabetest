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

import { Interpret, Label } from '../../entity';
import type { SongData } from '../../entity';

/* eslint-disable @typescript-eslint/naming-convention */

export const song: SongData = {
    _id: '00000000-0000-0000-0000-000000000005',
    titel: 'Lonely',
    label: Label.BETTERNOISE_MUSIC,
    produzent: 'Nile Rodgers',
    interpret: Interpret.TRIVIUM,
    lauflaenge: 2.56,
    erscheinungsdatum: new Date('2020-07-21'),
    __v: 0,
    createdAt: 0,
    updatedAt: 0,
};

export const songs: SongData[] = [
    song,
    {
        _id: '00000000-0000-0000-0000-000000000004',
        titel: 'Kings & Queens',
        label: Label.UNIVERSAL_MUSIC,
        produzent: 'Berry Gordy',
        interpret: Interpret.ZUGEZOGENMASKULIN,
        lauflaenge: 3.15,
        erscheinungsdatum: new Date('2020-04-01'),
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
    },
];

/* eslint-enable @typescript-eslint/naming-convention */
