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
 * Das Modul besteht aus der Klasse {@linkcode FilmFileService}, damit
 * Binärdateien mit dem Treiber von _MongoDB_ in _GridFS_ abgespeichert und
 * ausgelesen werden können.
 * @packageDocumentation
 */

import { FileNotFound, FilmNotExists, MultipleFiles } from './errors';
import { closeMongoDBClient, connectMongoDB, logger, save } from '../../shared';
import { FilmModel } from '../entity';
import { FilmService } from './film.service';
import { GridFSBucket } from 'mongodb';
import type { ObjectId } from 'mongodb';
import { Readable } from 'stream';

/* eslint-disable unicorn/no-useless-undefined */
/**
 * Mit der Klasse {@linkcode FilmFileService} können Binärdateien mit dem
 * Treiber von _MongoDB_ in _GridFS_ abgespeichert und ausgelesen werden.
 */
export class FilmFileService {
    private readonly service = new FilmService();

    /**
     * Asynchrones Abspeichern einer Binärdatei.
     *
     * @param id ID des zugehörigen Filmes, die als Dateiname verwendet wird.
     * @param buffer Node-Buffer mit den Binärdaten.
     * @param contentType MIME-Type, z.B. `image/png`.
     * @returns true, falls die Binärdaten abgespeichert wurden. Sonst false.
     */
    async save(id: string, buffer: Buffer, contentType: string | undefined) {
        logger.debug(
            'FilmFileService.save(): id=%s, contentType=%s',
            id,
            contentType,
        );

        // Gibt es ein Film zur angegebenen ID?
        // eslint-disable-next-line line-comment-position, spaced-comment
        const film = await this.service.findById(id); //NOSONAR
        if (film === undefined) {
            return false;
        }

        const { db, client } = await connectMongoDB();
        const bucket = new GridFSBucket(db);
        await this.deleteFiles(id, bucket);

        // https://stackoverflow.com/questions/13230487/converting-a-buffer-into-a-readablestream-in-node-js#answer-44091532
        const readable = new Readable();
        // _read ist erforderlich, kann die leere Funktion sein
        readable._read = () => {}; // eslint-disable-line no-underscore-dangle,no-empty-function
        readable.push(buffer);
        readable.push(null); // eslint-disable-line no-null/no-null, unicorn/no-null,  unicorn/no-array-push-push

        const metadata = { contentType };
        save(readable, bucket, id, { metadata }, client);
        return true;
    }

    /**
     * Asynchrones Suchen nach einer Binärdatei in _GridFS_ anhand des Dateinamens.
     * @param filename Der Dateiname der Binärdatei.
     * @returns GridFSBucketReadStream, falls es eine Binärdatei mit dem
     *  angegebenen Dateinamen gibt. Im Fehlerfall ein JSON-Objekt vom Typ:
     * - {@linkcode FilmNotExists}
     * - {@linkcode FileNotFound}
     * - {@linkcode MultipleFiles}
     */
    async find(filename: string) {
        logger.debug('FilmFileService.findFile(): filename=%s', filename);
        const resultCheck = await this.checkFilename(filename);
        if (resultCheck !== undefined) {
            return resultCheck;
        }

        const { db, client } = await connectMongoDB();

        // https://mongodb.github.io/node-mongodb-native/3.5/tutorials/gridfs/streaming
        const bucket = new GridFSBucket(db);
        const resultContentType = await this.getContentType(filename, bucket);
        if (typeof resultContentType !== 'string') {
            return resultContentType;
        }

        const contentType = resultContentType;
        // https://mongodb.github.io/node-mongodb-native/3.5/tutorials/gridfs/streaming/#downloading-a-file
        // https://www.freecodecamp.org/news/node-js-streams-everything-you-need-to-know-c9141306be93
        const readStream = bucket
            .openDownloadStreamByName(filename)
            .on('end', () => closeMongoDBClient(client));
        return { readStream, contentType };
    }

    private async deleteFiles(filename: string, bucket: GridFSBucket) {
        logger.debug('FilmFileService.deleteFiles(): filename=%s', filename);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/naming-convention
        const idObjects: { _id: ObjectId }[] = await bucket
            .find({ filename })
            .project({ _id: 1 })
            .toArray();
        const ids = idObjects.map((obj) => obj._id);
        logger.debug('FilmFileService.deleteFiles(): ids=%o', ids);
        ids.forEach((fileId) =>
            bucket.delete(fileId, () =>
                logger.debug(
                    'FilmFileService.deleteFiles(): geloeschte ID=%o',
                    fileId,
                ),
            ),
        );
    }

    private async checkFilename(filename: string) {
        logger.debug('FilmFileService.checkFilename(): filename=%s', filename);

        // Gibt es ein Film mit dem gegebenen "filename" als ID?
        // eslint-disable-next-line line-comment-position, spaced-comment
        const film = await FilmModel.findById(filename); //NOSONAR
        // eslint-disable-next-line no-null/no-null
        if (film === null) {
            const result = new FilmNotExists(filename);
            logger.debug(
                'FilmFileService.checkFilename(): FilmNotExists=%o',
                result,
            );
            return result;
        }

        logger.debug('FilmFileService.checkFilename(): film=%o', film);

        return undefined;
    }

    private async getContentType(filename: string, bucket: GridFSBucket) {
        let files: { metadata: { contentType: string } }[];
        try {
            files = await bucket.find({ filename }).toArray(); // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        } catch (err: unknown) {
            logger.error('%o', err);
            files = [];
        }

        switch (files.length) {
            case 0: {
                const error = new FileNotFound(filename);
                logger.debug(
                    'FilmFileService.getContentType(): FileNotFound=%o',
                    error,
                );
                return error;
            }

            case 1: {
                const [file] = files;
                if (file === undefined) {
                    const error = new FileNotFound(filename);
                    logger.debug(
                        'FilmFileService.getContentType(): FileNotFound=%o',
                        error,
                    );
                    return error;
                }
                const { contentType }: { contentType: string } = file.metadata;
                logger.debug(
                    'FilmFileService.getContentType(): contentType=%s',
                    contentType,
                );
                return contentType;
            }

            default: {
                const error = new MultipleFiles(filename);
                logger.debug(
                    'FilmFileService.getContentType(): MultipleFiles=%o',
                    error,
                );
                return new MultipleFiles(filename);
            }
        }
    }
}

/* eslint-enable unicorn/no-useless-undefined */
