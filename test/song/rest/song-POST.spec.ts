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

import { Interpret, Label } from '../../../src/song/entity';
import { HttpMethod, agent, createTestserver } from '../../testserver';
import { HttpStatus, serverConfig, uuidRegexp } from '../../../src/shared';
import { afterAll, beforeAll, describe, test } from '@jest/globals';
import fetch, { Headers, Request } from 'node-fetch';
import type { AddressInfo } from 'net';
import type { Song } from '../../../src/song/entity';
import { PATHS } from '../../../src/app';
import type { Server } from 'http';
import chai from 'chai';
import { login } from '../../login';

const { expect } = chai;

// IIFE (= Immediately Invoked Function Expression) statt top-level await
// https://developer.mozilla.org/en-US/docs/Glossary/IIFE
(async () => {
    // startWith(), endWith()
    const chaiString = await import('chai-string');
    chai.use(chaiString.default);
})();

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuerSong: Song = {
    titel: 'Test',
    label: Label.SONY_MUSIC,
    produzent: 'PASports',
    interpret: Interpret.TRIVIUM,
    lauflaenge: 3.22,
    erscheinungsdatum: '2016-02-28',
};
const neuerSongInvalid: object = {
    titel: 'FalschTest',
    label: 'klapptNicht',
    produzent: 'PASports',
    interpret: 'Falsch',
    lauflaenge: 3.22,
    erscheinungsdatum: '12-34556-111',
};
const neuesSongTitelExistiert: Song = {
    titel: 'Positions',
    label: Label.ROADRUNNER_RECORDS,
    produzent: 'Quincy Jones',
    interpret: Interpret.ZUGEZOGENMASKULIN,
    lauflaenge: 3.02,
    erscheinungsdatum: new Date('2020-03-21'),
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
let server: Server;
const path = PATHS.songs;
let songsUri: string;
let loginUri: string;

// Test-Suite
describe('POST /songs', () => {
    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        server = await createTestserver();

        const address = server.address() as AddressInfo;
        const baseUri = `https://${serverConfig.host}:${address.port}`;
        songsUri = `${baseUri}${path}`;
        loginUri = `${baseUri}${PATHS.login}`;
    });

    // (done?: DoneFn) => Promise<void | undefined | unknown> | void | undefined
    // close(callback?: (err?: Error) => void): this
    afterAll(() => {
        server.close();
    });

    test('Neuer Song', async () => {
        // given
        const token = await login(loginUri);

        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        });
        const body = JSON.stringify(neuerSong);
        const request = new Request(songsUri, {
            method: HttpMethod.POST,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        const { status } = response;
        expect(status).to.be.equal(HttpStatus.CREATED);

        const location = response.headers.get('Location');
        expect(location).to.exist;
        expect(typeof location === 'string').to.be.true;
        expect(location).not.to.be.empty;

        // UUID: Muster von HEX-Ziffern
        const indexLastSlash: number = location?.lastIndexOf('/') as number;
        const idStr = location?.slice(indexLastSlash + 1);
        expect(idStr).not.to.be.empty;
        expect(uuidRegexp.test(idStr as string)).to.be.true;

        const responseBody = response.text();
        expect(responseBody).to.be.empty;
    });

    test('Neuer Song mit ungueltigen Daten', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        });
        const body = JSON.stringify(neuerSongInvalid);
        const request = new Request(songsUri, {
            method: HttpMethod.POST,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.BAD_REQUEST);
        const { label, erscheinungsdatum, interpret } = await response.json();

        expect(label).to.be.equal(
            'Das Label eines Songs muss SONY_MUSIC, ROADRUNNER_RECORDS, BETTERNOISE_MUSIC oder UNIVERSAL_MUSIC sein.',
        );
        expect(interpret).to.be.equal(
            'Der Interpret eines Songs muss TRIVIUM, FIVEFINGERDEATHPUNCH, ZUGEZOGENMASKULIN oder DENDEMANN sein.',
        );
        expect(erscheinungsdatum).to.contain('ist kein gueltiges Datum');
    });

    test('Neuer Song, aber Titel existiert bereits', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        });
        const body = JSON.stringify(neuesSongTitelExistiert);
        const request = new Request(songsUri, {
            method: HttpMethod.POST,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.BAD_REQUEST);
        const responseBody = await response.text();
        expect(responseBody).has.string('Titel');
    });

    test('Neuer Song, aber ohne Token', async () => {
        // given
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const body = JSON.stringify(neuesSongTitelExistiert);
        const request = new Request(songsUri, {
            method: HttpMethod.POST,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.UNAUTHORIZED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equalIgnoreCase('unauthorized');
    });

    test('Neuer Song, aber mit falschem Token', async () => {
        // given
        const token = 'FALSCH';
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        });
        const body = JSON.stringify(neuerSong);
        const request = new Request(songsUri, {
            method: HttpMethod.POST,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.UNAUTHORIZED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equalIgnoreCase('unauthorized');
    });
});
