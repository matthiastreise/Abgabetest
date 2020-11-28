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

/* eslint-disable max-classes-per-file, @typescript-eslint/no-type-alias */

import type { ValidationErrorMsg } from '../entity';

export class SongServiceError {} // eslint-disable-line @typescript-eslint/no-extraneous-class

export class SongInvalid extends SongServiceError {
    constructor(readonly msg: ValidationErrorMsg) {
        super();
    }
}

export class TitelExists extends SongServiceError {
    constructor(readonly titel: string, readonly id: string) {
        super();
    }
}

export class IsbnExists extends SongServiceError {
    constructor(readonly isbn: string, readonly id: string) {
        super();
    }
}

export type CreateError = SongInvalid | TitelExists | IsbnExists;

export class VersionInvalid extends SongServiceError {
    constructor(readonly version: string | undefined) {
        super();
    }
}

export class VersionOutdated extends SongServiceError {
    constructor(readonly id: string, readonly version: number) {
        super();
    }
}

export class SongNotExists extends SongServiceError {
    constructor(readonly id: string | undefined) {
        super();
    }
}

export type UpdateError =
    | SongInvalid
    | SongNotExists
    | TitelExists
    | VersionInvalid
    | VersionOutdated;

export class SongFileServiceError {} // eslint-disable-line @typescript-eslint/no-extraneous-class

export class FileNotFound extends SongFileServiceError {
    constructor(readonly filename: string) {
        super();
    }
}

export class MultipleFiles extends SongFileServiceError {
    constructor(readonly filename: string) {
        super();
    }
}

export type DownloadError = SongNotExists | FileNotFound | MultipleFiles;

/* eslint-enable max-classes-per-file, @typescript-eslint/no-type-alias */
