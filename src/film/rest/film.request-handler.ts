/* eslint-disable max-lines */

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
 * Das Modul besteht aus der Klasse {@linkcode FilmRequestHandler}, um die
 * Handler-Funktionen für die REST-Schnittstelle auf der Basis von Express
 * gebündelt bereitzustellen.
 * @packageDocumentation
 */

import type { CreateError, UpdateError } from '../service';
import type { Film, FilmData, ValidationErrorMsg } from '../entity';
import {
    FilmInvalid,
    FilmNotExists,
    FilmService,
    FilmServiceError,
    IsbnExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from '../service';

import { HttpStatus, getBaseUri, logger, mimeConfig } from '../../shared';
import type { Request, Response } from 'express';

// Interface fuer die REST-Schnittstelle
interface FilmHAL extends Film {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links?: {
        self?: { href: string };
        list?: { href: string };
        add?: { href: string };
        update?: { href: string };
        remove?: { href: string };
    };
}

/**
 * Die Handler-Klasse fasst die Handler-Funktionen für Bücher zusammen, um die
 * REST-Schnittstelle auf Basis von Express zu realisieren.
 */
export class FilmRequestHandler {
    // Dependency Injection ggf. durch
    // * Awilix https://github.com/jeffijoe/awilix
    // * InversifyJS https://github.com/inversify/InversifyJS
    // * Node Dependency Injection https://github.com/zazoomauro/node-dependency-injection
    // * BottleJS https://github.com/young-steveo/bottlejs
    private readonly service = new FilmService();

    /**
     * Ein Film wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Film gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Filmes gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Film im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Film zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // vgl Kotlin: Schluesselwort "suspend"
    // eslint-disable-next-line max-statements
    async findById(req: Request, res: Response) {
        const versionHeader = req.header('If-None-Match');
        logger.debug(
            'FilmRequestHandler.findById(): versionHeader=%s',
            versionHeader,
        );
        const { id } = req.params;
        logger.debug('FilmRequestHandler.findById(): id=%s', id);

        if (id === undefined) {
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        let film: FilmData | undefined;
        try {
            // vgl. Kotlin: Aufruf einer suspend-Function
            film = await this.service.findById(id);
        } catch (err: unknown) {
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            logger.error('FilmRequestHandler.findById(): error=%o', err);
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        if (film === undefined) {
            logger.debug('FilmRequestHandler.findById(): status=NOT_FOUND');
            res.sendStatus(HttpStatus.NOT_FOUND);
            return;
        }
        logger.debug('FilmRequestHandler.findById(): film=%o', film);

        // ETags
        const versionDb = film.__v;
        if (versionHeader === `"${versionDb}"`) {
            res.sendStatus(HttpStatus.NOT_MODIFIED);
            return;
        }
        logger.debug('FilmRequestHandler.findById(): VersionDb=%d', versionDb);
        res.header('ETag', `"${versionDb}"`);

        // HATEOAS mit Atom Links und HAL (= Hypertext Application Language)
        const filmHAL = this.toHAL(film, req, id);
        res.json(filmHAL);
    }

    /**
     * Bücher werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Film gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Büchern, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Film zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Bücher ermittelt.
     *
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    async find(req: Request, res: Response) {
        // z.B. https://.../filme?titel=a
        // => req.query = { titel: 'a' }
        const { query } = req;
        logger.debug('FilmRequestHandler.find(): queryParams=%o', query);

        let filme: FilmData[];
        try {
            filme = await this.service.find(query);
        } catch (err: unknown) {
            logger.error('FilmRequestHandler.find(): error=%o', err);
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        logger.debug('FilmRequestHandler.find(): filme=%o', filme);
        if (filme.length === 0) {
            // Alternative: https://www.npmjs.com/package/http-errors
            // Damit wird aber auch der Stacktrace zum Client
            // uebertragen, weil das resultierende Fehlerobjekt
            // von Error abgeleitet ist.
            logger.debug('FilmRequestHandler.find(): status = NOT_FOUND');
            res.sendStatus(HttpStatus.NOT_FOUND);
            return;
        }

        const baseUri = getBaseUri(req);
        // asynchrone for-of Schleife statt synchrones filme.forEach()
        for await (const film of filme) {
            // HATEOAS: Atom Links je Film
            const filmHAL: FilmHAL = film;
            // eslint-disable-next-line no-underscore-dangle
            filmHAL._links = { self: { href: `${baseUri}/${film._id}` } };

            delete film._id;
            delete film.__v;
        }
        logger.debug('FilmRequestHandler.find(): filme=%o', filme);

        res.json(filme);
    }

    /**
     * Ein neues Film wird asynchron angelegt. Das neu anzulegende Film ist als
     * JSON-Datensatz im Request-Objekt enthalten und im Request-Header muss
     * `Content-Type` auf `application\json` gesetzt sein. Wenn es keine
     * Verletzungen von Constraints gibt, wird der Statuscode `201` (`Created`)
     * gesetzt und im Response-Header wird `Location` auf die URI so gesetzt,
     * dass damit das neu angelegte Film abgerufen werden kann.
     *
     * Falls Constraints verletzt sind, wird der Statuscode `400` (`Bad Request`)
     * gesetzt und genauso auch wenn der Titel oder die ISBN-Nummer bereits
     * existieren.
     *
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    async create(req: Request, res: Response) {
        const contentType = req.header(mimeConfig.contentType);
        if (
            // Optional Chaining
            contentType?.toLowerCase() !== mimeConfig.json
        ) {
            logger.debug('FilmRequestHandler.create() status=NOT_ACCEPTABLE');
            res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
            return;
        }

        const film = req.body as Film;
        logger.debug('FilmRequestHandler.create(): film=%o', film);

        const result = await this.service.create(film);
        if (result instanceof FilmServiceError) {
            this.handleCreateError(result, res);
            return;
        }

        const location = `${getBaseUri(req)}/${result}`;
        logger.debug('FilmRequestHandler.create(): location=%s', location);
        res.location(location).sendStatus(HttpStatus.CREATED);
    }

    /**
     * Ein vorhandenes Film wird asynchron aktualisiert.
     *
     * Im Request-Objekt von Express muss die ID des zu aktualisierenden Filmes
     * als Pfad-Parameter enthalten sein. Außerdem muss im Rumpf das zu
     * aktualisierende Film als JSON-Datensatz enthalten sein. Damit die
     * Aktualisierung überhaupt durchgeführt werden kann, muss im Header
     * `If-Match` auf die korrekte Version für optimistische Synchronisation
     * gesetzt sein.
     *
     * Bei erfolgreicher Aktualisierung wird der Statuscode `204` (`No Content`)
     * gesetzt und im Header auch `ETag` mit der neuen Version mitgeliefert.
     *
     * Falls die Versionsnummer fehlt, wird der Statuscode `428` (`Precondition
     * required`) gesetzt; und falls sie nicht korrekt ist, der Statuscode `412`
     * (`Precondition failed`). Falls Constraints verletzt sind, wird der
     * Statuscode `400` (`Bad Request`) gesetzt und genauso auch wenn der neue
     * Titel oder die neue ISBN-Nummer bereits existieren.
     *
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    async update(req: Request, res: Response) {
        const { id } = req.params;
        logger.debug('FilmRequestHandler.update(): id=%s', id);

        const contentType = req.header(mimeConfig.contentType);
        // Optional Chaining
        if (contentType?.toLowerCase() !== mimeConfig.json) {
            res.status(HttpStatus.NOT_ACCEPTABLE);
            return;
        }
        const version = this.getVersionHeader(req, res);
        if (version === undefined) {
            return;
        }

        const film = req.body as Film;
        film._id = id;
        logger.debug('FilmRequestHandler.update(): film=%o', film);

        const result = await this.service.update(film, version);
        if (result instanceof FilmServiceError) {
            this.handleUpdateError(result, res);
            return;
        }

        logger.debug('FilmRequestHandler.update(): version=%d', result);
        res.set('ETag', result.toString()).sendStatus(HttpStatus.NO_CONTENT);
    }

    /**
     * Ein Film wird anhand seiner ID-gelöscht, die als Pfad-Parameter angegeben
     * ist. Der zurückgelieferte Statuscode ist `204` (`No Content`).
     *
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    async delete(req: Request, res: Response) {
        const { id } = req.params;
        logger.debug('FilmRequestHandler.delete(): id=%s', id);

        if (id === undefined) {
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        try {
            await this.service.delete(id);
        } catch (err: unknown) {
            logger.error('FilmRequestHandler.delete(): error=%o', err);
            res.sendStatus(HttpStatus.INTERNAL_ERROR);
            return;
        }

        logger.debug('FilmRequestHandler.delete(): NO_CONTENT');
        res.sendStatus(HttpStatus.NO_CONTENT);
    }

    private toHAL(film: FilmData, req: Request, id: string) {
        delete film._id;
        delete film.__v;
        const filmHAL: FilmHAL = film;

        const baseUri = getBaseUri(req);
        // eslint-disable-next-line no-underscore-dangle
        filmHAL._links = {
            self: { href: `${baseUri}/${id}` },
            list: { href: `${baseUri}` },
            add: { href: `${baseUri}` },
            update: { href: `${baseUri}/${id}` },
            remove: { href: `${baseUri}/${id}` },
        };

        return filmHAL;
    }

    private handleCreateError(err: CreateError, res: Response) {
        if (err instanceof FilmInvalid) {
            this.handleValidationError(err.msg, res);
            return;
        }

        if (err instanceof TitelExists) {
            this.handleTitelExists(err.titel, err.id, res);
            return;
        }

        if (err instanceof IsbnExists) {
            this.handleIsbnExists(err.isan, err.id, res);
        }
    }

    private handleIsbnExists(
        isan: string | null | undefined,
        id: string | undefined,
        res: Response,
    ) {
        const msg = `Die ISBN-Nummer "${isan}" existiert bereits bei ${id}.`;
        logger.debug('FilmRequestHandler.handleIsbnExists(): msg=%s', msg);
        res.status(HttpStatus.BAD_REQUEST)
            .set('Content-Type', 'text/plain')
            .send(msg);
    }

    private handleValidationError(msg: ValidationErrorMsg, res: Response) {
        logger.debug('FilmRequestHandler.handleValidationError(): msg=%o', msg);
        res.status(HttpStatus.BAD_REQUEST).send(msg);
    }

    private handleTitelExists(
        titel: string | null | undefined,
        id: string | undefined,
        res: Response,
    ) {
        const msg = `Der Titel "${titel}" existiert bereits bei ${id}.`;
        logger.debug('FilmRequestHandler.handleTitelExists(): msg=%s', msg);
        res.status(HttpStatus.BAD_REQUEST)
            .set('Content-Type', 'text/plain')
            .send(msg);
    }

    private getVersionHeader(req: Request, res: Response) {
        const versionHeader = req.header('If-Match');
        logger.debug(
            'FilmRequestHandler.getVersionHeader() versionHeader=%s',
            versionHeader,
        );

        if (versionHeader === undefined) {
            const msg = 'Versionsnummer fehlt';
            logger.debug(
                'FilmRequestHandler.getVersionHeader(): status=428, message=',
                msg,
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
                'FilmRequestHandler.getVersionHeader(): status=412, message=',
                msg,
            );
            res.status(HttpStatus.PRECONDITION_FAILED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        // slice: einschl. Start, ausschl. Ende
        const version = versionHeader.slice(1, -1);
        logger.debug(
            'FilmRequestHandler.getVersionHeader(): version=%s',
            version,
        );
        return version;
    }

    private handleUpdateError(err: UpdateError, res: Response) {
        if (err instanceof FilmInvalid) {
            this.handleValidationError(err.msg, res);
            return;
        }

        if (err instanceof FilmNotExists) {
            const { id } = err;
            const msg = `Es gibt kein Film mit der ID "${id}".`;
            logger.debug('FilmRequestHandler.handleUpdateError(): msg=%s', msg);
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
            logger.debug('FilmRequestHandler.handleUpdateError(): msg=%s', msg);
            res.status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'text/plain')
                .send(msg);
            return;
        }

        if (err instanceof VersionOutdated) {
            const { version } = err;
            const msg = `Die Versionsnummer "${version}" ist nicht aktuell.`;
            logger.debug('FilmRequestHandler.handleUpdateError(): msg=%s', msg);
            res.status(HttpStatus.PRECONDITION_FAILED)
                .set('Content-Type', 'text/plain')
                .send(msg);
        }
    }
}

/* eslint-enable max-lines */
