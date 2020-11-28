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

import type { Song, SongData } from '../entity';
import {
    SongInvalid,
    SongNotExists,
    SongServiceError,
    TitelExists,
    VersionInvalid,
    VersionOutdated,
} from './errors';
import { SongModel, validateSong } from '../entity';
import { dbConfig, logger, mailConfig, serverConfig } from '../../shared';
import type { Document } from 'mongoose';
import JSON5 from 'json5';
import type { SendMailOptions } from 'nodemailer';
import { SongServiceMock } from './mock';
import { startSession } from 'mongoose';

const { mockDB } = dbConfig;

// API-Dokumentation zu mongoose:
// http://mongoosejs.com/docs/api.html
// https://github.com/Automattic/mongoose/issues/3949

/* eslint-disable require-await, no-null/no-null, unicorn/no-useless-undefined */
// BEACHTE: asynchrone Funktionen in der Klasse erfordern kein top-level await
export class SongService {
    private readonly mock: SongServiceMock | undefined;

    constructor() {
        if (mockDB) {
            this.mock = new SongServiceMock();
        }
    }

    // Status eines Promise:
    // Pending: das Resultat gibt es noch nicht, weil die asynchrone Operation,
    //          die das Resultat liefert, noch nicht abgeschlossen ist
    // Fulfilled: die asynchrone Operation ist abgeschlossen und
    //            das Promise-Objekt hat einen Wert
    // Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //           Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //           Stattdessen ist im Promise-Objekt die Fehlerursache enthalten.

    async findById(id: string) {
        if (this.mock !== undefined) {
            return this.mock.findById(id);
        }
        logger.debug(`SongService.findById(): id= ${id}`);

        // ein Song zur gegebenen ID asynchron suchen
        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // null falls nicht gefunden
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
        // so dass der virtuelle getter "id" auch nicht mehr vorhanden ist
        const song = await SongModel.findById(id).lean<SongData>();
        return song ?? undefined;
    }

    async find(query?: any | undefined) {
        if (this.mock !== undefined) {
            return this.mock.find(query);
        }

        logger.debug(`SongService.find(): query=${JSON5.stringify(query)}`);

        // alle Songs asynchron suchen u. aufsteigend nach titel sortieren
        // https://docs.mongodb.org/manual/reference/object-id
        // entries(): { titel: 'a', rating: 5 } => [{ titel: 'x'}, {rating: 5}]
        if (query === undefined || Object.entries(query).length === 0) {
            logger.debug('SongService.find(): alle Songs');
            // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
            return SongModel.find().sort('titel').lean<SongData>();
        }

        // { titel: 'a', rating: 5, javascript: true }
        const { titel, ...dbQuery } = query; // eslint-disable-line @typescript-eslint/no-unsafe-assignment

        // Songs zur Query (= JSON-Objekt durch Express) asynchron suchen
        if (titel !== undefined) {
            // Titel in der Query: Teilstring des Titels,
            // d.h. "LIKE" als regulaerer Ausdruck
            // 'i': keine Unterscheidung zw. Gross- u. Kleinschreibung
            // NICHT /.../, weil das Muster variabel sein muss
            // CAVEAT: KEINE SEHR LANGEN Strings wg. regulaerem Ausdruck
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            if (titel.length < 10) {
                dbQuery.titel = new RegExp(titel, 'iu'); // eslint-disable-line security/detect-non-literal-regexp
            }
        }
        logger.debug(`SongService.find(): dbQuery=${JSON5.stringify(dbQuery)}`);

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // leeres Array, falls nichts gefunden wird
        // lean() liefert ein "Plain JavaScript Object" statt ein Mongoose Document
        return SongModel.find(dbQuery).lean<SongData>();
        // Song.findOne(query), falls das Suchkriterium eindeutig ist
        // bei findOne(query) wird null zurueckgeliefert, falls nichts gefunden
    }

    async create(songData: Song) {
        if (this.mock !== undefined) {
            return this.mock.create(songData);
        }

        logger.debug(
            `SongService.create(): songData=${JSON5.stringify(songData)}`,
        );
        const result = await this.validateCreate(songData);
        if (result instanceof SongServiceError) {
            return result;
        }

        const song = new SongModel(songData);
        let songSaved!: Document;
        // https://www.mongodb.com/blog/post/quick-start-nodejs--mongodb--how-to-implement-transactions
        const session = await startSession();
        try {
            await session.withTransaction(async () => {
                songSaved = await song.save();
            });
        } catch (err: unknown) {
            logger.error(
                `SongService.create(): Die Transaktion wurde abgebrochen: ${JSON5.stringify(
                    err,
                )}`,
            );
            // TODO [2030-09-30] Weitere Fehlerbehandlung bei Rollback
        } finally {
            session.endSession();
        }
        const songDataSaved: SongData = songSaved.toObject(); // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        logger.debug(
            `SongService.create(): songDataSaved=${JSON5.stringify(
                songDataSaved,
            )}`,
        );

        await this.sendmail(songDataSaved);

        return songDataSaved;
    }

    async update(songData: Song, versionStr: string) {
        if (this.mock !== undefined) {
            return this.mock.update(songData);
        }

        logger.debug(
            `SongService.update(): songData=${JSON5.stringify(songData)}`,
        );
        logger.debug(`SongService.update(): versionStr=${versionStr}`);

        const validateResult = await this.validateUpdate(songData, versionStr);
        if (validateResult instanceof SongServiceError) {
            return validateResult;
        }

        // findByIdAndReplace ersetzt ein Document mit ggf. weniger Properties
        const song = new SongModel(songData);
        const updateOptions = { new: true };
        const result = await SongModel.findByIdAndUpdate(
            song._id,
            song,
            updateOptions,
        ).lean<SongData>();
        if (result === null) {
            return new SongNotExists(song._id);
        }

        if (result.__v !== undefined) {
            result.__v++;
        }
        logger.debug(`SongService.update(): result=${JSON5.stringify(result)}`);

        // Weitere Methoden von mongoose zum Aktualisieren:
        //    Song.findOneAndUpdate(update)
        //    song.update(bedingung)
        return Promise.resolve(result);
    }

    async delete(id: string) {
        if (this.mock !== undefined) {
            return this.mock.remove(id);
        }
        logger.debug(`SongService.delete(): id=${id}`);

        // Das Song zur gegebenen ID asynchron loeschen
        const { deletedCount } = await SongModel.deleteOne({ _id: id }); // eslint-disable-line @typescript-eslint/naming-convention
        logger.debug(`SongService.delete(): deletedCount=${deletedCount}`);
        return deletedCount !== undefined;

        // Weitere Methoden von mongoose, um zu loeschen:
        //  Song.findByIdAndRemove(id)
        //  Song.findOneAndRemove(bedingung)
    }

    private async validateCreate(song: Song) {
        const msg = validateSong(song);
        if (msg !== undefined) {
            logger.debug(
                `SongService.validateCreate(): Validation Message: ${JSON5.stringify(
                    msg,
                )}`,
            );
            return new SongInvalid(msg);
        }

        // statt 2 sequentiellen DB-Zugriffen waere 1 DB-Zugriff mit OR besser

        const resultTitel = await this.checkTitelExists(song);
        if (resultTitel !== undefined) {
            return resultTitel;
        }

        logger.debug('SongService.validateCreate(): ok');
        return undefined;
    }

    private async checkTitelExists(song: Song) {
        const { titel } = song;

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const tmpId = await SongModel.findOne({ titel }, { _id: true }).lean<
            string
        >();
        if (tmpId !== null) {
            logger.debug(
                `SongService.checkTitelExists(): _id=${JSON5.stringify(tmpId)}`,
            );
            return new TitelExists(titel as string, tmpId);
        }

        logger.debug('SongService.checkTitelExists(): ok');
        return undefined;
    }

    private async sendmail(songData: SongData) {
        if (serverConfig.cloud !== undefined) {
            // In der Cloud kann man z.B. "@sendgrid/mail" statt
            // "nodemailer" mit lokalem Mailserver verwenden
            return;
        }

        const from = '"Joe Doe" <Joe.Doe@acme.com>';
        const to = '"Foo Bar" <Foo.Bar@acme.com>';
        const subject = `Neues Song ${songData._id}`;
        const body = `Das Song mit dem Titel <strong>${songData.titel}</strong> ist angelegt`;

        const data: SendMailOptions = { from, to, subject, html: body };
        logger.debug(`sendMail(): data = ${JSON5.stringify(data)}`);

        try {
            const nodemailer = await import('nodemailer'); // eslint-disable-line node/no-unsupported-features/es-syntax
            await nodemailer.createTransport(mailConfig).sendMail(data);
        } catch (err: unknown) {
            logger.error(
                `SongService.create(): Fehler beim Verschicken der Email: ${JSON5.stringify(
                    err,
                )}`,
            );
        }
    }

    private async validateUpdate(song: SongData, versionStr: string) {
        const result = this.validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        logger.debug(`SongService.validateUpdate(): version=${version}`);
        logger.debug(
            `SongService.validateUpdate(): song=${JSON5.stringify(song)}`,
        );

        const validationMsg = validateSong(song);
        if (validationMsg !== undefined) {
            return new SongInvalid(validationMsg);
        }

        const resultTitel = await this.checkTitelExists(song);
        if (resultTitel !== undefined && resultTitel.id !== song._id) {
            return resultTitel;
        }

        const resultIdAndVersion = await this.checkIdAndVersion(
            song._id,
            version,
        );
        if (resultIdAndVersion !== undefined) {
            return resultIdAndVersion;
        }

        logger.debug('SongService.validateUpdate(): ok');
        return undefined;
    }

    private validateVersion(versionStr: string | undefined) {
        if (versionStr === undefined) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                `SongService.validateVersion(): VersionInvalid=${JSON5.stringify(
                    error,
                )}`,
            );
            return error;
        }

        const version = Number.parseInt(versionStr, 10);
        if (Number.isNaN(version)) {
            const error = new VersionInvalid(versionStr);
            logger.debug(
                `SongService.validateVersion(): VersionInvalid=${JSON5.stringify(
                    error,
                )}`,
            );
            return error;
        }

        return version;
    }

    private async checkIdAndVersion(id: string | undefined, version: number) {
        const songDb = await SongModel.findById(id).lean<SongData>();
        if (songDb === null) {
            const result = new SongNotExists(id);
            logger.debug(
                `SongService.checkIdAndVersion(): SongNotExists=${JSON5.stringify(
                    result,
                )}`,
            );
            return result;
        }

        const versionDb = songDb.__v ?? 0;
        if (version < versionDb) {
            const result = new VersionOutdated(id as string, version);
            logger.debug(
                `SongService.checkIdAndVersion(): VersionOutdated=${JSON5.stringify(
                    result,
                )}`,
            );
            return result;
        }

        return undefined;
    }
}
/* eslint-enable require-await, no-null/no-null, unicorn/no-useless-undefined */
/* eslint-enable max-lines */
