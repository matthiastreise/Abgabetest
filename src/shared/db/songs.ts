/*
 * Copyright (C) 2020 - present Alexander, Matthias, Glynis
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

/* eslint-disable @typescript-eslint/naming-convention */

export const songs = [
    {
        _id: '00000000-0000-0000-0000-000000000001',
        titel: 'Mood',
        label: 'SONY_MUSIC',
        produzent: 'John Williams',
        interpret: 'ZUGEZOGENMASKULIN',
        lauflaenge: 2.3,
        // https://docs.mongodb.com/manual/reference/method/Date
        erscheinungsdatum: new Date('2020-02-01'),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000002',
        titel: 'Positions',
        label: 'ROADRUNNER_RECORDS',
        produzent: 'Quincy Jones',
        interpret: 'ZUGEZOGENMASKULIN',
        lauflaenge: 3.02,
        lieferbar: true,
        erscheinungsdatum: new Date('2020-03-21'),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000003',
        titel: 'Blinding Lights',
        label: 'SONY_MUSIC',
        produzent: 'George Martin',
        interpret: 'DENDEMANN',
        lauflaenge: 2.45,
        erscheinungsdatum: new Date('2020-10-10'),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000004',
        titel: 'Kings & Queens',
        label: 'UNIVERSAL_MUSIC',
        produzent: 'Berry Gordy',
        interpret: 'FIVEFINGERDEATHPUNCH',
        lauflaenge: 3.15,
        erscheinungsdatum: new Date('2020-04-01'),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000005',
        titel: 'Lonely',
        label: 'BETTERNOISE_MUSIC',
        produzent: 'Nile Rodgers',
        interpret: 'TRIVIUM',
        lauflaenge: 2.56,
        erscheinungsdatum: new Date('2020-07-21'),
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

/* eslint-enable @typescript-eslint/naming-convention */
