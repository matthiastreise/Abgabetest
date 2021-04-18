// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-magic-numbers */
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
 * Das Modul besteht aus der Klasse {@linkcode AuthService} für die
 * Authentifizierung.
 * @packageDocumentation
 */

import type { Film, FilmData, FilmDocument } from '../entity';
import {
    FilmInvalid,
    FilmNotExists,
    FilmServiceError,
    IsbnExists,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from './errors';
import { FilmModel, validateFilm } from '../entity';
import type { FilterQuery, QueryOptions } from 'mongoose';
import { cloud, logger, mailConfig } from '../../shared';
import type { SendMailOptions } from 'nodemailer';

// API-Dokumentation zu Mongoose:
// http://mongoosejs.com/docs/api.html
// https://github.com/Automattic/mongoose/issues/3949

/* eslint-disable no-null/no-null, unicorn/no-useless-undefined */

/**
 * Die Klasse `FilmService` implementiert den Anwendungskern für Bücher und
 * greift mit _Mongoose_ auf MongoDB zu.
 */
export class FilmService {
    private static readonly UPDATE_OPTIONS: QueryOptions = { new: true };

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C# und Mono<> aus Project Reactor
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Film asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Filmes
     * @returns Das gefundene Film vom Typ {@linkcode FilmData} oder undefined
     *          in einem Promise aus ES2015 (vgl.: Mono aus Project Reactor oder
     *          Future aus Java)
     */
    async findById(id: string) {
        logger.debug('FilmService.findById(): id=%s', id);

        // ein Film zur gegebenen ID asynchron mit Mongoose suchen
        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // Das Resultat ist null, falls nicht gefunden.
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document,
        // so dass u.a. der virtuelle getter "id" auch nicht mehr vorhanden ist.
        const film = await FilmModel.findById(id).lean<FilmData | null>();
        logger.debug('FilmService.findById(): film=%o', film);

        if (film === null) {
            return undefined;
        }

        this.deleteTimestamps(film);
        return film;
    }

    /**
     * Bücher asynchron suchen.
     * @param query Die DB-Query als JSON-Objekt
     * @returns Ein JSON-Array mit den gefundenen Büchern. Ggf. ist das Array leer.
     */
    // eslint-disable-next-line max-lines-per-function
    async find(query?: FilterQuery<FilmDocument> | undefined) {
        logger.debug('FilmService.find(): query=%o', query);

        // alle Filme asynchron suchen u. aufsteigend nach titel sortieren
        // https://docs.mongodb.org/manual/reference/object-id
        // entries(): { titel: 'a', rating: 5 } => [{ titel: 'x'}, {rating: 5}]
        if (query === undefined || Object.entries(query).length === 0) {
            logger.debug('FilmService.find(): alle Filme');
            // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
            const filme = await FilmModel.find()
                .sort('titel')
                .lean<FilmData[]>();
            for await (const film of filme) {
                this.deleteTimestamps(film);
            }
            return filme;
        }

        // { titel: 'a', rating: 5, comedy: true }
        // Rest Properties
        const { titel, comedy, abenteuer, ...dbQuery } = query;

        // Filme zur Query (= JSON-Objekt durch Express) asynchron suchen
        // Titel in der Query: Teilstring des Titels,
        // d.h. "LIKE" als regulaerer Ausdruck
        // 'i': keine Unterscheidung zw. Gross- u. Kleinschreibung
        // NICHT /.../, weil das Muster variabel sein muss
        // CAVEAT: KEINE SEHR LANGEN Strings wg. regulaerem Ausdruck
        if (
            titel !== undefined &&
            titel !== null &&
            typeof titel === 'string' &&
            titel.length < 10
        ) {
            // RegExp statt Re2 wegen Mongoose
            dbQuery.titel = new RegExp(titel, 'iu'); // eslint-disable-line security/detect-non-literal-regexp, security-node/non-literal-reg-expr
        }

        // z.B. {comedy: true, abenteuer: true}
        const schlagwoerter = [];
        if (comedy === 'true') {
            schlagwoerter.push('COMEDY');
        }
        if (abenteuer === 'true') {
            schlagwoerter.push('ABENTEUER');
        }
        if (schlagwoerter.length === 0) {
            delete dbQuery.genre;
        } else {
            dbQuery.genre = schlagwoerter;
        }
        logger.debug('FilmService.find(): dbQuery=%o', dbQuery);

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // leeres Array, falls nichts gefunden wird
        // FilmModel.findOne(query), falls das Suchkriterium eindeutig ist
        // bei findOne(query) wird null zurueckgeliefert, falls nichts gefunden
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
        const filme = await FilmModel.find(dbQuery).lean<FilmData[]>();
        for await (const film of filme) {
            this.deleteTimestamps(film);
        }

        return filme;
    }

    /**
     * Ein neues Film soll angelegt werden.
     * @param film Das neu abzulegende Film
     * @returns Die ID des neu angelegten Filmes oder im Fehlerfall
     * - {@linkcode FilmInvalid} falls die Filmdaten gegen Constraints verstoßen
     * - {@linkcode IsbnExists} falls die ISBN-Nr bereits existiert
     * - {@linkcode TitelExists} falls der Titel bereits existiert
     */
    async create(
        film: Film,
    ): Promise<FilmInvalid | IsbnExists | TitelExists | string> {
        logger.debug('FilmService.create(): film=%o', film);
        const validateResult = await this.validateCreate(film);
        if (validateResult instanceof FilmServiceError) {
            return validateResult;
        }

        const filmModel = new FilmModel(film);
        const saved = await filmModel.save();
        const id = saved._id as string; // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
        logger.debug('FilmService.create(): id=%s', id);

        await this.sendmail(film);

        return id;
    }

    /**
     * Ein vorhandenes Film soll aktualisiert werden.
     * @param film Das zu aktualisierende Film
     * @param versionStr Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall
     *  - {@linkcode FilmInvalid}, falls Constraints verletzt sind
     *  - {@linkcode FilmNotExists}, falls das Film nicht existiert
     *  - {@linkcode TitelExists}, falls der Titel bereits existiert
     *  - {@linkcode VersionInvalid}, falls die Versionsnummer ungültig ist
     *  - {@linkcode VersionOutdated}, falls die Versionsnummer nicht aktuell ist
     */
    async update(
        film: Film,
        versionStr: string,
    ): Promise<
        | FilmInvalid
        | FilmNotExists
        | TitelExists
        | VersionInvalid
        | VersionOutdated
        | number
    > {
        logger.debug('FilmService.update(): film=%o', film);
        logger.debug('FilmService.update(): versionStr=%s', versionStr);

        const validateResult = await this.validateUpdate(film, versionStr);
        if (validateResult instanceof FilmServiceError) {
            return validateResult;
        }

        // findByIdAndReplace ersetzt ein Document mit ggf. weniger Properties
        const filmModel = new FilmModel(film);
        // Weitere Methoden zum Aktualisieren:
        //    Film.findOneAndUpdate(update)
        //    film.updateOne(bedingung)
        const updated = await FilmModel.findByIdAndUpdate(
            film._id,
            filmModel,
            FilmService.UPDATE_OPTIONS,
        ).lean<FilmData | null>();
        if (updated === null) {
            return new FilmNotExists(film._id);
        }

        const version = updated.__v as number; // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
        logger.debug('FilmService.update(): version=%d', version);

        return Promise.resolve(version);
    }

    /**
     * Ein Film wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Filmes
     * @returns true, falls das Film vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: string) {
        logger.debug('FilmService.delete(): id=%s', id);

        // Das Film zur gegebenen ID asynchron loeschen
        const deleted = await FilmModel.findByIdAndDelete(id).lean();
        logger.debug('FilmService.delete(): deleted=%o', deleted);
        return deleted !== null;

        // Weitere Methoden von mongoose, um zu loeschen:
        //  Film.findByIdAndRemove(id)
        //  Film.findOneAndRemove(bedingung)
    }

    private deleteTimestamps(film: FilmData) {
        delete film.createdAt;
        delete film.updatedAt;
    }

    private async validateCreate(film: Film) {
        const msg = validateFilm(film);
        if (msg !== undefined) {
            logger.debug(
                'FilmService.validateCreate(): Validation Message: %o',
                msg,
            );
            return new FilmInvalid(msg);
        }

        // statt 2 sequentiellen DB-Zugriffen waere 1 DB-Zugriff mit OR besser

        const { titel } = film;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (await FilmModel.exists({ titel })) {
            return new TitelExists(titel);
        }

        const { isan } = film;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (await FilmModel.exists({ isan })) {
            return new IsbnExists(isan);
        }

        logger.debug('FilmService.validateCreate(): ok');
        return undefined;
    }

    private async sendmail(film: Film) {
        if (cloud !== undefined || mailConfig.host === 'skip') {
            // In der Cloud kann man z.B. "@sendgrid/mail" statt
            // "nodemailer" mit lokalem Mailserver verwenden
            return;
        }

        const from = '"Joe Doe" <Joe.Doe@acme.com>';
        const to = '"Foo Bar" <Foo.Bar@acme.com>';
        const subject = `Neues Film ${film._id}`;
        const body = `Das Film mit dem Titel <strong>${film.titel}</strong> ist angelegt`;

        const data: SendMailOptions = { from, to, subject, html: body };
        logger.debug('sendMail(): data=%o', data);

        try {
            const nodemailer = await import('nodemailer'); // eslint-disable-line node/no-unsupported-features/es-syntax
            await nodemailer.createTransport(mailConfig).sendMail(data);
        } catch (err: unknown) {
            logger.error(
                'FilmService.create(): Fehler beim Verschicken der Email: %o',
                err,
            );
        }
    }

    private async validateUpdate(film: Film, versionStr: string) {
        const result = this.validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        logger.debug('FilmService.validateUpdate(): version=%d', version);
        logger.debug('FilmService.validateUpdate(): film=%o', film);

        const validationMsg = validateFilm(film);
        if (validationMsg !== undefined) {
            return new FilmInvalid(validationMsg);
        }

        const resultTitel = await this.checkTitelExists(film);
        if (resultTitel !== undefined && resultTitel.id !== film._id) {
            return resultTitel;
        }

        if (film._id === undefined) {
            return new FilmNotExists(undefined);
        }

        const resultIdAndVersion = await this.checkIdAndVersion(
            film._id,
            version,
        );
        if (resultIdAndVersion !== undefined) {
            return resultIdAndVersion;
        }

        logger.debug('FilmService.validateUpdate(): ok');
        return undefined;
    }

    private validateVersion(versionStr: string | undefined) {
        if (versionStr === undefined) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                'FilmService.validateVersion(): VersionInvalid=%o',
                error,
            );
            return error;
        }

        const version = Number.parseInt(versionStr, 10);
        if (Number.isNaN(version)) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                'FilmService.validateVersion(): VersionInvalid=%o',
                error,
            );
            return error;
        }

        return version;
    }

    private async checkTitelExists(film: Film) {
        const { titel } = film;

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        const result = await FilmModel.findOne({ titel }, { _id: true }).lean();
        if (result !== null) {
            const id = result._id;
            logger.debug('FilmService.checkTitelExists(): _id=%s', id);
            return new TitelExists(titel, id);
        }

        logger.debug('FilmService.checkTitelExists(): ok');
        return undefined;
    }

    private async checkIdAndVersion(id: string, version: number) {
        const filmDb: FilmData | null = await FilmModel.findById(id).lean();
        if (filmDb === null) {
            const result = new FilmNotExists(id);
            logger.debug(
                'FilmService.checkIdAndVersion(): FilmNotExists=%o',
                result,
            );
            return result;
        }

        // nullish coalescing
        const versionDb = filmDb.__v ?? 0;
        if (version < versionDb) {
            const result = new VersionOutdated(id, version);
            logger.debug(
                'FilmService.checkIdAndVersion(): VersionOutdated=%o',
                result,
            );
            return result;
        }

        return undefined;
    }
}
/* eslint-enable no-null/no-null, unicorn/no-useless-undefined */
/* eslint-enable max-lines */
