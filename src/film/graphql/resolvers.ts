/*
 * Copyright (C) 2021 - present Alexander Mader, Marius Gulden, Matthias Treise
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul enthält die _Resolver_ für GraphQL.
 *
 * Die Referenzimplementierung von GraphQL soll übrigens nach TypeScript
 * migriert werden: https://github.com/graphql/graphql-js/issues/2860
 * @packageDocumentation
 */

import {
    FilmInvalid,
    FilmNotExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from '../service/errors';
import { FilmService, FilmServiceError } from '../service';
import type { Film } from '../entity';
import { logger } from '../../shared';

const filmService = new FilmService();

// https://www.apollographql.com/docs/apollo-server/data/resolvers
// Zugriff auf Header-Daten, z.B. Token
// https://www.apollographql.com/docs/apollo-server/migration-two-dot/#accessing-request-headers
// https://www.apollographql.com/docs/apollo-server/security/authentication

// Resultat mit id (statt _id) und version (statt __v)
// __ ist bei GraphQL fuer interne Zwecke reserviert
const withIdAndVersion = (film: Film) => {
    const result: any = film;
    result.id = film._id;
    result.version = film.__v;
    return film;
};

const findFilmById = async (id: string) => {
    const film = await filmService.findById(id);
    if (film === undefined) {
        return;
    }
    return withIdAndVersion(film);
};

const findFilme = async (titel: string | undefined) => {
    const suchkriterium = titel === undefined ? {} : { titel };
    const filme = await filmService.find(suchkriterium);
    return filme.map((film: Film) => withIdAndVersion(film));
};

interface TitelCriteria {
    titel: string;
}

interface IdCriteria {
    id: string;
}

const createFilm = async (film: Film) => {
    const result = await filmService.create(film);
    logger.debug('resolvers createFilm(): result=%o', result);
    if (result instanceof FilmServiceError) {
        return;
    }
    return result;
};

const logUpdateResult = (
    result:
        | FilmInvalid
        | FilmNotExists
        | TitelExists
        | VersionInvalid
        | VersionOutdated
        | number,
) => {
    if (result instanceof FilmInvalid) {
        logger.debug('resolvers updateFilm(): validation msg = %o', result.msg);
    } else if (result instanceof TitelExists) {
        logger.debug(
            'resolvers updateFilm(): vorhandener titel = %s',
            result.titel,
        );
    } else if (result instanceof FilmNotExists) {
        logger.debug(
            'resolvers updateFilm(): nicht-vorhandene id = %s',
            result.id,
        );
    } else if (result instanceof VersionInvalid) {
        logger.debug(
            'resolvers updateFilm(): ungueltige version = %d',
            result.version,
        );
    } else if (result instanceof VersionOutdated) {
        logger.debug(
            'resolvers updateFilm(): alte version = %d',
            result.version,
        );
    } else {
        logger.debug(
            'resolvers updateFilm(): aktualisierte Version= %d',
            result,
        );
    }
};

const updateFilm = async (film: Film) => {
    logger.debug(
        'resolvers updateFilm(): zu aktualisieren = %s',
        JSON.stringify(film),
    );
    // nullish coalescing
    const version = film.__v ?? 0;
    const result = await filmService.update(film, version.toString());
    logUpdateResult(result);
    return result;
};

const deleteFilm = async (id: string) => {
    const result = await filmService.delete(id);
    logger.debug('resolvers deleteFilm(): result = %s', result);
    return result;
};

// Queries passend zu "type Query" in typeDefs.ts
const query = {
    /**
     * Bücher suchen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `titel` als Suchkriterium
     * @returns Promise mit einem JSON-Array der gefundenen Bücher
     */
    filme: (_: unknown, { titel }: TitelCriteria) => findFilme(titel),

    /**
     * Film suchen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `id` als Suchkriterium
     * @returns Promise mit dem gefundenen {@linkcode Film} oder `undefined`
     */
    film: (_: unknown, { id }: IdCriteria) => findFilmById(id),
};

const mutation = {
    /**
     * Neues Film anlegen
     * @param _ nicht benutzt
     * @param film JSON-Objekt mit dem neuen {@linkcode Film}
     * @returns Promise mit der generierten ID
     */
    createFilm: (_: unknown, film: Film) => createFilm(film),

    /**
     * Vorhandenes {@linkcode Film} aktualisieren
     * @param _ nicht benutzt
     * @param film JSON-Objekt mit dem zu aktualisierenden Film
     * @returns Das aktualisierte Film als {@linkcode FilmData} in einem Promise,
     * falls kein Fehler aufgetreten ist. Ansonsten ein Promise mit einem Fehler
     * durch:
     * - {@linkcode FilmInvalid}
     * - {@linkcode FilmNotExists}
     * - {@linkcode TitelExists}
     * - {@linkcode VersionInvalid}
     * - {@linkcode VersionOutdated}
     */
    updateFilm: (_: unknown, film: Film) => updateFilm(film),

    /**
     * Film löschen
     * @param _ nicht benutzt
     * @param __namedParameters JSON-Objekt mit `id` zur Identifikation
     * @returns true, falls das Film gelöscht wurde. Sonst false.
     */
    deleteFilm: (_: unknown, { id }: IdCriteria) => deleteFilm(id),
};

/**
 * Die Resolver bestehen aus `Query` und `Mutation`.
 */
export const resolvers /* : IResolvers */ = {
    Query: query, // eslint-disable-line @typescript-eslint/naming-convention
    Mutation: mutation, // eslint-disable-line @typescript-eslint/naming-convention
};
