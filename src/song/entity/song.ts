/*
 * Copyright (C) 2020 - present Matthias Treise, Alexander Mader, Glynis Zolk,
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

export enum Label {
    SONY_MUSIC = 'SONY_MUSIC',
    ROADRUNNER_RECORDS = 'ROADRUNNER_RECORDS',
    BETTERNOISE_MUSIC = 'BETTERNOISE_MUSIC',
    UNIVERSAL_MUSIC = 'UNIVERSAL_MUSIC',
}

export enum Interpret {
    TRIVIUM = 'TRIVIUM',
    FIVEFINGERDEATHPUNCH = 'FIVEFINGERDEATHPUNCH',
    ZUGEZOGENMASKULIN = 'ZUGEZOGENMASKULIN',
    DENDEMANN = 'DENDEMANN',
}

// gemeinsames Basis-Interface fuer REST und GraphQL
export interface Song {
    _id?: string; // eslint-disable-line @typescript-eslint/naming-convention
    __v?: number; // eslint-disable-line @typescript-eslint/naming-convention
    titel: string | undefined | null;
    label: Label | '' | undefined | null;
    produzent: string | '' | undefined | null;
    interpret: Interpret | '' | undefined | null;
    lauflaenge: number | undefined | null;
    erscheinungsdatum: string | Date | undefined;
}

export interface SongData extends Song {
    createdAt?: number;
    updatedAt?: number;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links?: {
        self?: { href: string };
        list?: { href: string };
        add?: { href: string };
        update?: { href: string };
        remove?: { href: string };
    };
}
