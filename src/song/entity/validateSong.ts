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

import JSON5 from 'json5';
import type { Song } from './song';
import { logger } from '../../shared';
import validator from 'validator';

const { isISO8601 } = validator;

export interface ValidationErrorMsg {
    id?: string;
    titel?: string;
    label?: string;
    produzent?: string;
    interpret?: string;
    erscheinungsdatum?: string;
    lauflaenge?: number;
}

/* eslint-disable no-null/no-null */
export const validateSong = (song: Song) => {
    const err: ValidationErrorMsg = {};
    const { titel, label, produzent, interpret, erscheinungsdatum } = song;

    if (titel === undefined || titel === null || titel === '') {
        err.titel = 'Ein Song muss einen Titel haben.';
    } else if (!/^\w.*/u.test(titel)) {
        err.titel =
            'Ein Songtitel muss mit einem Buchstaben, einer Ziffer oder _ beginnen.';
    }

    if (label === undefined || label === null || label === '') {
        err.label = 'Das Label eines Songs muss gesetzt sein';
    } else if (
        (label as unknown) !== 'SONY_MUSIC' &&
        (label as unknown) !== 'ROADRUNNER_RECORDS' &&
        (label as unknown) !== 'BETTERNOISE_MUSIC' &&
        (label as unknown) !== 'UNIVERSAL_MUSIC'
    ) {
        err.label =
            'Das Label eines Songs muss SONY_MUSIC, ROADRUNNER_RECORDS, BETTERNOISE_MUSIC oder UNIVERSAL_MUSIC sein.';
    }

    if (produzent === undefined || produzent === null || produzent === '') {
        err.produzent = 'Ein Song muss einen Produzenten haben.';
    } else if (!/^\w.*/u.test(produzent)) {
        err.produzent =
            'Ein Produzent muss mit einem Buchstaben, einer Ziffer oder _ beginnen.';
    }

    if (interpret === undefined || interpret === null || interpret === '') {
        err.interpret = 'Der Interpret eines Songs muss gesetzt sein';
    } else if (
        (interpret as unknown) !== 'TRIVIUM' &&
        (interpret as unknown) !== 'FIVEFINGERDEATHPUNCH' &&
        (interpret as unknown) !== 'ZUGEZOGENMASKULIN' &&
        (interpret as unknown) !== 'DENDEMANN'
    ) {
        err.interpret =
            'Der Interpret eines Songs muss TRIVIUM, FIVEFINGERDEATHPUNCH, ZUGEZOGENMASKULIN oder DENDEMANN sein.';
    }
    if (
        typeof erscheinungsdatum === 'string' &&
        !isISO8601(erscheinungsdatum)
    ) {
        err.erscheinungsdatum = `'${erscheinungsdatum}' ist kein gueltiges Datum (yyyy-MM-dd).`;
    }

    logger.debug(`validateSong: err=${JSON5.stringify(err)}`);
    return Object.entries(err).length === 0 ? undefined : err;
};
/* eslint-enable no-null/no-null */
