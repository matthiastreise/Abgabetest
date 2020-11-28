/* eslint-disable max-lines */

/*
 * Copyright (C) 2016 - present Alexander, Matthias, Glynis
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

import type { CreateError, UpdateError } from '../service';
import { HttpStatus, getBaseUri, logger, mimeConfig } from '../../shared';
import type { Request, Response } from 'express';
import type { SongData, ValidationErrorMsg } from '../entity';
import {
    SongInvalid,
    SongNotExists,
    SongService,
    SongServiceError,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from '../service';
import JSON5 from 'json5';

// export bei async und await:
// https://blogs.msdn.microsoft.com/typescript/2015/11/30/announcing-typescript-1-7
// http://tc39.github.io/ecmascript-export
// https://nemethgergely.com/async-function-best-practices#Using-async-functions-with-express

export class SongRequestHandler {
    // Dependency Injection ggf. durch
    // * Awilix https://github.com/jeffijoe/awilix
    // * InversifyJS https://github.com/inversify/InversifyJS
    // * Node Dependency Injection https://github.com/zazoomauro/node-dependency-injection
    // * BottleJS https://github.com/young-steveo/bottlejs
    private readonly service = new SongService();

    // vgl Kotlin: Schluesselwort "suspend"
    // eslint-disable-next-line max-statements
    async findById(req: Request, res: Response) {
        const versionHeader = req.header('If-None-Match');
        logger.debug(
            `SongRequestHandler.findById(): versionHeader=${versionHeader}`,
        );
        const { id } = req.params;
        logger.debug(`SongRequestHandler.findById(): id=${id}`);

        let song: SongData | undefined;
        try {
            // vgl. Kotlin: Aufruf einer suspend-Function
            song = await this.service.findById(id);
        } catch (err: unknown) {
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            logger.error(
                `SongRequestHandler.findById(): error=${JSON5.stringify(err)}`,
            );
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        if (song === undefined) {
            logger.debug('SongRequestHandler.findById(): status=NOT_FOUND');
            res.sendStatus(HttpStatus.NOT_FOUND);
            return;
        }

        logger.debug(
            `SongRequestHandler.findById(): song=${JSON5.stringify(song)}`,
        );
        const versionDb = song.__v;
        if (versionHeader === `"${versionDb}"`) {
            res.sendStatus(HttpStatus.NOT_MODIFIED);
            return;
        }
        logger.debug(`SongRequestHandler.findById(): VersionDb=${versionDb}`);
        res.header('ETag', `"${versionDb}"`);

        const baseUri = getBaseUri(req);
        // HATEOAS: Atom Links
        // eslint-disable-next-line no-underscore-dangle
        song._links = {
            self: { href: `${baseUri}/${id}` },
            list: { href: `${baseUri}` },
            add: { href: `${baseUri}` },
            update: { href: `${baseUri}/${id}` },
            remove: { href: `${baseUri}/${id}` },
        };

        delete song._id;
        delete song.__v;
        delete song.createdAt;
        delete song.updatedAt;
        res.json(song);
    }

    async find(req: Request, res: Response) {
        const { query } = req;
        logger.debug(
            `SongRequestHandler.find(): queryParams=${JSON5.stringify(query)}`,
        );

        let songs: SongData[];
        try {
            songs = await this.service.find(query);
        } catch (err: unknown) {
            logger.error(
                `SongRequestHandler.find(): error=${JSON5.stringify(err)}`,
            );
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        logger.debug(
            `SongRequestHandler.find(): songs=${JSON5.stringify(songs)}`,
        );
        if (songs.length === 0) {
            // Alternative: https://www.npmjs.com/package/http-errors
            // Damit wird aber auch der Stacktrace zum Client
            // uebertragen, weil das resultierende Fehlerobjekt
            // von Error abgeleitet ist.
            logger.debug('SongRequestHandler.find(): status = NOT_FOUND');
            res.sendStatus(HttpStatus.NOT_FOUND);
            return;
        }

        const baseUri = getBaseUri(req);

        // asynchrone for-of Schleife statt synchrones songs.map()
        for await (const song of songs) {
            // HATEOAS: Atom Links je Song
            // eslint-disable-next-line no-underscore-dangle
            song._links = { self: { href: `${baseUri}/${song._id}` } };
        }

        logger.debug(
            `SongRequestHandler.find(): songs=${JSON5.stringify(songs)}`,
        );
        songs.forEach((song) => {
            delete song._id;
            delete song.__v;
            delete song.createdAt;
            delete song.updatedAt;
        });
        res.json(songs);
    }

    async create(req: Request, res: Response) {
        const contentType = req.header(mimeConfig.contentType);
        if (
            // Optional Chaining
            contentType?.toLowerCase() !== mimeConfig.json
        ) {
            logger.debug('SongRequestHandler.create() status=NOT_ACCEPTABLE');
            res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
            return;
        }

        const songData = req.body; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        logger.debug(
            `SongRequestHandler.create(): body=${JSON5.stringify(songData)}`,
        );

        const result = await this.service.create(songData);
        if (result instanceof SongServiceError) {
            this.handleCreateError(result, res);
            return;
        }

        const songSaved = result;
        const location = `${getBaseUri(req)}/${songSaved._id}`;
        logger.debug(`SongRequestHandler.create(): location=${location}`);
        res.location(location);
        res.sendStatus(HttpStatus.CREATED);
    }

    async update(req: Request, res: Response) {
        const { id } = req.params;
        logger.debug(`SongRequestHandler.update(): id=${id}`);

        const contentType = req.header(mimeConfig.contentType);
        if (contentType?.toLowerCase() !== mimeConfig.json) {
            res.status(HttpStatus.NOT_ACCEPTABLE);
            return;
        }
        const version = this.getVersionHeader(req, res);
        if (version === undefined) {
            return;
        }

        const songData = req.body; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        songData._id = id;
        logger.debug(
            `SongRequestHandler.update(): song=${JSON5.stringify(songData)}`,
        );

        const result = await this.service.update(songData, version);
        if (result instanceof SongServiceError) {
            this.handleUpdateError(result, res);
            return;
        }

        logger.debug(
            `SongRequestHandler.update(): result=${JSON5.stringify(result)}`,
        );
        const neueVersion = `"${result.__v?.toString()}"`;
        res.set('ETag', neueVersion);
        res.sendStatus(HttpStatus.NO_CONTENT);
    }

    async delete(req: Request, res: Response) {
        const { id } = req.params;
        logger.debug(`SongRequestHandler.delete(): id=${id}`);

        try {
            await this.service.delete(id);
        } catch (err: unknown) {
            logger.error(
                `SongRequestHandler.delete(): error=${JSON5.stringify(err)}`,
            );
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        logger.debug('SongRequestHandler.delete(): NO_CONTENT');
        res.sendStatus(HttpStatus.NO_CONTENT);
    }

    private handleCreateError(err: CreateError, res: Response) {
        if (err instanceof SongInvalid) {
            this.handleValidationError(err.msg, res);
            return;
        }

        if (err instanceof TitelExists) {
            this.handleTitelExists(err.titel, err.id, res);
        }
    }

    private handleValidationError(msg: ValidationErrorMsg, res: Response) {
        logger.debug(
            `SongRequestHandler.handleCreateError(): msg=${JSON.stringify(
                msg,
            )}`,
        );
        res.status(HttpStatus.BAD_REQUEST).send(msg);
    }

    private handleTitelExists(titel: string, id: string, res: Response) {
        const msg = `Der Titel "${titel}" existiert bereits bei ${id}.`;
        logger.debug(`SongRequestHandler.handleCreateError(): msg=${msg}`);
        res.status(HttpStatus.BAD_REQUEST)
            .set('Content-Type', 'text/plain')
            .send(msg);
    }

    private getVersionHeader(req: Request, res: Response) {
        const versionHeader = req.header('If-Match');
        logger.debug(
            `SongRequestHandler.getVersionHeader() versionHeader=${versionHeader}`,
        );

        if (versionHeader === undefined) {
            const msg = 'Versionsnummer fehlt';
            logger.debug(
                `SongRequestHandler.getVersionHeader(): status=428, message=${msg}`,
            );
            res.status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        const { length } = versionHeader;
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        if (length < 3) {
            const msg = `Ungueltige Versionsnummer: ${versionHeader}`;
            logger.debug(
                `SongRequestHandler.getVersionHeader(): status=412, message=${msg}`,
            );
            res.status(HttpStatus.PRECONDITION_FAILED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        // slice: einschl. Start, ausschl. Ende
        const version = versionHeader.slice(1, -1);
        logger.debug(
            `SongRequestHandler.getVersionHeader(): version=${version}`,
        );
        return version;
    }

    private handleUpdateError(err: UpdateError, res: Response) {
        if (err instanceof SongInvalid) {
            this.handleValidationError(err.msg, res);
            return;
        }

        if (err instanceof SongNotExists) {
            const { id } = err;
            const msg = `Es gibt kein Song mit der ID "${id}".`;
            logger.debug(`SongRequestHandler.handleUpdateError(): msg=${msg}`);
            res.status(HttpStatus.PRECONDITION_FAILED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        if (err instanceof TitelExists) {
            this.handleTitelExists(err.titel, err.id, res);
            return;
        }

        if (err instanceof VersionInvalid) {
            const { version } = err;
            const msg = `Die Versionsnummer "${version}" ist ungueltig.`;
            logger.debug(`SongRequestHandler.handleUpdateError(): msg=${msg}`);
            res.status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        if (err instanceof VersionOutdated) {
            const { version } = err;
            const msg = `Die Versionsnummer "${version}" ist nicht aktuell.`;
            logger.debug(`SongRequestHandler.handleUpdateError(): msg=${msg}`);
            res.status(HttpStatus.PRECONDITION_FAILED)
                .set('Content-Type', 'text/plain')
                .send(msg);
        }
    }
}

/* eslint-enable max-lines */
