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

// Die Referenzimplementierung von GraphQL soll nach TypeScript migriert werden:
// https://github.com/graphql/graphql-js/issues/2104

import {
    SongInvalid,
    SongNotExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from '../service/errors';
import { SongService, SongServiceError } from '../service';
import type { Song } from '../entity';
// import type { IResolvers } from 'graphql-tools';
import { logger } from '../../shared';

const songService = new SongService();

// https://www.apollographql.com/docs/apollo-server/data/resolvers
// Zugriff auf Header-Daten, z.B. Token
// https://www.apollographql.com/docs/apollo-server/migration-two-dot/#accessing-request-headers
// https://www.apollographql.com/docs/apollo-server/security/authentication

// Resultat mit id (statt _id) und version (statt __v)
// __ ist bei GraphQL fuer interne Zwecke reserviert
const withIdAndVersion = (song: Song) => {
    const result: any = song;
    result.id = song._id;
    result.version = song.__v;
    return song;
};

const findSongById = async (id: string) => {
    const song = await songService.findById(id);
    if (song === undefined) {
        return;
    }
    return withIdAndVersion(song);
};

const findSongs = async (titel: string | undefined) => {
    const suchkriterium = titel === undefined ? {} : { titel };
    const songs = await songService.find(suchkriterium);
    return songs.map((song) => withIdAndVersion(song));
};

interface TitelCriteria {
    titel: string;
}

interface IdCriteria {
    id: string;
}

const createSong = async (song: Song) => {
    song.erscheinungsdatum = new Date(song.erscheinungsdatum as string);
    const result = await songService.create(song);
    console.log(`resolvers createSong(): result=${JSON.stringify(result)}`);
    if (result instanceof SongServiceError) {
        return;
    }
    return result._id;
};

const logUpdateResult = (
    result:
        | Song
        | SongInvalid
        | TitelExists
        | SongNotExists
        | VersionInvalid
        | VersionOutdated,
) => {
    if (result instanceof SongInvalid) {
        logger.debug(
            `resolvers updateSong(): validation msg = ${JSON.stringify(
                result.msg,
            )}`,
        );
    } else if (result instanceof TitelExists) {
        logger.debug(
            `resolvers updateSong(): vorhandener titel = ${result.titel}`,
        );
    } else if (result instanceof SongNotExists) {
        logger.debug(
            `resolvers updateSong(): nicht-vorhandene id = ${result.id}`,
        );
    } else if (result instanceof VersionInvalid) {
        logger.debug(
            `resolvers updateSong(): ungueltige version = ${result.version}`,
        );
    } else if (result instanceof VersionOutdated) {
        logger.debug(
            `resolvers updateSong(): alte version = ${result.version}`,
        );
    } else {
        logger.debug(
            `resolvers updateSong(): song aktualisiert = ${JSON.stringify(
                result,
            )}`,
        );
        // TODO hier wird getrickst, um __v als "version" im Resultat zu haben
        const updateResult: any = result;
        updateResult.version = result.__v;
    }
};

const updateSong = async (song: Song) => {
    logger.debug(
        `resolvers updateSong(): zu aktualisieren = ${JSON.stringify(song)}`,
    );
    const version = song.__v ?? 0;
    song.erscheinungsdatum = new Date(song.erscheinungsdatum as string);
    const result = await songService.update(song, version.toString());
    logUpdateResult(result);
    return result;
};

const deleteSong = async (id: string) => {
    const result = await songService.delete(id);
    logger.debug(`resolvers deleteSong(): result = ${result}`);
    return result;
};

// Queries passend zu "type Query" in typeDefs.ts
const query = {
    // Songs suchen, ggf. mit Titel als Suchkriterium
    songs: (_: unknown, { titel }: TitelCriteria) => findSongs(titel),
    // Ein Song mit einer bestimmten ID suchen
    song: (_: unknown, { id }: IdCriteria) => findSongById(id),
};

const mutation = {
    createSong: (_: unknown, song: Song) => createSong(song),
    updateSong: (_: unknown, song: Song) => updateSong(song),
    deleteSong: (_: unknown, { id }: IdCriteria) => deleteSong(id),
};

export const resolvers /* : IResolvers */ = {
    Query: query, // eslint-disable-line @typescript-eslint/naming-convention
    Mutation: mutation, // eslint-disable-line @typescript-eslint/naming-convention
};
